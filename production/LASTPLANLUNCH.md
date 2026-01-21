# LASTPLANLUNCH.md - Complete Implementation Plan

**Date:** 2026-01-21
**Status:** Implementation Required
**Priority:** CRITICAL

---

## 🎯 Executive Summary

Bu belge, MPC Wallet sistemindeki **eksik/çalışmayan özelliklerin** tam listesini ve **nasıl düzeltileceğini** içeriyor.

### Ana Sorunlar:
1. ❌ **cluster/nodes endpoint çöküyor** (PostgreSQL type mismatch - **DÜZELTİLDİ**)
2. ❌ **Orchestration service voting state'teki transaction'ları kontrol etmiyor**
3. ❌ **Vote threshold detection yok**
4. ❌ **Voting → Approved otomatik transition YOK**
5. ❌ **QUIC-based Vote Broadcasting eksik** (detailedplan.md'de tanımlı ama implement edilmemiş)
6. ❌ **Tüm transaction state transitions eksik** (sadece pending→voting ve approved→signing var)

### Not: Transport Layer
Sistem **QUIC + mTLS** kullanıyor (libp2p DEĞİL):
- QUIC transport: `protocols/src/p2p/quic_transport.rs`
- mTLS certificates: `crates/security/src/`
- Bidirectional QUIC streams ile node-to-node messaging
- Certificate-based authentication (her bağlantıda mTLS handshake)

---

## 📋 PART 1: cluster/nodes Endpoint Fix (✅ COMPLETED)

### Sorun:
```
thread panicked at postgres.rs:524:46:
error retrieving column 5: error deserializing column 5
```

PostgreSQL'de `EXTRACT(EPOCH ...)` **numeric** type döndürüyor, Rust kodu **f64** bekliyor.

### Çözüm (Uygulandı):
**File:** `crates/storage/src/postgres.rs:507`

```sql
-- ÖNCE (Hatalı):
EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat

-- SONRA (Doğru):
CAST(EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) AS DOUBLE PRECISION) as seconds_since_heartbeat
```

### Test:
```bash
curl -s http://localhost:8081/api/v1/cluster/nodes
# Artık node listesini döndürmeli, exit code 52 vermemeli
```

---

## 📋 PART 2: QUIC-Based Vote Broadcasting Architecture

### Detailedplan.md'den Mimari (lines 755-777):

```
Voting Workflow:
[1] Coordinator creates VoteRequest
[2] Broadcast to all N nodes via QUIC  ← ❌ BU EKSİK
[3] Each node validates TX
[4] Node sends VoteResponse               ← ❌ BU EKSİK
[5] Coordinator collects votes            ← ❌ BU EKSİK
[6] Check threshold                       ← ❌ BU EKSİK
[7] If met: Proceed to signing
```

### ÖNEMLI SORU: Vote Broadcasting Gerekli mi?

**Kullanıcı sorusu:** "birine giden voteları hepsine gitmesi lazım değil ki vote için byzantine falan filan yok mu zaten oyların kaydolduğu yerde kontrole sahip olan eleman için"

**Cevap:**

Vote broadcasting için **2 yaklaşım** var:

#### Yaklaşım 1: Centralized Voting (Database Polling) - **DAHA BASIT**
- Orchestration service (coordinator) voting round başlatır
- Her node **kendi veritabanını izler** veya **HTTP endpoint'ten** vote request'i alır
- Node'lar vote'u **doğrudan PostgreSQL'e** insert eder
- Byzantine detector PostgreSQL'de vote'u validate eder
- Orchestration service PostgreSQL'i poll ederek vote count'u kontrol eder

**Avantajlar:**
- QUIC message routing gerekmez
- Basit implementation
- Zaten PostgreSQL + etcd audit trail var

**Dezavantajlar:**
- Polling overhead (her 1-2 saniyede DB query)
- Coordinator single point of failure

#### Yaklaşım 2: QUIC Stream-Based Vote Broadcasting (Full Distributed) - **DAHA KARMAŞIK**
- Orchestration service **QUIC bidirectional stream** ile VoteRequest mesajını tüm node'lara gönderir
- Her node **aynı QUIC stream üzerinden VoteResponse** döner
- Coordinator QUIC stream'den response'ları toplar (timeout: 30s)
- Byzantine detector her vote'u validate eder

**Avantajlar:**
- Gerçek zamanlı (no polling)
- Distributed architecture
- Network failure detection
- mTLS güvenliği (certificate-based authentication)

**Dezavantajlar:**
- Message serialization/deserialization
- QUIC stream lifecycle management
- Network partition handling

**Mevcut QUIC Infrastructure (Zaten Çalışıyor):**
```rust
// protocols/src/p2p/quic_transport.rs
impl QuicTransport {
    // ✅ MEVCUT - kullanılabilir
    pub async fn send_message(&self, peer_id: u16, message: Vec<u8>) -> Result<()>

    // ✅ MEVCUT - kullanılabilir
    pub async fn broadcast(&self, message: Vec<u8>) -> Result<()>
}
```

### KARAR: Hybrid Approach (Öneri)

**Phase 1 (ŞİMDİ YAPILACAK - Basit):**
- Orchestration service voting round başlatır → PostgreSQL'e yazar
- Node'lar **kendi local VoteProcessor'larını** kullanarak vote'u PostgreSQL'e insert eder (manuel test için)
- Orchestration service **yeni method ekle:** `process_voting_transactions()`
  - PostgreSQL'den voting_rounds'u query et
  - Vote count kontrol et
  - Threshold reached ise → **Voting → Approved** transition yap

**Phase 2 (SONRA - QUIC Streaming):**
- VoteRequest/VoteResponse message types ekle (`crates/types/src/messages.rs`)
- QUIC stream routing implement et
- Automatic vote casting via `QuicTransport.broadcast()`

**ŞİMDİLİK:** Phase 1'i implement et. QUIC broadcasting FROST/ECDSA/CGGMP protocol rounds için daha kritik.

---

## 📋 PART 3: Orchestration Service - Missing Methods

### Mevcut Durum:

**File:** `crates/orchestrator/src/service.rs`

```rust
// ✅ MEVCUT:
async fn process_pending_transactions()      // pending → voting
async fn process_approved_transactions()     // approved → signing

// ❌ EKSİK:
async fn process_voting_transactions()       // voting → threshold_reached/approved
async fn process_signing_transactions()      // signing → signed
async fn process_signed_transactions()       // signed → broadcasting
async fn process_broadcasting_transactions() // broadcasting → confirmed
async fn process_threshold_reached_transactions() // threshold_reached → approved
```

### Implementation Plan:

#### 3.1: `process_voting_transactions()` - **EN YÜKSEK ÖNCELİK**

**Görevi:**
1. PostgreSQL'den `state = 'voting'` olan transaction'ları al
2. Her transaction için ilişkili `voting_rounds` tablosunu kontrol et
3. `votes_received >= threshold` ise:
   - Transaction state'i `approved` yap
   - `voting_rounds.approved = true` yap
   - `voting_rounds.completed = true` yap
4. Timeout kontrolü (30s geçti mi?)
   - Evet → state'i `failed` yap

**Code:**

```rust
/// Process voting transactions (state: voting).
///
/// For each voting transaction:
/// 1. Query voting_rounds table
/// 2. Check if votes_received >= threshold
/// 3. If yes: transition to "approved"
/// 4. If timeout: transition to "failed"
async fn process_voting_transactions(&self) -> Result<()> {
    let voting_txs = self.postgres.get_transactions_by_state("voting").await
        .map_err(|e| OrchestrationError::Storage(e.into()))?;

    if voting_txs.is_empty() {
        return Ok(());
    }

    debug!("Processing {} voting transactions", voting_txs.len());

    for tx in voting_txs {
        match self.check_voting_completion(&tx).await {
            Ok(VotingStatus::Approved) => {
                info!("Voting approved for tx {:?}, transitioning to approved", tx.txid);
                self.postgres.update_transaction_state(&tx.txid, TransactionState::Approved).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
            Ok(VotingStatus::Rejected) => {
                warn!("Voting rejected for tx {:?}", tx.txid);
                self.postgres.update_transaction_state(&tx.txid, TransactionState::Rejected).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
            Ok(VotingStatus::TimedOut) => {
                warn!("Voting timed out for tx {:?}", tx.txid);
                self.postgres.update_transaction_state(&tx.txid, TransactionState::Failed).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
            Ok(VotingStatus::Pending) => {
                // Still waiting for votes
            }
            Err(e) => {
                error!("Failed to check voting completion for {:?}: {}", tx.txid, e);
            }
        }
    }

    Ok(())
}

/// Check if voting is complete for a transaction
async fn check_voting_completion(&self, tx: &Transaction) -> Result<VotingStatus> {
    // Query voting_rounds for this transaction
    let voting_round = self.postgres.get_voting_round_by_txid(&tx.txid).await
        .map_err(|e| OrchestrationError::Storage(e.into()))?;

    if let Some(round) = voting_round {
        // Check timeout
        let now = chrono::Utc::now();
        if now > round.timeout_at {
            return Ok(VotingStatus::TimedOut);
        }

        // Check if threshold reached
        if round.votes_received >= round.threshold {
            // Mark voting round as completed
            self.postgres.update_voting_round(
                round.id,
                round.votes_received,
                true,  // approved
                true,  // completed
            ).await.map_err(|e| OrchestrationError::Storage(e.into()))?;

            return Ok(VotingStatus::Approved);
        }

        // Check if rejection threshold reached (majority impossible)
        let reject_threshold = round.total_nodes - round.threshold + 1;
        let reject_count = round.total_nodes - round.votes_received; // simplified
        if reject_count >= reject_threshold {
            return Ok(VotingStatus::Rejected);
        }

        Ok(VotingStatus::Pending)
    } else {
        Err(OrchestrationError::InvalidState(
            format!("No voting round found for tx {}", tx.txid)
        ))
    }
}

enum VotingStatus {
    Approved,
    Rejected,
    Pending,
    TimedOut,
}
```

**Eklenecek storage method:**

**File:** `crates/storage/src/postgres.rs`

```rust
/// Get voting round by transaction ID
pub async fn get_voting_round_by_txid(&self, txid: &str) -> Result<Option<VotingRound>> {
    let client = self.pool.get().await
        .map_err(|e| Error::StorageError(format!("Failed to get client: {}", e)))?;

    let row = client.query_opt(
        r#"
        SELECT id, tx_id, round_number, total_nodes, threshold,
               votes_received, approved, completed, started_at,
               completed_at, timeout_at
        FROM voting_rounds
        WHERE tx_id = $1
        ORDER BY id DESC
        LIMIT 1
        "#,
        &[&txid],
    ).await
    .map_err(|e| Error::StorageError(format!("Failed to get voting round: {}", e)))?;

    Ok(row.map(|r| VotingRound {
        id: r.get::<_, i64>(0),
        tx_id: r.get::<_, String>(1),
        round_number: r.get::<_, i32>(2),
        total_nodes: r.get::<_, i32>(3) as u32,
        threshold: r.get::<_, i32>(4) as u32,
        votes_received: r.get::<_, i32>(5) as u32,
        approved: r.get::<_, bool>(6),
        completed: r.get::<_, bool>(7),
        started_at: r.get::<_, chrono::DateTime<chrono::Utc>>(8),
        completed_at: r.get::<_, Option<chrono::DateTime<chrono::Utc>>>(9),
        timeout_at: r.get::<_, chrono::DateTime<chrono::Utc>>(10),
    }))
}
```

---

#### 3.2: `process_signing_transactions()` - **ORTA ÖNCELİK**

**Görevi:**
1. `state = 'signing'` transaction'ları al
2. MPC signing protocol başlat (FROST veya CGGMP24)
3. Signature elde edilince → `signed_tx` field'ına yaz
4. State'i `signed` yap

**Mock Implementation (gerçek MPC yok şimdilik):**

```rust
async fn process_signing_transactions(&self) -> Result<()> {
    let signing_txs = self.postgres.get_transactions_by_state("signing").await
        .map_err(|e| OrchestrationError::Storage(e.into()))?;

    if signing_txs.is_empty() {
        return Ok(());
    }

    debug!("Processing {} signing transactions", signing_txs.len());

    for tx in signing_txs {
        // TODO: Implement actual MPC signing protocol
        // For now, create mock signature
        let mock_signed_tx = format!("signed_{}", tx.unsigned_tx.clone().unwrap_or_default());

        self.postgres.update_transaction_with_signature(&tx.txid, &mock_signed_tx).await
            .map_err(|e| OrchestrationError::Storage(e.into()))?;

        self.postgres.update_transaction_state(&tx.txid, TransactionState::Signed).await
            .map_err(|e| OrchestrationError::Storage(e.into()))?;

        info!("Transaction signed: {:?}", tx.txid);
    }

    Ok(())
}
```

---

#### 3.3: `process_signed_transactions()` - **DÜŞÜK ÖNCELİK**

**Görevi:**
1. `state = 'signed'` transaction'ları al
2. Bitcoin network'e broadcast et
3. State'i `broadcasting` yap

```rust
async fn process_signed_transactions(&self) -> Result<()> {
    let signed_txs = self.postgres.get_transactions_by_state("signed").await
        .map_err(|e| OrchestrationError::Storage(e.into()))?;

    if signed_txs.is_empty() {
        return Ok(());
    }

    debug!("Processing {} signed transactions", signed_txs.len());

    for tx in signed_txs {
        if let Some(signed_tx_hex) = &tx.signed_tx {
            // Broadcast to Bitcoin network
            match self.bitcoin.broadcast_transaction(signed_tx_hex).await {
                Ok(txid) => {
                    info!("Transaction broadcast: {} → {}", tx.txid, txid);
                    self.postgres.update_transaction_state(&tx.txid, TransactionState::Broadcasting).await
                        .map_err(|e| OrchestrationError::Storage(e.into()))?;
                }
                Err(e) => {
                    error!("Failed to broadcast tx {:?}: {}", tx.txid, e);
                    self.postgres.update_transaction_state(&tx.txid, TransactionState::Failed).await
                        .map_err(|e| OrchestrationError::Storage(e.into()))?;
                }
            }
        }
    }

    Ok(())
}
```

---

#### 3.4: `process_broadcasting_transactions()` - **DÜŞÜK ÖNCELİK**

**Görevi:**
1. `state = 'broadcasting'` transaction'ları al
2. Bitcoin blockchain'de confirmation kontrol et
3. Confirmed ise → `confirmed` state'ine geç

```rust
async fn process_broadcasting_transactions(&self) -> Result<()> {
    let broadcasting_txs = self.postgres.get_transactions_by_state("broadcasting").await
        .map_err(|e| OrchestrationError::Storage(e.into()))?;

    if broadcasting_txs.is_empty() {
        return Ok(());
    }

    debug!("Processing {} broadcasting transactions", broadcasting_txs.len());

    for tx in broadcasting_txs {
        // Check confirmation status
        match self.bitcoin.get_transaction_confirmations(&tx.txid).await {
            Ok(confirmations) if confirmations >= 1 => {
                info!("Transaction confirmed: {} ({} confirmations)", tx.txid, confirmations);
                self.postgres.update_transaction_state(&tx.txid, TransactionState::Confirmed).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
            Ok(_) => {
                // Still waiting for confirmations
            }
            Err(e) => {
                warn!("Failed to check confirmations for {}: {}", tx.txid, e);
            }
        }
    }

    Ok(())
}
```

---

### 3.5: Update Main Loop

**File:** `crates/orchestrator/src/service.rs`

```rust
async fn run(&self) -> Result<()> {
    let interval = self.config.poll_interval;
    let mut ticker = tokio::time::interval(interval);

    loop {
        tokio::select! {
            _ = ticker.tick() => {
                if let Err(e) = self.process_pending_transactions().await {
                    error!("Error processing pending transactions: {}", e);
                }

                // ✅ EKLE:
                if let Err(e) = self.process_voting_transactions().await {
                    error!("Error processing voting transactions: {}", e);
                }

                if let Err(e) = self.process_approved_transactions().await {
                    error!("Error processing approved transactions: {}", e);
                }

                // ✅ EKLE:
                if let Err(e) = self.process_signing_transactions().await {
                    error!("Error processing signing transactions: {}", e);
                }

                // ✅ EKLE:
                if let Err(e) = self.process_signed_transactions().await {
                    error!("Error processing signed transactions: {}", e);
                }

                // ✅ EKLE:
                if let Err(e) = self.process_broadcasting_transactions().await {
                    error!("Error processing broadcasting transactions: {}", e);
                }
            }
            _ = self.shutdown_rx.changed() => {
                info!("Orchestration service shutting down");
                break;
            }
        }
    }

    Ok(())
}
```

---

## 📋 PART 4: Vote Insertion - Automatic vs Manual

### Mevcut Sorun:

minplan.md'den:
> "bunu elle yapmayınca da artırıyomu votes receivedi otomatik kendisi bunu da test et"

**Cevap:** ŞU ANDA HAYIR, otomatik artırmıyor çünkü:

1. **Vote insertion manuel yapılıyor** (test için PostgreSQL'e direkt INSERT)
2. **votes_received counter** manuel update ediliyordu (hata!)
3. **Byzantine detector** çağrılmıyor vote insert edilirken

### Doğru Akış (Implement Edilmeli):

```
[1] Vote insert edilir (manuel veya P2P'den)
    ↓
[2] Trigger: INSERT trigger on `votes` table (PostgreSQL)
    OR
    Vote insert eden kod VoteProcessor.process_vote() çağırır
    ↓
[3] VoteProcessor.process_vote():
    - Byzantine detector check
    - etcd'de vote count increment
    - PostgreSQL'e vote yaz
    - voting_rounds.votes_received increment ← OTOMATIK
    ↓
[4] Orchestration service poll eder
    - process_voting_transactions() çağrılır
    - votes_received >= threshold kontrolü
    - State transition
```

### Implementation Options:

#### Option 1: PostgreSQL Trigger (Basit)

**File:** Create migration

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION update_voting_round_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment votes_received in voting_rounds
    UPDATE voting_rounds
    SET votes_received = votes_received + 1
    WHERE tx_id = NEW.tx_id
      AND completed = false;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER after_vote_insert
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_voting_round_count();
```

**Avantajlar:**
- Basit
- Otomatik
- Her vote insert'te çalışır

**Dezavantajlar:**
- Byzantine checking yok
- Signature validation yok

#### Option 2: Application-Level via QUIC Messaging (Doğru Yol)

**Phase 2 Implementation (QUIC-based):**

```rust
// protocols/src/p2p/message_handler.rs

/// Handle incoming VoteRequest from coordinator via QUIC
async fn handle_vote_request(
    &self,
    request: VoteRequest,
    stream: &mut RecvStream,
) -> Result<()> {
    // Validate transaction locally
    let tx_valid = self.validate_transaction(&request).await?;

    // Create vote
    let vote = Vote {
        tx_id: TransactionId(request.tx_id.clone()),
        node_id: self.node_id,
        peer_id: PeerId(self.node_id),
        value: tx_valid, // approve or reject
        timestamp: chrono::Utc::now(),
        signature: self.sign_vote(&request.tx_id, tx_valid).await?,
    };

    // Process vote through VoteProcessor (Byzantine checking + storage)
    let result = self.vote_processor.process_vote(vote).await?;

    // Send response back via same QUIC stream
    let response = VoteResponse {
        tx_id: request.tx_id,
        node_id: self.node_id,
        approve: tx_valid,
        vote_count: match result {
            VoteProcessingResult::Accepted { count } => count,
            VoteProcessingResult::ConsensusReached(_) => request.threshold,
            _ => 0,
        },
        signature: vote.signature,
    };

    // Serialize and send via QUIC bidirectional stream
    let response_bytes = bincode::serialize(&response)?;
    stream.write_all(&response_bytes).await?;

    Ok(())
}
```

**Coordinator-side (Orchestration):**

```rust
// crates/orchestrator/src/service.rs

async fn initiate_voting(&self, tx: &Transaction) -> Result<()> {
    // ... (create voting_round in PostgreSQL - zaten var)

    // Broadcast VoteRequest via QUIC to all nodes
    let vote_request = VoteRequest {
        tx_id: tx.txid.clone(),
        unsigned_tx: tx.unsigned_tx.clone(),
        recipient: tx.recipient.clone(),
        amount_sats: tx.amount_sats,
        threshold: 4,
    };

    let message = bincode::serialize(&vote_request)?;

    // Use existing QuicTransport infrastructure
    self.session_coordinator
        .quic_transport()
        .broadcast(message)
        .await?;

    info!("Broadcast VoteRequest via QUIC for tx {:?}", tx.txid);

    // State: pending → voting
    self.postgres.update_transaction_state(&tx.txid, TransactionState::Voting).await?;

    Ok(())
}
```

**ŞİMDİLİK:** Option 1 (SQL trigger) kullan, sonra Option 2 (QUIC) implement et.

---

## 📋 PART 5: Complete Transaction State Flow

### Hedef State Flow:

```
pending
  ↓
voting (orchestration creates voting_round)
  ↓
[votes collected via VoteProcessor]
  ↓
approved (when votes_received >= threshold)
  ↓
signing (MPC signing protocol)
  ↓
signed (signature attached)
  ↓
broadcasting (sent to Bitcoin network)
  ↓
confirmed (in blockchain)

// Error states:
rejected (voting failed)
failed (any error)
aborted_byzantine (Byzantine detected)
```

### Missing States to Implement:

| State | Entry | Exit | Handler Method | Priority |
|-------|-------|------|----------------|----------|
| `threshold_reached` | votes >= threshold | immediate | ❌ UNUSED (skip directly to approved) | LOW |
| `collecting` | ❌ UNUSED | ❌ UNUSED | ❌ REMOVE from TransactionState enum | LOW |
| `submitted` | ❌ UNCLEAR | ❌ UNCLEAR | ❌ REMOVE or clarify purpose | LOW |

**Öneri:** `collecting` ve `submitted` state'lerini kaldır, sadece basit flow kullan:
- pending → voting → approved → signing → signed → broadcasting → confirmed

---

## 📋 PART 6: Testing Plan

### Test 1: Voting → Approved Transition (Manual)

```bash
# 1. Create transaction
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qtest",
    "amount_sats": 10000,
    "metadata": "test voting"
  }'

# 2. Wait for pending → voting transition (automatic)
sleep 3

# 3. Check transaction state
TXID=$(docker exec mpc-postgres psql -U mpc -d mpc_wallet -t -c \
  "SELECT txid FROM transactions ORDER BY id DESC LIMIT 1")

echo "TXID: $TXID"

# 4. Insert votes manually (simulating node votes)
for NODE_ID in 1 2 3 4; do
  docker exec mpc-postgres psql -U mpc -d mpc_wallet -c \
    "INSERT INTO votes (tx_id, node_id, peer_id, vote_value, signature, created_at)
     VALUES ('$TXID', $NODE_ID, $NODE_ID, true, 'mock_sig_$NODE_ID', NOW());"

  echo "Inserted vote from node $NODE_ID"

  # Check votes_received count
  docker exec mpc-postgres psql -U mpc -d mpc_wallet -c \
    "SELECT votes_received, approved FROM voting_rounds WHERE tx_id = '$TXID';"
done

# 5. Wait for orchestration to detect threshold
sleep 5

# 6. Check if state changed to approved
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c \
  "SELECT state FROM transactions WHERE txid = '$TXID';"

# Expected: "approved"
```

### Test 2: Full Flow (End-to-End)

```bash
# After implementing all transitions, this should work:

# Create transaction
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"recipient": "tb1qtest", "amount_sats": 10000}'

# Monitor state changes
watch -n 2 "docker exec mpc-postgres psql -U mpc -d mpc_wallet -c \
  'SELECT txid, state, created_at FROM transactions ORDER BY id DESC LIMIT 1;'"

# Expected progression:
# pending → voting → (insert 4 votes) → approved → signing → signed → broadcasting → confirmed
```

---

## 📋 PART 7: Implementation Checklist

### Phase 1: Core Voting (ŞİMDİ YAPILACAK)

- [ ] **1.1** PostgreSQL trigger ekle (auto-increment votes_received)
  - File: `docker/init-db/03_triggers.sql`
  - Test: Manuel vote insert → votes_received artıyor mu?

- [ ] **1.2** `get_voting_round_by_txid()` storage method ekle
  - File: `crates/storage/src/postgres.rs`
  - Test: Voting round doğru query ediliyor mu?

- [ ] **1.3** `process_voting_transactions()` method ekle
  - File: `crates/orchestrator/src/service.rs`
  - Test: Threshold reached → approved transition oluyor mu?

- [ ] **1.4** Main loop'a `process_voting_transactions()` ekle
  - File: `crates/orchestrator/src/service.rs:run()`
  - Test: Her poll cycle'da voting check ediliyor mu?

- [ ] **1.5** Test: 4 vote insert → state approved olmalı
  - Bash script ile test
  - PostgreSQL log kontrol

### Phase 2: Signing & Broadcasting (SONRA)

- [ ] **2.1** `process_signing_transactions()` ekle (mock signature)
  - File: `crates/orchestrator/src/service.rs`
  - Test: approved → signing → signed

- [ ] **2.2** `process_signed_transactions()` ekle (mock broadcast)
  - File: `crates/orchestrator/src/service.rs`
  - Test: signed → broadcasting

- [ ] **2.3** `process_broadcasting_transactions()` ekle
  - File: `crates/orchestrator/src/service.rs`
  - Test: broadcasting → confirmed

- [ ] **2.4** Bitcoin client integration
  - Real broadcast to testnet
  - Confirmation polling

### Phase 3: QUIC Stream-Based Vote Broadcasting (EN SONRA)

- [ ] **3.1** Define VoteRequest/VoteResponse messages
  - File: `crates/types/src/messages.rs`
  - Add: `VoteRequest { tx_id, unsigned_tx, metadata }`
  - Add: `VoteResponse { tx_id, node_id, approve, signature }`

- [ ] **3.2** QUIC message handler ekle
  - File: `protocols/src/p2p/message_handler.rs`
  - Handle incoming VoteRequest messages
  - Route to local VoteProcessor

- [ ] **3.3** Orchestration'dan QUIC broadcast
  - File: `crates/orchestrator/src/service.rs:initiate_voting()`
  - Use: `self.session_coordinator.quic_transport().broadcast(vote_request)`
  - Collect responses via QUIC bidirectional streams

- [ ] **3.4** Node-side vote handler
  - File: Add message handler for VoteRequest
  - Validate TX → Create Vote → Send VoteResponse via QUIC
  - No HTTP endpoint needed (pure QUIC messaging)

- [ ] **3.5** Test: Automatic vote casting via QUIC
  - Create transaction → VoteRequest broadcast → Collect responses → Threshold check

### Phase 4: Cleanup

- [ ] **4.1** `collecting` state'ini kaldır (unused)
- [ ] **4.2** `submitted` state'ini kaldır veya purpose clarify et
- [ ] **4.3** `threshold_reached` → directly to `approved` (no intermediate state)
- [ ] **4.4** Documentation update
- [ ] **4.5** Integration tests

---

## 📋 PART 8: SQL Trigger Implementation

### Create File: `docker/init-db/03_triggers.sql`

```sql
-- Auto-increment votes_received when vote is inserted
CREATE OR REPLACE FUNCTION update_voting_round_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment votes_received in voting_rounds
    UPDATE voting_rounds
    SET votes_received = votes_received + 1
    WHERE tx_id = NEW.tx_id
      AND completed = false;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on votes table
CREATE TRIGGER after_vote_insert
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_voting_round_count();

-- Log trigger creation
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (3, 'Add vote count trigger', NOW());
```

### Update docker-compose to run trigger SQL:

**File:** `docker/docker-compose.yml`

Check if init scripts are mounted:

```yaml
mpc-postgres:
  volumes:
    - ./init-db:/docker-entrypoint-initdb.d  # ← Ensure this exists
```

---

## 📋 PART 9: Error Handling & Edge Cases

### Edge Case 1: Duplicate Votes

**Sorun:** Aynı node 2 kez vote atarsa?

**Çözüm:**
- PostgreSQL `UNIQUE` constraint: `(tx_id, node_id)`
- Byzantine detector double-vote detection
- Trigger sadece ilk vote'ta çalışır (UNIQUE constraint fail eder)

### Edge Case 2: Vote Timeout

**Sorun:** 30 saniye içinde threshold'a ulaşılamazsa?

**Çözüm:**
- `process_voting_transactions()` timeout kontrolü yapar
- `voting_rounds.timeout_at` check
- State → `failed`

### Edge Case 3: Byzantine Vote

**Sorun:** Invalid signature ile vote gelirse?

**Çözüm:**
- VoteProcessor.process_vote() Byzantine detector çağırır
- Rejected vote PostgreSQL'e yazılmaz
- votes_received artırılmaz

---

## 📋 PART 10: Monitoring & Observability

### Metrics to Add:

```rust
// crates/orchestrator/src/metrics.rs

lazy_static! {
    static ref VOTING_DURATION: Histogram = register_histogram!(
        "orchestration_voting_duration_seconds",
        "Time from voting start to approval"
    ).unwrap();

    static ref VOTES_RECEIVED: IntGaugeVec = register_int_gauge_vec!(
        "orchestration_votes_received",
        "Number of votes received per transaction",
        &["tx_id"]
    ).unwrap();

    static ref STATE_TRANSITIONS: IntCounterVec = register_int_counter_vec!(
        "orchestration_state_transitions_total",
        "Number of state transitions",
        &["from_state", "to_state"]
    ).unwrap();
}
```

### Logging:

```rust
// In process_voting_transactions()
info!(
    tx_id = %tx.txid,
    votes_received = round.votes_received,
    threshold = round.threshold,
    "Checking voting completion"
);
```

---

## 🎯 Priority Summary

### P0 (CRITICAL - ŞİMDİ):
1. ✅ cluster/nodes endpoint fix (COMPLETED)
2. ❌ SQL trigger (votes_received auto-increment)
3. ❌ `process_voting_transactions()` method
4. ❌ Test: 4 votes → approved transition

### P1 (HIGH - BU HAFTA):
5. ❌ `process_signing_transactions()` (mock)
6. ❌ `process_signed_transactions()` (mock)
7. ❌ Full state flow test

### P2 (MEDIUM - GELECEK HAFTA):
8. ❌ P2P vote broadcasting
9. ❌ Real MPC signing integration
10. ❌ Bitcoin testnet broadcast

### P3 (LOW - SONRA):
11. ❌ Cleanup unused states
12. ❌ Advanced Byzantine detection
13. ❌ Performance optimization

---

## 📝 Quick Start Commands

### 1. Apply SQL Trigger:

```bash
cd c:/Users/user/Desktop/MPC-WALLET/production/docker

# Create trigger file
cat > init-db/03_triggers.sql << 'EOF'
[paste SQL from PART 8]
EOF

# Restart PostgreSQL to apply
docker-compose restart mpc-postgres

# Verify trigger exists
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "\df update_voting_round_count"
```

### 2. Test Trigger:

```bash
# Insert a vote
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
INSERT INTO votes (tx_id, node_id, peer_id, vote_value, signature, created_at)
VALUES ('test_tx_123', 1, 1, true, 'sig1', NOW());
"

# Check votes_received incremented
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
SELECT tx_id, votes_received FROM voting_rounds WHERE tx_id = 'test_tx_123';
"
# Expected: votes_received = 1
```

### 3. Implement process_voting_transactions():

```bash
# Edit orchestrator service
code c:/Users/user/Desktop/MPC-WALLET/production/crates/orchestrator/src/service.rs

# Add methods from PART 3.1
# Rebuild & test
```

---

## 🔚 End of Plan

Bu plan tüm eksik özellikleri, nasıl implement edileceğini, ve test stratejisini içeriyor.

**İlk adım:** SQL trigger ekle ve test et.
**İkinci adım:** `process_voting_transactions()` implement et.
**Üçüncü adım:** End-to-end test.

Sorular için bu dokümanı referans al.
