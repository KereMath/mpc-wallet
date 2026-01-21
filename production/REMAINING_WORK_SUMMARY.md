# KALAN İŞ YÜKÜ - EKSEKUTİV ÖZET

**Tarih:** 2026-01-21
**Hedef:** Sistemi tamamen çalışır hale getirme (mock/dummy kaldırma)

---

## 🎯 ÖNCELİK SIRASI

### P0 - CRITICAL (Sistem çalışması için zorunlu)

#### 1. **DKG (Distributed Key Generation)** - 2-3 gün
```
✅ Kod var: crates/protocols/src/cggmp24/keygen.rs
❌ Entegre değil
```

**Yapılacaklar:**
- [ ] DKG orchestration service ekle (startup'ta çalışsın)
- [ ] 5 node'da senkronize DKG protokolü çalıştır
- [ ] Shared public key + key shares oluştur
- [ ] etcd'ye public key kaydet
- [ ] PostgreSQL'e encrypted key shares kaydet
- [ ] API endpoint: `POST /api/v1/dkg/initiate`
- [ ] CLI command: `mpc-cli dkg run --nodes 1,2,3,4,5`

**Dosyalar:**
- `crates/orchestrator/src/dkg_service.rs` (YENİ)
- `crates/api/src/handlers/dkg.rs` (YENİ)
- `crates/cli/src/commands/dkg.rs` (TODO kaldır: line 77)

---

#### 2. **Presignature Pool Management** - 2-3 gün
```
✅ Pool kodu var: crates/protocols/src/cggmp24/presig_pool.rs
✅ Presig generation var: crates/protocols/src/cggmp24/presignature.rs
❌ Pool boş (doldurulmuyor)
❌ Background task yok
```

**Yapılacaklar:**
- [ ] Background presignature generation task (sürekli çalışsın)
- [ ] Pool monitoring: target=100, max=150
- [ ] Auto-refill logic (pool < 50 → yeni batch üret)
- [ ] CGGMP presignature protocol: 5 node koordinasyonu
- [ ] Presig storage: PostgreSQL (encrypted) + in-memory pool
- [ ] API endpoint: `GET /api/v1/presignatures/status`
- [ ] CLI command: `mpc-cli presig status`
- [ ] Metrics: presignature_pool_size gauge

**Dosyalar:**
- `crates/orchestrator/src/presig_service.rs` (YENİ)
- `crates/api/src/handlers/presig.rs` (YENİ)
- `crates/cli/src/commands/presig.rs` (TODO kaldır: line 33)

**Performans:**
- Presig generation: ~2-3 saniye/presignature
- Paralel generation: 5 presig aynı anda
- 100 presignature: ~1-2 dakika (ilk doldurma)

---

#### 3. **CGGMP Signing Integration (MOCK KALDIR)** - 3-4 gün
```
❌ Mock signature: crates/orchestrator/src/service.rs:390-402
```

**Mevcut (KALDIRILACAK):**
```rust
let mock_signed_tx = vec![0xde, 0xad, 0xbe, 0xef, ...];
self.postgres.set_signed_transaction(&tx.txid, &mock_signed_tx).await?;
```

**Olması Gereken:**
```rust
async fn transition_approved_to_signing(&self, tx: &Transaction) -> Result<()> {
    // 1. Presignature al
    let presig = self.presig_pool.take().await
        .ok_or("Presignature pool empty")?;

    // 2. CGGMP signing session
    let signing_request = SigningRequest {
        tx_id: tx.txid.clone(),
        unsigned_tx: tx.unsigned_tx.clone(),
        presignature: presig,
    };

    let signing_session = self.session_coordinator
        .start_cggmp_signing(signing_request)
        .await?;

    // 3. QUIC broadcast: SigningRequest → all nodes
    self.session_coordinator
        .quic_transport()
        .broadcast(bincode::serialize(&signing_request)?)
        .await?;

    // 4. Collect signature shares (5 nodes, timeout: 30s)
    let signature_shares = signing_session
        .collect_shares(Duration::from_secs(30))
        .await?;

    // 5. Combine signature
    let signed_tx = signing_session
        .finalize_signature(signature_shares)
        .await?;

    // 6. Verify
    bitcoin::verify_signature(&signed_tx)?;

    // 7. Store
    self.postgres.set_signed_transaction(&tx.txid, &signed_tx).await?;
    self.postgres.update_transaction_state(&tx.txid, TransactionState::Signing).await?;

    Ok(())
}
```

**Yapılacaklar:**
- [ ] P2pSessionCoordinator'a CGGMP entegrasyonu
- [ ] SigningRequest/SigningResponse message types
- [ ] QUIC message routing: signing messages
- [ ] Node-side signing handler
- [ ] Signature share collection (with timeout)
- [ ] Signature verification
- [ ] Error handling: insufficient shares, timeout

**Dosyalar:**
- `crates/orchestrator/src/service.rs` (390-533 satırları güncelle)
- `crates/types/src/messages.rs` (SigningRequest/Response ekle)
- `protocols/src/p2p/session_coordinator.rs` (CGGMP methods ekle)
- `protocols/src/p2p/message_handler.rs` (signing handler ekle)

---

### P1 - HIGH (Önemli ama sistem çalışabilir)

#### 4. **QUIC Vote Broadcasting** - 2-3 gün
```
❌ Şu anda: Manuel vote insertion (test için)
✅ Voting threshold detection: ÇALIŞIYOR
```

**Yapılacaklar:**
- [ ] VoteRequest/VoteResponse message types
- [ ] QUIC message handler: handle_vote_request()
- [ ] Orchestration: initiate_voting() → QUIC broadcast
- [ ] Node-side: Automatic vote creation
- [ ] Vote signature (Ed25519)
- [ ] Byzantine validation in VoteProcessor

**Dosyalar:**
- `crates/types/src/messages.rs` (VoteRequest/Response)
- `protocols/src/p2p/message_handler.rs` (vote handler)
- `crates/orchestrator/src/service.rs` (initiate_voting update)

**Benefit:** Otomatik vote casting (manuel SQL insert kalkar)

---

#### 5. **Signature Verification** - 1 gün
```
❌ TODO: crates/crypto/src/lib.rs:5
```

**Yapılacaklar:**
- [ ] Ed25519 signature verification
- [ ] Vote signature verification
- [ ] Transaction signature verification

**Dosyalar:**
- `crates/crypto/src/lib.rs`

---

### P2 - MEDIUM (Nice to have)

#### 6. **mTLS Certificate Validation** - 1 gün
```
❌ TODOs: crates/network/src/quic_listener.rs (lines 157, 170, 200, 260)
```

**Yapılacaklar:**
- [ ] Extract node ID from peer TLS certificate
- [ ] Validate message sender matches authenticated node
- [ ] Close connections without valid certs

---

## 📊 TOPLAM İŞ YÜKÜ

| Öncelik | Konu | İş Yükü | Developer |
|---------|------|---------|-----------|
| P0 | 1. DKG Implementation | 2-3 gün | Dev 1 |
| P0 | 2. Presignature Pool | 2-3 gün | Dev 1 (sıralı) |
| P0 | 3. CGGMP Signing | 3-4 gün | Dev 2 (paralel) |
| P1 | 4. QUIC Vote Broadcast | 2-3 gün | Dev 2 (sıralı) |
| P1 | 5. Signature Verification | 1 gün | Dev 3 (paralel) |
| P2 | 6. mTLS Validation | 1 gün | Dev 3 (sıralı) |
| **TOPLAM** | | **11-15 gün** | |

**Tek developer:** ~3 hafta (sıralı)
**2 developer:** ~2 hafta (P0+P1 paralel)
**3 developer:** ~1.5 hafta (tüm işler paralel)

---

## 🧪 YAPILMAMIŞ TESTLER

### Test Coverage: 50% (45/90 test)

**Kritik Untested (11 test):**
1. INFRA-001: Prerequisites verification
2. INFRA-002: Certificate generation
3. NET-001: QUIC+mTLS connectivity
4. ORCH-006: Broadcasting confirmation
5. ORCH-010: Signing timeout
6. ORCH-011: Broadcasting timeout
7. ORCH-016: Graceful shutdown
8. ORCH-017: Node failure during processing
9. AUTO-001: E2E test suite
10. PERF-001: Throughput benchmark
11. PERF-002: Consensus latency

**Automated Tests (Phase 12 - 0% coverage):**
- ❌ cargo test --test cluster_setup
- ❌ cargo test --test transaction_lifecycle
- ❌ cargo test --test byzantine_scenarios
- ❌ cargo test --test fault_tolerance
- ❌ cargo test --test concurrency
- ❌ cargo test --test network_partition
- ❌ cargo test --test certificate_rotation
- ❌ cargo test --manifest-path e2e/Cargo.toml

**Test İş Yükü:** 1-2 gün (automated tests + missing manual tests)

---

## 🎯 ROADMAP

### Hafta 1: Core Crypto (P0)
**Days 1-3:** DKG Implementation
- DKG orchestration
- Key generation
- Key storage

**Days 4-6:** Presignature Pool
- Pool management
- Background generation
- Monitoring

**Day 7:** Integration testing

### Hafta 2: Signing & Broadcasting (P0+P1)
**Days 8-11:** CGGMP Signing
- Mock removal
- Real signature generation
- Verification

**Days 12-14:** QUIC Vote Broadcasting
- Message types
- Automatic voting
- Byzantine validation

### Hafta 3: Finalization (P1+P2+Testing)
**Day 15:** Signature verification
**Day 16:** mTLS validation
**Days 17-18:** Automated test suite
**Days 19-20:** Integration testing
**Day 21:** Performance tuning & final validation

---

## 📝 BAĞIMLILIKLAR

```
DKG (P0-1)
  ↓
Presignature Pool (P0-2)
  ↓
CGGMP Signing (P0-3)
  ↓
System Functional ✅

Paralel:
├─ QUIC Vote Broadcasting (P1-4)
├─ Signature Verification (P1-5)
└─ mTLS Validation (P2-6)
```

**Critical Path:** DKG → Presig Pool → CGGMP Signing (7-10 gün)

---

## 🚨 RİSKLER

### Teknik Riskler
1. **CGGMP Protocol Complexity:** 3-4 gün tahmini yeterli olmayabilir
2. **Network Timing:** QUIC message timing issues
3. **Presig Generation Speed:** Pool dolması yavaş olabilir
4. **Memory Usage:** 150 presignature = memory impact?

### Hafifletme
- Önce küçük test (2-of-3 setup) ile validate et
- Presig generation paralelize et
- Memory profiling yap
- Timeout values tune et

---

## ✅ ŞU ANDA ÇALIŞAN

**Orchestration Layer (Mock ile):**
- ✅ Voting threshold detection
- ✅ Automatic state transitions
- ✅ Timeout monitoring
- ✅ Byzantine vote detection (database constraint)
- ✅ Health checking
- ✅ Audit logging
- ✅ Fault tolerance (4/5 nodes)

**Infrastructure:**
- ✅ QUIC + mTLS transport
- ✅ 5-node cluster deployment
- ✅ PostgreSQL storage
- ✅ etcd coordination
- ✅ Docker orchestration
- ✅ API endpoints

**Test Coverage:**
- ✅ 50% manual tests completed
- ✅ Core workflows validated
- ❌ Automated tests not run

---

## 🎯 ÖNCE­Rİ: P0 COMPLETE → THEN P1 → THEN P2

**Minimum viable product:** P0 complete (7-10 gün)
**Production ready:** P0 + P1 + Testing (15-18 gün)
**Fully hardened:** P0 + P1 + P2 + Full test coverage (20-25 gün)
