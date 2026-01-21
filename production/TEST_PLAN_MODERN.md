# MPC Wallet - Kapsamlı Modern Test Planı

**Tarih**: 2026-01-21
**Versiyon**: 1.0.0
**Test Kapsamı**: %100 - Tüm sistem componentleri, edge case'ler, Byzantine senaryoları
**Hedef**: Sistemin production ortamında %100 çalışır durumda olduğunu doğrulamak

---

## 📋 Test Planı Özeti

Bu test planı aşağıdaki tüm alanları kapsar:

1. ✅ **Altyapı Testleri** (Infrastructure)
2. ✅ **Network Haberleşme Testleri** (Communication)
3. ✅ **Orchestration Services Testleri** (Transaction Automation) - **YENİ**
4. ✅ **Transaction Yaşam Döngüsü** (Lifecycle)
5. ✅ **Byzantine Fault Tolerance** (Security)
6. ✅ **Fault Recovery** (Reliability)
7. ✅ **API & CLI Testleri** (Interface)
8. ✅ **State Management** (Data Integrity)
9. ✅ **Concurrency & Race Conditions** (Performance)
10. ✅ **Edge Cases** (Boundary Testing)
11. ✅ **Performance & Stress Tests** (Load)

**Toplam Test Sayısı**: 95+ test case (20 yeni orchestration testi eklendi)
**Tahmini Süre**: 45-60 dakika

---

## 🎯 Test Hedefleri

### Başarı Kriterleri
- ✅ Tüm testlerin %100'ü başarılı
- ✅ **Orchestration servisleri çalışıyor ve transaction lifecycle otomatik ilerliyor**
- ✅ **Timeout detection çalışıyor (voting, signing, broadcasting)**
- ✅ **Health checker tüm node'ları izliyor**
- ✅ Byzantine saldırıları tespit ediliyor ve engelleniyor
- ✅ Node başarısızlıklarında sistem çalışmaya devam ediyor
- ✅ Veri bütünlüğü korunuyor (state corruption yok)
- ✅ API endpoint'leri doğru çalışıyor
- ✅ CLI komutları beklendiği gibi çalışıyor
- ✅ Performance kriterleri karşılanıyor
- ✅ **Graceful shutdown çalışıyor (orchestration services)**

### Başarısızlık Kriterleri
- ❌ Herhangi bir critical test başarısız
- ❌ State corruption tespit ediliyor
- ❌ Byzantine saldırıları tespit edilemiyor
- ❌ System recovery başarısız
- ❌ Data loss oluşuyor
- ❌ Memory leak tespit ediliyor

---

## PHASE 1: Altyapı ve Hazırlık

### 1.1 Ön Koşullar (Prerequisites)

**Test ID**: INFRA-001
**Öncelik**: CRITICAL

```bash
# Docker versiyonu kontrolü
docker --version  # >= 24.0
docker-compose --version  # >= 2.20

# Rust toolchain kontrolü
rustc --version  # >= 1.75
cargo --version

# Disk alanı kontrolü
df -h  # >= 50GB free

# Memory kontrolü
free -h  # >= 16GB
```

**Beklenen Sonuç**: Tüm versiyonlar ve kaynaklar yeterli

---

### 1.2 Certificate Generation

**Test ID**: INFRA-002
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production/scripts
bash generate-certs.sh

# Verify certificates
ls -la ../certs/
```

**Doğrulama**:
- ✅ ca.crt oluşturuldu
- ✅ node1.crt - node5.crt oluşturuldu
- ✅ node1.key - node5.key oluşturuldu (600 permissions)
- ✅ Tüm certificate'ler geçerli (verify-certs.sh)

---

### 1.3 Environment Configuration

**Test ID**: INFRA-003
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production/docker
cp .env.example .env

# Edit .env file
# - POSTGRES_PASSWORD: strong password (20+ chars)
# - CERTS_PATH: ../certs
# - THRESHOLD: 4
# - TOTAL_NODES: 5
# - BITCOIN_NETWORK: testnet
# - RUST_LOG: info
```

**Doğrulama**:
- ✅ .env file oluşturuldu
- ✅ POSTGRES_PASSWORD set edildi
- ✅ CERTS_PATH doğru
- ✅ Tüm required değişkenler set

---

### 1.4 Rust Build

**Test ID**: INFRA-004
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production
cargo build --release
```

**Doğrulama**:
- ✅ Build başarılı (0 errors, 0 warnings)
- ✅ target/release/mpc-wallet-server oluşturuldu
- ✅ 11 crate başarıyla compile edildi

**Build Süresi**: ~5-10 dakika (ilk build)

---

### 1.5 Docker Images Build

**Test ID**: INFRA-005
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production/docker
docker-compose build --no-cache
```

**Doğrulama**:
- ✅ Image build başarılı
- ✅ Image size < 500MB
- ✅ No security warnings

---

## PHASE 2: Deployment ve Startup

### 2.1 Start All Services

**Test ID**: DEPLOY-001
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production/docker
docker-compose up -d
```

**Doğrulama**:
- ✅ 9 container başladı
- ✅ No immediate crashes

---

### 2.2 Wait for Healthy Status

**Test ID**: DEPLOY-002
**Öncelik**: CRITICAL

```bash
# Wait 90 seconds
sleep 90

# Check status
docker-compose ps
```

**Beklenen Durum**:
```
NAME            STATUS              HEALTH
mpc-etcd-1      Up (healthy)       healthy
mpc-etcd-2      Up (healthy)       healthy
mpc-etcd-3      Up (healthy)       healthy
mpc-postgres    Up (healthy)       healthy
mpc-node-1      Up (healthy)       healthy
mpc-node-2      Up (healthy)       healthy
mpc-node-3      Up (healthy)       healthy
mpc-node-4      Up (healthy)       healthy
mpc-node-5      Up (healthy)       healthy
```

**Doğrulama**: Tüm 9 servis "Up (healthy)" durumunda

---

### 2.3 etcd Cluster Health

**Test ID**: DEPLOY-003
**Öncelik**: CRITICAL

```bash
# Check etcd cluster
docker exec mpc-etcd-1 etcdctl endpoint health --cluster

# Check members
docker exec mpc-etcd-1 etcdctl member list
```

**Beklenen**:
```
http://etcd-1:2379 is healthy: successfully committed proposal: took = 2.1ms
http://etcd-2:2379 is healthy: successfully committed proposal: took = 2.3ms
http://etcd-3:2379 is healthy: successfully committed proposal: took = 2.0ms
```

**Doğrulama**:
- ✅ 3 etcd node healthy
- ✅ Quorum established
- ✅ All members in "started" state

---

### 2.4 PostgreSQL Schema Verification

**Test ID**: DEPLOY-004
**Öncelik**: CRITICAL

```bash
# Check PostgreSQL connection
docker exec mpc-postgres pg_isready -U mpc

# Check tables
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "\dt"

# Count tables
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

**Beklenen**:
- ✅ PostgreSQL accepting connections
- ✅ 7 tables created:
  - transactions
  - voting_rounds
  - votes
  - byzantine_violations
  - presignature_usage
  - node_status
  - audit_log

**Doğrulama**: Her tablo doğru column count ile oluşturulmuş

---

### 2.5 All Nodes Health Check

**Test ID**: DEPLOY-005
**Öncelik**: CRITICAL

```bash
# Test all 5 nodes
for i in {1..5}; do
  echo "Testing Node $i:"
  curl -s http://localhost:808$i/health | jq
  echo ""
done
```

**Beklenen Yanıt** (her node için):
```json
{
  "status": "healthy",
  "timestamp": "2026-01-21T...",
  "version": "0.1.0"
}
```

**Doğrulama**: Tüm 5 node healthy response dönüyor

---

## PHASE 3: Network Communication Tests

### 3.1 QUIC+mTLS Connection Test

**Test ID**: NETWORK-001
**Öncelik**: HIGH

```bash
# Check node logs for QUIC connections
docker-compose logs node-1 | grep -i "quic"
docker-compose logs node-1 | grep -i "connection established"

# Verify mTLS handshake
docker-compose logs node-1 | grep -i "tls"
docker-compose logs node-1 | grep -i "certificate"
```

**Doğrulama**:
- ✅ QUIC connections established to all peers
- ✅ mTLS handshake successful
- ✅ Certificate validation passed
- ✅ No connection errors

---

### 3.2 Cluster Node Discovery

**Test ID**: NETWORK-002
**Öncelik**: HIGH

```bash
# Query cluster nodes from each node
for i in {1..5}; do
  echo "Node $i perspective:"
  curl -s http://localhost:808$i/api/v1/cluster/nodes | jq
done
```

**Beklenen**:
- ✅ Her node diğer 4 node'u görüyor
- ✅ total_nodes: 5
- ✅ online_nodes: 5
- ✅ threshold: 4

---

### 3.3 etcd Communication Test

**Test ID**: NETWORK-003
**Öncelik**: MEDIUM

```bash
# Write test value to etcd
docker exec mpc-etcd-1 etcdctl put /test/key "test-value"

# Read from different etcd node
docker exec mpc-etcd-2 etcdctl get /test/key

# Delete test key
docker exec mpc-etcd-1 etcdctl del /test/key
```

**Doğrulama**:
- ✅ Write successful
- ✅ Read from different node successful
- ✅ Data consistent across cluster

---

## PHASE 3.5: Orchestration Services Tests

### 3.5.1 Orchestration Service Startup Verification

**Test ID**: ORCH-001
**Öncelik**: CRITICAL

```bash
# Check orchestration service logs for successful startup
docker-compose logs node-1 | grep -i "orchestration"
docker-compose logs node-1 | grep "Starting transaction lifecycle orchestration service"
docker-compose logs node-1 | grep "Orchestration service started"

# Verify all 3 services started
docker-compose logs node-1 | grep "Health checker started"
docker-compose logs node-1 | grep "Timeout monitor started"
```

**Doğrulama**:
- ✅ OrchestrationService başladı
- ✅ TimeoutMonitor başladı
- ✅ HealthChecker başladı
- ✅ No startup errors
- ✅ Orchestration enabled in logs

---

### 3.5.2 Orchestration Configuration Verification

**Test ID**: ORCH-002
**Öncelik**: HIGH

```bash
# Check orchestration environment variables
docker exec mpc-node-1 env | grep ORCHESTRATION
docker exec mpc-node-1 env | grep NODE_ENDPOINTS

# Verify configuration in logs
docker-compose logs node-1 | grep "Orchestration: enabled"
docker-compose logs node-1 | grep "Server configuration:"
```

**Beklenen**:
- ✅ ENABLE_ORCHESTRATION=true
- ✅ NODE_ENDPOINTS configured for all 5 nodes
- ✅ Polling interval: 5 seconds (default)
- ✅ Timeouts configured: voting(60s), signing(120s), broadcasting(300s)

---

### 3.5.3 OrchestrationService Lifecycle - Pending to Voting

**Test ID**: ORCH-003
**Öncelik**: CRITICAL

```bash
# Submit transaction
RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 25000,
    "metadata": "Orchestration Test - Pending to Voting"
  }')

TX_ID=$(echo $RESPONSE | jq -r '.txid')
echo "Transaction ID: $TX_ID"

# Watch state transition from pending to voting
for i in {1..10}; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  echo "Check $i: State = $STATE"

  if [ "$STATE" = "voting" ]; then
    echo "✅ Orchestration detected pending transaction and initiated voting"
    break
  fi
  sleep 2
done

# Verify voting round created
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT id, tx_id, round_number, total_nodes, threshold
  FROM voting_rounds
  WHERE tx_id = '$TX_ID';
"
```

**Doğrulama**:
- ✅ Transaction automatically transitioned from "pending" to "voting"
- ✅ Transition happened within 10 seconds (2x poll interval)
- ✅ Voting round created in PostgreSQL
- ✅ total_nodes=5, threshold=4 in voting round
- ✅ Orchestration logs show "Initiated voting for transaction"

---

### 3.5.4 OrchestrationService Lifecycle - Threshold to Signing

**Test ID**: ORCH-004
**Öncelik**: CRITICAL

```bash
# Continue monitoring the transaction from ORCH-003
TX_ID="<txid-from-ORCH-003>"

# Wait for threshold_reached state
for i in {1..30}; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  echo "Check $i: State = $STATE"

  if [ "$STATE" = "threshold_reached" ]; then
    echo "✅ Threshold reached, waiting for signing initiation..."
  fi

  if [ "$STATE" = "signing" ]; then
    echo "✅ Orchestration initiated signing"
    break
  fi

  sleep 2
done

# Check orchestration logs
docker-compose logs node-1 | grep "Initiated signing for transaction: $TX_ID"

# Verify FSM state transition
docker-compose logs node-1 | grep "mark_submitted" | grep "$TX_ID"
```

**Doğrulama**:
- ✅ Orchestration detected "threshold_reached" state
- ✅ Automatically transitioned to "signing" state
- ✅ VoteProcessor.mark_submitted() called
- ✅ Transition completed within poll interval
- ✅ Logs show "Initiated signing for transaction"

---

### 3.5.5 OrchestrationService Lifecycle - Signed to Broadcasting

**Test ID**: ORCH-005
**Öncelik**: CRITICAL

```bash
# Continue monitoring the transaction
TX_ID="<txid-from-ORCH-003>"

# Wait for signed state and broadcasting
for i in {1..40}; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  echo "Check $i: State = $STATE"

  if [ "$STATE" = "signed" ]; then
    echo "✅ Transaction signed, waiting for broadcasting..."
  fi

  if [ "$STATE" = "broadcasting" ]; then
    echo "✅ Orchestration broadcasted transaction"

    # Get Bitcoin txid
    BTC_TXID=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.bitcoin_txid // .txid')
    echo "Bitcoin TXID: $BTC_TXID"
    break
  fi

  sleep 2
done

# Check orchestration logs for broadcasting
docker-compose logs node-1 | grep "Broadcasted transaction" | grep "$TX_ID"
```

**Doğrulama**:
- ✅ Orchestration detected "signed" state
- ✅ Retrieved signed transaction bytes from PostgreSQL
- ✅ Called BitcoinClient.broadcast_transaction()
- ✅ Updated transaction state to "broadcasting"
- ✅ Bitcoin TXID recorded in database
- ✅ Logs show "Broadcasted transaction" with Bitcoin TXID

---

### 3.5.6 OrchestrationService Lifecycle - Confirmation Monitoring

**Test ID**: ORCH-006
**Öncelik**: HIGH

```bash
# Continue monitoring the transaction
TX_ID="<txid-from-ORCH-003>"

# Monitor for confirmation detection
# NOTE: On testnet this may take time, on mock Bitcoin this should be fast
for i in {1..60}; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  CONFIRMATIONS=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.confirmations // 0')

  echo "Check $i: State = $STATE, Confirmations = $CONFIRMATIONS"

  if [ "$STATE" = "confirmed" ]; then
    echo "✅ Orchestration detected confirmation"
    break
  fi

  sleep 5
done

# Check orchestration logs
docker-compose logs node-1 | grep "confirmed with" | grep "$TX_ID"

# Verify VoteProcessor state
docker-compose logs node-1 | grep "mark_confirmed" | grep "$TX_ID"
```

**Doğrulama**:
- ✅ Orchestration polled Bitcoin for confirmations
- ✅ Detected confirmations >= 1
- ✅ Updated transaction state to "confirmed"
- ✅ Called VoteProcessor.mark_confirmed()
- ✅ Confirmation count updated in database
- ✅ Logs show "Transaction confirmed with X confirmations"

**Note**: If using testnet Bitcoin, this test may timeout. Verify monitoring logic works by checking logs.

---

### 3.5.7 Multiple Concurrent Transactions with Orchestration

**Test ID**: ORCH-007
**Öncelik**: HIGH

```bash
# Submit 5 transactions concurrently
echo "Submitting 5 concurrent transactions..."

for i in {1..5}; do
  curl -s -X POST http://localhost:8081/api/v1/transactions \
    -H "Content-Type: application/json" \
    -d "{
      \"recipient\": \"tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx\",
      \"amount_sats\": $((15000 + i * 1000)),
      \"metadata\": \"Concurrent Orchestration Test $i\"
    }" | jq -r '.txid' >> /tmp/concurrent_txids.txt &
done
wait

# Wait for orchestration to process all
sleep 30

# Check states of all concurrent transactions
echo "Checking states of concurrent transactions:"
while read TX_ID; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  echo "TX $TX_ID: $STATE"
done < /tmp/concurrent_txids.txt

# Verify no orchestration errors
docker-compose logs node-1 | grep -i "error processing"
```

**Doğrulama**:
- ✅ All 5 transactions processed by orchestration
- ✅ Each transaction progressed through states independently
- ✅ No race conditions in orchestration
- ✅ No "error processing" in logs
- ✅ All transactions in "approved" or later state

---

### 3.5.8 Orchestration Error Handling - Invalid State

**Test ID**: ORCH-008
**Öncelik**: HIGH

```bash
# Manually corrupt a transaction state to test error handling
TX_ID=$(docker exec mpc-postgres psql -U mpc -d mpc_wallet -t -c "
  SELECT txid FROM transactions WHERE state = 'pending' LIMIT 1;
" | tr -d ' ')

echo "Testing with TX: $TX_ID"

# Manually set to threshold_reached without FSM state
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  UPDATE transactions SET state = 'threshold_reached' WHERE txid = '$TX_ID';
"

# Wait for orchestration to attempt signing
sleep 10

# Check orchestration logs for error handling
docker-compose logs node-1 | grep "Failed to initiate signing" | grep "$TX_ID"
docker-compose logs node-1 | grep "FSM not found" | grep "$TX_ID"

# Verify transaction not corrupted
STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
echo "Final state: $STATE"
```

**Doğrulama**:
- ✅ Orchestration detected invalid FSM state
- ✅ Error logged: "Failed to initiate signing"
- ✅ Transaction not corrupted (remains in threshold_reached)
- ✅ Orchestration continued processing other transactions
- ✅ No panic or crash

---

### 3.5.9 TimeoutMonitor - Voting Timeout Detection

**Test ID**: ORCH-009
**Öncelik**: CRITICAL

```bash
# Create transaction but block voting to trigger timeout
# First, stop 2 nodes to prevent threshold from being reached
docker-compose stop node-4 node-5

# Submit transaction
RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 12000,
    "metadata": "Voting Timeout Test"
  }')

TX_ID=$(echo $RESPONSE | jq -r '.txid')
echo "Transaction ID: $TX_ID"

# Wait for transaction to enter voting
sleep 15

# Verify it's stuck in voting state
STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
echo "State before timeout: $STATE"

# Wait for voting timeout (60 seconds + poll interval)
echo "Waiting 70 seconds for voting timeout..."
sleep 70

# Check if timeout monitor detected and marked as failed
STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
echo "State after timeout: $STATE"

# Check timeout monitor logs
docker-compose logs node-1 | grep "voting timeout" | grep "$TX_ID"

# Check audit log
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT event_type, details
  FROM audit_log
  WHERE tx_id = '$TX_ID' AND event_type = 'voting_timeout';
"

# Restart nodes
docker-compose start node-4 node-5
sleep 30
```

**Doğrulama**:
- ✅ Transaction stuck in "voting" state for >60 seconds
- ✅ TimeoutMonitor detected timeout
- ✅ Transaction state changed to "failed"
- ✅ Audit event logged with type "voting_timeout"
- ✅ Logs show "Transaction voting timeout after X seconds"
- ✅ Timeout monitor continued monitoring other transactions

---

### 3.5.10 TimeoutMonitor - Signing Timeout Detection

**Test ID**: ORCH-010
**Öncelik**: HIGH

```bash
# Manually create a transaction in signing state
TX_ID="timeout-signing-test-$(date +%s)"

docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  INSERT INTO transactions (txid, state, recipient, amount_sats, fee_sats, created_at, updated_at)
  VALUES ('$TX_ID', 'signing', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 10000, 500, NOW() - INTERVAL '125 seconds', NOW() - INTERVAL '125 seconds');
"

echo "Created test transaction in signing state: $TX_ID"

# Wait for timeout monitor to detect (runs every 10 seconds)
sleep 15

# Check if marked as failed
STATE=$(docker exec mpc-postgres psql -U mpc -d mpc_wallet -t -c "
  SELECT state FROM transactions WHERE txid = '$TX_ID';
" | tr -d ' ')

echo "State after timeout detection: $STATE"

# Check logs
docker-compose logs node-1 | grep "signing timeout" | grep "$TX_ID"

# Check audit log
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT event_type, details
  FROM audit_log
  WHERE tx_id = '$TX_ID' AND event_type = 'signing_timeout';
"
```

**Doğrulama**:
- ✅ Transaction in "signing" state for >120 seconds
- ✅ TimeoutMonitor detected signing timeout
- ✅ State changed to "failed"
- ✅ Audit event "signing_timeout" recorded
- ✅ Logs show "Transaction signing timeout after X seconds"

---

### 3.5.11 TimeoutMonitor - Broadcasting Timeout Detection

**Test ID**: ORCH-011
**Öncelik**: HIGH

```bash
# Manually create a transaction in broadcasting state
TX_ID="timeout-broadcasting-test-$(date +%s)"

docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  INSERT INTO transactions (txid, state, recipient, amount_sats, fee_sats, signed_tx, created_at, updated_at)
  VALUES ('$TX_ID', 'broadcasting', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 10000, 500,
          decode('deadbeef', 'hex'), NOW() - INTERVAL '305 seconds', NOW() - INTERVAL '305 seconds');
"

echo "Created test transaction in broadcasting state: $TX_ID"

# Wait for timeout monitor to detect
sleep 15

# Check if marked as failed
STATE=$(docker exec mpc-postgres psql -U mpc -d mpc_wallet -t -c "
  SELECT state FROM transactions WHERE txid = '$TX_ID';
" | tr -d ' ')

echo "State after timeout detection: $STATE"

# Check logs
docker-compose logs node-1 | grep "broadcasting timeout" | grep "$TX_ID"

# Check audit log
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT event_type, details
  FROM audit_log
  WHERE tx_id = '$TX_ID' AND event_type = 'broadcasting_timeout';
"
```

**Doğrulama**:
- ✅ Transaction in "broadcasting" state for >300 seconds
- ✅ TimeoutMonitor detected broadcasting timeout
- ✅ State changed to "failed"
- ✅ Audit event "broadcasting_timeout" recorded
- ✅ Logs show "Transaction broadcasting timeout after X seconds"

---

### 3.5.12 TimeoutMonitor - Timer Accuracy

**Test ID**: ORCH-012
**Öncelik**: MEDIUM

```bash
# Test that timeout monitor tracks state entry times accurately
# Submit transaction and track timing
START=$(date +%s)

RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 8000,
    "metadata": "Timer Accuracy Test"
  }')

TX_ID=$(echo $RESPONSE | jq -r '.txid')

# Wait for voting state
for i in {1..10}; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  if [ "$STATE" = "voting" ]; then
    VOTING_ENTERED=$(date +%s)
    echo "Entered voting at: $VOTING_ENTERED"
    break
  fi
  sleep 1
done

# Check TimeoutMonitor internal timer by examining logs
# The monitor should track when transaction entered voting state
sleep 5
docker-compose logs node-1 | grep "record_state_transition" | grep "$TX_ID"
```

**Doğrulama**:
- ✅ TimeoutMonitor records state transition timestamp
- ✅ Timer starts when state entered
- ✅ Elapsed time calculation accurate
- ✅ No timer drift over multiple checks

---

### 3.5.13 HealthChecker - Node Health Monitoring

**Test ID**: ORCH-013
**Öncelik**: HIGH

```bash
# Check health checker logs
docker-compose logs node-1 | grep "Health checker started"
docker-compose logs node-1 | grep "health check"

# Verify health checker is polling all nodes
docker-compose logs node-1 | grep -E "node-[1-5]" | grep "health"

# Check etcd for health status
docker exec mpc-etcd-1 etcdctl get /mpc/health/ --prefix

# Stop one node to test health detection
docker-compose stop node-5
sleep 20

# Check if health checker detected failure
docker-compose logs node-1 | grep "node-5" | grep -i "unhealthy\|failed\|error"

# Check consecutive failure tracking
docker-compose logs node-1 | grep "consecutive failures"

# Restart node
docker-compose start node-5
sleep 30

# Verify health recovered
docker-compose logs node-1 | grep "node-5" | grep -i "recovered\|healthy"
```

**Doğrulama**:
- ✅ HealthChecker started successfully
- ✅ Polling all 5 nodes every 15 seconds
- ✅ Detected node-5 failure
- ✅ Consecutive failure count incremented
- ✅ Detected node-5 recovery
- ✅ Health status stored in etcd

---

### 3.5.14 HealthChecker - HTTP Endpoint Checks

**Test ID**: ORCH-014
**Öncelik**: MEDIUM

```bash
# Verify health checker is making HTTP requests
docker-compose logs node-1 | grep "GET /health"
docker-compose logs node-1 | grep "health endpoint"

# Check latency measurement
docker-compose logs node-1 | grep "latency" | grep "ms"

# Verify all endpoints configured
echo "Configured health endpoints:"
docker exec mpc-node-1 env | grep NODE_ENDPOINTS
```

**Doğrulama**:
- ✅ HTTP GET requests to /health endpoints
- ✅ Response latency measured
- ✅ All 5 node endpoints configured
- ✅ Endpoints in format: http://mpc-node-X:8080

---

### 3.5.15 Expired Transaction Cleanup

**Test ID**: ORCH-015
**Öncelik**: HIGH

```bash
# Create old transaction that should be cleaned up
TX_ID="expired-test-$(date +%s)"

docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  INSERT INTO transactions (txid, state, recipient, amount_sats, fee_sats, created_at, updated_at)
  VALUES ('$TX_ID', 'voting', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 5000, 300,
          NOW() - INTERVAL '65 minutes', NOW() - INTERVAL '65 minutes');
"

echo "Created expired transaction (>1 hour old): $TX_ID"

# Wait for orchestration cleanup (happens in main poll loop)
sleep 15

# Check if marked as failed
STATE=$(docker exec mpc-postgres psql -U mpc -d mpc_wallet -t -c "
  SELECT state FROM transactions WHERE txid = '$TX_ID';
" | tr -d ' ')

echo "State after cleanup: $STATE"

# Check audit log
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT event_type, details
  FROM audit_log
  WHERE tx_id = '$TX_ID' AND event_type = 'timeout';
"

# Check orchestration logs
docker-compose logs node-1 | grep "expired" | grep "$TX_ID"
```

**Doğrulama**:
- ✅ Transaction older than 1 hour detected
- ✅ State changed to "failed"
- ✅ Audit event logged with type "timeout"
- ✅ Details: "Transaction expired after 1 hour"
- ✅ Logs show "Transaction expired, marking as failed"

---

### 3.5.16 Orchestration Graceful Shutdown

**Test ID**: ORCH-016
**Öncelik**: HIGH

```bash
# Trigger graceful shutdown of node-1
docker-compose stop node-1

# Check logs for graceful shutdown sequence
docker-compose logs node-1 | tail -50

# Should see:
# - "Shutdown signal received"
# - "Shutting down orchestration services..."
# - "Orchestration service shutting down gracefully"
# - "Timeout monitor shutdown requested"
# - "Health checker shutdown requested"
# - "Orchestration service stopped"
# - "Timeout monitor stopped"
# - "Health checker stopped"
# - "Shutdown complete"

# Restart node
docker-compose start node-1
sleep 60

# Verify orchestration restarted
docker-compose logs node-1 | grep "Starting transaction lifecycle orchestration service"
```

**Doğrulama**:
- ✅ Graceful shutdown signal received
- ✅ All 3 services shutdown requested
- ✅ Services stopped within 10-second timeout
- ✅ No "shutdown timed out" warnings
- ✅ API server stopped cleanly
- ✅ Node restarted successfully
- ✅ Orchestration services restarted

---

### 3.5.17 Orchestration with Node Failures During Processing

**Test ID**: ORCH-017
**Öncelik**: CRITICAL

```bash
# Submit transaction
RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 18000,
    "metadata": "Orchestration Node Failure Test"
  }')

TX_ID=$(echo $RESPONSE | jq -r '.txid')
echo "Transaction ID: $TX_ID"

# Wait for voting state
sleep 10

# Kill a node while transaction is being processed
docker-compose stop node-4

# Continue monitoring transaction
for i in {1..30}; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  echo "Check $i: State = $STATE"

  if [ "$STATE" = "approved" ] || [ "$STATE" = "signing" ]; then
    echo "✅ Orchestration continued despite node failure"
    break
  fi
  sleep 2
done

# Restart node
docker-compose start node-4
```

**Doğrulama**:
- ✅ Orchestration continued processing with 4 nodes
- ✅ Transaction reached consensus (4-of-4 threshold)
- ✅ No orchestration errors or panics
- ✅ Transaction completed lifecycle successfully
- ✅ System recovered when node restarted

---

### 3.5.18 Orchestration Performance - Poll Interval Compliance

**Test ID**: ORCH-018
**Öncelik**: MEDIUM

```bash
# Measure orchestration poll interval by monitoring logs
echo "Monitoring orchestration poll cycles..."

# Capture timestamps of poll cycles
docker-compose logs -f node-1 | grep "Processing.*transactions" | while read line; do
  echo "$(date +%s): $line"
done &

MONITOR_PID=$!
sleep 30
kill $MONITOR_PID

# Analyze poll intervals (should be ~5 seconds)
```

**Doğrulama**:
- ✅ Poll interval approximately 5 seconds
- ✅ Consistent polling frequency
- ✅ No missed poll cycles
- ✅ CPU usage reasonable (<10% average)

---

### 3.5.19 Complete Transaction Lifecycle End-to-End with Orchestration

**Test ID**: ORCH-019
**Öncelik**: CRITICAL

```bash
# Full end-to-end test measuring total time
echo "=== COMPLETE ORCHESTRATION E2E TEST ==="
START=$(date +%s)

# Submit transaction
RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 30000,
    "metadata": "Complete Orchestration E2E Test"
  }')

TX_ID=$(echo $RESPONSE | jq -r '.txid')
echo "Transaction ID: $TX_ID"
echo "Tracking complete lifecycle..."

# Track all state transitions
PREV_STATE="pending"
while true; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  CURRENT=$(date +%s)
  ELAPSED=$((CURRENT - START))

  if [ "$STATE" != "$PREV_STATE" ]; then
    echo "[$ELAPSED s] State transition: $PREV_STATE → $STATE"
    PREV_STATE=$STATE
  fi

  if [ "$STATE" = "confirmed" ] || [ "$STATE" = "failed" ]; then
    break
  fi

  if [ $ELAPSED -gt 180 ]; then
    echo "⚠️ Test timeout after 180 seconds"
    break
  fi

  sleep 2
done

END=$(date +%s)
TOTAL_TIME=$((END - START))

echo ""
echo "=== ORCHESTRATION E2E RESULTS ==="
echo "Total Time: $TOTAL_TIME seconds"
echo "Final State: $STATE"

# Get full transaction history
curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq

# Get audit log
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT event_type, timestamp
  FROM audit_log
  WHERE tx_id = '$TX_ID'
  ORDER BY timestamp;
"
```

**Doğrulama**:
- ✅ Transaction automatically progressed through all states:
  - pending → voting → collecting → threshold_reached → approved → signing → signed → broadcasting → confirmed
- ✅ All transitions orchestrated automatically (no manual intervention)
- ✅ Total time < 180 seconds for full lifecycle
- ✅ No errors in orchestration logs
- ✅ All audit events recorded
- ✅ Final state: "confirmed" or "broadcasting"

**Expected State Flow**:
1. **pending** (0s) - Initial state after API submission
2. **voting** (5-10s) - OrchestrationService detected pending, initiated voting
3. **collecting** (10-15s) - Votes being collected
4. **threshold_reached** (15-20s) - 4+ votes received
5. **approved** (20-25s) - VoteProcessor approved
6. **signing** (25-30s) - OrchestrationService initiated signing
7. **signed** (30-40s) - MPC signing completed
8. **broadcasting** (40-45s) - OrchestrationService broadcasted to Bitcoin
9. **confirmed** (45s+) - OrchestrationService detected blockchain confirmation

---

### 3.5.20 Orchestration Logging and Observability

**Test ID**: ORCH-020
**Öncelik**: MEDIUM

```bash
# Verify structured logging from orchestration services
echo "Checking orchestration logs..."

# OrchestrationService logs
docker-compose logs node-1 | grep "OrchestrationService" | head -20

# TimeoutMonitor logs
docker-compose logs node-1 | grep "TimeoutMonitor\|timeout monitor" | head -20

# HealthChecker logs
docker-compose logs node-1 | grep "HealthChecker\|health checker" | head -20

# Check for required log levels
docker-compose logs node-1 | grep -E "INFO|WARN|ERROR" | grep orchestrat

# Verify JSON structured logging
docker-compose logs node-1 --no-color | grep orchestrat | head -5
```

**Doğrulama**:
- ✅ All orchestration services log startup
- ✅ Structured JSON logs present
- ✅ Log levels appropriate (INFO for normal, WARN for timeouts, ERROR for failures)
- ✅ Transaction IDs included in relevant logs
- ✅ Timestamps accurate
- ✅ No sensitive data in logs

---

## PHASE 4: Transaction Lifecycle Tests

### 4.1 Create Transaction (Basic)

**Test ID**: TX-001
**Öncelik**: CRITICAL

```bash
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 50000,
    "metadata": "Test TX-001"
  }' | jq
```

**Beklenen Response**:
```json
{
  "txid": "...",
  "state": "pending",
  "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
  "amount_sats": 50000,
  "fee_sats": 690,
  "metadata": "Test TX-001",
  "created_at": "2026-01-21T..."
}
```

**Doğrulama**:
- ✅ HTTP 201 Created
- ✅ txid generated
- ✅ state = "pending"
- ✅ fee calculated

**Save txid for next tests**: `TX_ID_1=<txid>`

---

### 4.2 Transaction State Progression

**Test ID**: TX-002
**Öncelik**: CRITICAL

```bash
# Query transaction state every 2 seconds
TX_ID="<txid-from-TX-001>"

for i in {1..10}; do
  echo "Check $i:"
  curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq '.state'
  sleep 2
done
```

**Beklenen State Geçişleri**:
1. pending → voting
2. voting → collecting
3. collecting → threshold_reached
4. threshold_reached → approved
5. approved → signing
6. signing → signed

**Doğrulama**:
- ✅ State machine düzgün çalışıyor
- ✅ Hiçbir state atlanmıyor
- ✅ Invalid state transition yok

---

### 4.3 Vote Propagation Verification

**Test ID**: TX-003
**Öncelik**: CRITICAL

```bash
# Check votes in PostgreSQL
TX_ID="<txid-from-TX-001>"

docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT v.node_id, v.approve, v.received_at
  FROM votes v
  JOIN voting_rounds vr ON v.round_id = vr.id
  WHERE vr.tx_id = '$TX_ID'
  ORDER BY v.node_id;
"
```

**Beklenen**:
- ✅ At least 4 votes recorded (threshold)
- ✅ Each vote from different node
- ✅ All votes have signatures
- ✅ Votes within reasonable time (< 5 seconds)

---

### 4.4 Transaction Visibility Across Nodes

**Test ID**: TX-004
**Öncelik**: HIGH

```bash
TX_ID="<txid-from-TX-001>"

# Query from all nodes
for i in {1..5}; do
  echo "Node $i:"
  curl -s http://localhost:808$i/api/v1/transactions/$TX_ID | jq '.state'
done
```

**Doğrulama**:
- ✅ Tüm 5 node aynı transaction'ı görüyor
- ✅ Tüm node'larda aynı state
- ✅ Data consistency sağlanmış

---

### 4.5 Audit Log Verification

**Test ID**: TX-005
**Öncelik**: MEDIUM

```bash
TX_ID="<txid-from-TX-001>"

# Check audit log for state transitions
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT event_type,
         details->>'old_state' as old_state,
         details->>'new_state' as new_state,
         timestamp
  FROM audit_log
  WHERE tx_id = '$TX_ID'
    AND event_type = 'transaction_state_change'
  ORDER BY timestamp;
"
```

**Doğrulama**:
- ✅ Her state geçişi loglandı
- ✅ Timestamps doğru sırada
- ✅ Old_state ve new_state doğru

---

## PHASE 5: Byzantine Fault Tolerance Tests

### 5.1 Normal Operation Baseline

**Test ID**: BYZANTINE-001
**Öncelik**: CRITICAL

```bash
# Submit normal transaction
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 30000,
    "metadata": "Baseline Byzantine Test"
  }' | jq

# Wait for completion
sleep 10

# Check no violations
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "SELECT count(*) FROM byzantine_violations;"
```

**Beklenen**: 0 violations

---

### 5.2 Byzantine Detection (Automated Test)

**Test ID**: BYZANTINE-002
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production

# Run Byzantine test suite
cargo test --test byzantine_scenarios test_double_vote_detection -- --ignored --nocapture
```

**Doğrulama**:
- ✅ Double-vote tespit edildi
- ✅ Byzantine violation kaydedildi
- ✅ Malicious node banned
- ✅ Cluster çalışmaya devam etti

---

### 5.3 Byzantine Violation Database Check

**Test ID**: BYZANTINE-003
**Öncelik**: HIGH

```bash
# Check Byzantine violations table
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT id, node_id, violation_type, detected_at, evidence
  FROM byzantine_violations
  ORDER BY detected_at DESC
  LIMIT 5;
"
```

**Doğrulama**:
- ✅ Violation_type doğru
- ✅ Evidence JSONB olarak kaydedilmiş
- ✅ Node_id correct
- ✅ Detected_at timestamp reasonable

---

### 5.4 Auto-Ban Mechanism

**Test ID**: BYZANTINE-004
**Öncelik**: HIGH

```bash
# Check node_status for banned nodes
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT node_id, status, total_violations, banned_until
  FROM node_status
  WHERE status = 'banned' OR total_violations > 0;
"
```

**Doğrulama**:
- ✅ Malicious node status = 'banned'
- ✅ banned_until = NOW() + 24 hours
- ✅ total_violations >= 1

---

### 5.5 Cluster Recovery After Byzantine Attack

**Test ID**: BYZANTINE-005
**Öncelik**: CRITICAL

```bash
# Submit new transaction after Byzantine attack
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 25000,
    "metadata": "Post-Byzantine Recovery Test"
  }' | jq

# Wait and check state
sleep 10
curl -s http://localhost:8081/api/v1/transactions/<new-txid> | jq '.state'
```

**Doğrulama**:
- ✅ Yeni transaction accepted
- ✅ Consensus reached with remaining honest nodes
- ✅ State = "approved" or later

---

## PHASE 6: Fault Tolerance & Recovery Tests

### 6.1 Kill One Node

**Test ID**: FAULT-001
**Öncelik**: CRITICAL

```bash
# Kill node-5
docker-compose stop node-5

# Verify cluster status
curl -s http://localhost:8081/api/v1/cluster/status | jq
```

**Beklenen**:
- ✅ Cluster still healthy
- ✅ online_nodes: 4
- ✅ threshold: 4
- ✅ consensus_reached: true

---

### 6.2 Transaction with 4 Nodes

**Test ID**: FAULT-002
**Öncelik**: CRITICAL

```bash
# Submit transaction with only 4 nodes
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 20000,
    "metadata": "4-node cluster test"
  }' | jq

# Wait for consensus
sleep 10

# Check state
curl -s http://localhost:8081/api/v1/transactions/<txid> | jq '.state'
```

**Doğrulama**:
- ✅ Transaction accepted
- ✅ Consensus reached with 4 nodes (4-of-4)
- ✅ State = "approved" or later

---

### 6.3 Restart Node

**Test ID**: FAULT-003
**Öncelik**: HIGH

```bash
# Restart node-5
docker-compose start node-5

# Wait for health
sleep 60

# Check health
curl -s http://localhost:8085/health | jq
```

**Doğrulama**:
- ✅ Node başladı
- ✅ Health check passed
- ✅ < 60 seconds recovery time

---

### 6.4 Node State Sync After Recovery

**Test ID**: FAULT-004
**Öncelik**: HIGH

```bash
# Check if recovered node sees all transactions
curl -s http://localhost:8085/api/v1/transactions | jq 'length'

# Compare with other nodes
curl -s http://localhost:8081/api/v1/transactions | jq 'length'
```

**Doğrulama**:
- ✅ Recovered node sees all transactions
- ✅ Transaction count matches other nodes
- ✅ State synchronized

---

### 6.5 Kill Two Nodes Simultaneously

**Test ID**: FAULT-005
**Öncelik**: HIGH

```bash
# Kill 2 nodes (still above threshold: 3 remaining)
docker-compose stop node-4 node-5

# Check cluster
curl -s http://localhost:8081/api/v1/cluster/status | jq

# Try transaction
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 15000,
    "metadata": "3-node test"
  }' | jq
```

**Beklenen**:
- ❌ Transaction SHOULD FAIL (3 nodes < threshold 4)
- ✅ Cluster detects insufficient nodes
- ✅ No state corruption

---

### 6.6 Rapid Node Restarts

**Test ID**: FAULT-006
**Öncelik**: MEDIUM

```bash
# Restart all nodes quickly
docker-compose restart node-4 node-5
sleep 90

# Verify cluster healthy
curl -s http://localhost:8081/api/v1/cluster/status | jq

# Test transaction
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 18000,
    "metadata": "Post-rapid-restart test"
  }' | jq
```

**Doğrulama**:
- ✅ Cluster recovered
- ✅ All nodes healthy
- ✅ Transaction successful

---

## PHASE 7: API & CLI Tests

### 7.1 GET /health

**Test ID**: API-001
**Öncelik**: HIGH

```bash
for i in {1..5}; do
  curl -s http://localhost:808$i/health | jq
done
```

**Doğrulama**: Tüm node'lar healthy response

---

### 7.2 GET /api/v1/wallet/balance

**Test ID**: API-002
**Öncelik**: HIGH

```bash
curl -s http://localhost:8081/api/v1/wallet/balance | jq
```

**Beklenen**:
```json
{
  "confirmed_balance_sats": 0,
  "unconfirmed_balance_sats": 0,
  "total_balance_sats": 0
}
```

---

### 7.3 GET /api/v1/wallet/address

**Test ID**: API-003
**Öncelik**: HIGH

```bash
curl -s http://localhost:8081/api/v1/wallet/address | jq
```

**Beklenen**:
```json
{
  "address": "tb1q...",
  "type": "p2wpkh" or "p2tr"
}
```

---

### 7.4 GET /api/v1/cluster/status

**Test ID**: API-004
**Öncelik**: HIGH

```bash
curl -s http://localhost:8081/api/v1/cluster/status | jq
```

**Beklenen**:
```json
{
  "healthy": true,
  "total_nodes": 5,
  "online_nodes": 5,
  "threshold": 4,
  "consensus_reached": true
}
```

---

### 7.5 GET /api/v1/cluster/nodes

**Test ID**: API-005
**Öncelik**: HIGH

```bash
curl -s http://localhost:8081/api/v1/cluster/nodes | jq
```

**Beklenen**: 5 node listesi

---

### 7.6 GET /api/v1/transactions (List)

**Test ID**: API-006
**Öncelik**: HIGH

```bash
curl -s http://localhost:8081/api/v1/transactions | jq
```

**Doğrulama**: Önceki testlerdeki tüm transaction'lar listeleniyor

---

### 7.7 GET /api/v1/transactions/:txid

**Test ID**: API-007
**Öncelik**: HIGH

```bash
TX_ID="<any-txid>"
curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq
```

**Doğrulama**: Transaction detayları doğru

---

### 7.8 CLI - wallet balance

**Test ID**: CLI-001
**Öncelik**: MEDIUM

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production
./target/release/mpc-wallet-cli wallet balance --node http://localhost:8081
```

**Beklenen**: Balance bilgisi

---

### 7.9 CLI - cluster status

**Test ID**: CLI-002
**Öncelik**: MEDIUM

```bash
./target/release/mpc-wallet-cli cluster status --node http://localhost:8081
```

**Beklenen**: Cluster durumu

---

### 7.10 CLI - tx list

**Test ID**: CLI-003
**Öncelik**: MEDIUM

```bash
./target/release/mpc-wallet-cli tx list --node http://localhost:8081
```

**Beklenen**: Transaction listesi

---

## PHASE 8: State Management & Data Integrity

### 8.1 No Duplicate Votes

**Test ID**: STATE-001
**Öncelik**: CRITICAL

```bash
# Check for duplicate votes
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT round_id, node_id, count(*) as duplicate_count
  FROM votes
  GROUP BY round_id, node_id
  HAVING count(*) > 1;
"
```

**Beklenen**: 0 rows (no duplicates)

---

### 8.2 State Machine Validation

**Test ID**: STATE-002
**Öncelik**: CRITICAL

```bash
# Check for invalid state transitions
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT txid, state, signed_tx IS NULL as no_signature
  FROM transactions
  WHERE (state = 'pending' AND signed_tx IS NOT NULL)
     OR (state = 'signed' AND signed_tx IS NULL);
"
```

**Beklenen**: 0 rows (no invalid states)

---

### 8.3 Vote Count Consistency

**Test ID**: STATE-003
**Öncelik**: HIGH

```bash
# Check vote counts match voting_rounds
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT vr.tx_id, vr.votes_received, count(v.id) as actual_votes
  FROM voting_rounds vr
  LEFT JOIN votes v ON vr.id = v.round_id
  GROUP BY vr.id, vr.tx_id, vr.votes_received
  HAVING vr.votes_received != count(v.id);
"
```

**Beklenen**: 0 rows (counts match)

---

### 8.4 etcd-PostgreSQL Consistency

**Test ID**: STATE-004
**Öncelik**: MEDIUM

```bash
# Count votes in PostgreSQL
PG_VOTES=$(docker exec mpc-postgres psql -U mpc -d mpc_wallet -t -c "SELECT count(*) FROM votes;")

# Count votes in etcd
ETCD_VOTES=$(docker exec mpc-etcd-1 etcdctl get /mpc/votes/ --prefix --keys-only | wc -l)

echo "PostgreSQL votes: $PG_VOTES"
echo "etcd votes: $ETCD_VOTES"
```

**Doğrulama**: Counts reasonable (etcd might have extra keys)

---

### 8.5 Audit Log Completeness

**Test ID**: STATE-005
**Öncelik**: HIGH

```bash
# Check all transactions have audit entries
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT t.txid
  FROM transactions t
  LEFT JOIN audit_log a ON t.txid = a.tx_id
  WHERE a.id IS NULL;
"
```

**Beklenen**: 0 rows (all transactions audited)

---

## PHASE 9: Concurrency & Race Conditions

### 9.1 Concurrent Transaction Submissions

**Test ID**: CONCURRENCY-001
**Öncelik**: HIGH

```bash
# Submit 5 transactions concurrently
for i in {1..5}; do
  curl -X POST http://localhost:8081/api/v1/transactions \
    -H "Content-Type: application/json" \
    -d "{
      \"recipient\": \"tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx\",
      \"amount_sats\": $((10000 + i * 1000)),
      \"metadata\": \"Concurrent test $i\"
    }" &
done
wait

# Wait for processing
sleep 15

# Check all processed
curl -s http://localhost:8081/api/v1/transactions | jq 'map(select(.metadata | contains("Concurrent test"))) | length'
```

**Beklenen**: 5 (all transactions accepted)

---

### 9.2 Automated Concurrency Tests

**Test ID**: CONCURRENCY-002
**Öncelik**: HIGH

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production

# Run concurrency test suite
cargo test --test concurrency -- --ignored --nocapture
```

**Doğrulama**:
- ✅ All concurrent transactions processed
- ✅ No race conditions
- ✅ No duplicate votes
- ✅ No state corruption

---

## PHASE 10: Edge Cases & Boundary Tests

### 10.1 Minimum Amount Transaction

**Test ID**: EDGE-001
**Öncelik**: MEDIUM

```bash
# Try minimum amount (1 sat)
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 1,
    "metadata": "Minimum amount test"
  }'
```

**Beklenen**: Either accepted or rejected with clear error

---

### 10.2 Large Amount Transaction

**Test ID**: EDGE-002
**Öncelik**: MEDIUM

```bash
# Try large amount (21M BTC in sats)
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 2100000000000000,
    "metadata": "Large amount test"
  }'
```

**Beklenen**: Should reject (insufficient balance)

---

### 10.3 Invalid Bitcoin Address

**Test ID**: EDGE-003
**Öncelik**: HIGH

```bash
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "invalid-address",
    "amount_sats": 10000,
    "metadata": "Invalid address test"
  }'
```

**Beklenen**: HTTP 400 Bad Request

---

### 10.4 Long Metadata

**Test ID**: EDGE-004
**Öncelik**: LOW

```bash
# Create 1000-character metadata
LONG_META=$(python3 -c "print('A' * 1000)")

curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"recipient\": \"tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx\",
    \"amount_sats\": 10000,
    \"metadata\": \"$LONG_META\"
  }"
```

**Beklenen**: Accepted or rejected with length limit

---

### 10.5 Empty Metadata

**Test ID**: EDGE-005
**Öncelik**: LOW

```bash
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 10000
  }'
```

**Doğrulama**: Should work (metadata optional)

---

### 10.6 Special Characters in Metadata

**Test ID**: EDGE-006
**Öncelik**: LOW

```bash
curl -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 10000,
    "metadata": "Test with emoji 🚀 and unicode ñ ü €"
  }'
```

**Doğrulama**: Should handle unicode correctly

---

## PHASE 11: Performance & Stress Tests

### 11.1 Transaction Throughput

**Test ID**: PERF-001
**Öncelik**: HIGH

```bash
# Submit 20 transactions as fast as possible
START=$(date +%s)

for i in {1..20}; do
  curl -X POST http://localhost:8081/api/v1/transactions \
    -H "Content-Type: application/json" \
    -d "{
      \"recipient\": \"tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx\",
      \"amount_sats\": $((5000 + i * 100)),
      \"metadata\": \"Throughput test $i\"
    }" &
done
wait

END=$(date +%s)
DURATION=$((END - START))

echo "Submitted 20 transactions in $DURATION seconds"
echo "Throughput: $((20 / DURATION)) tx/sec"
```

**Target**: > 5 tx/sec submission rate

---

### 11.2 Consensus Latency

**Test ID**: PERF-002
**Öncelik**: HIGH

```bash
# Measure time from submission to approval
START=$(date +%s%N)

RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "amount_sats": 10000,
    "metadata": "Latency test"
  }')

TX_ID=$(echo $RESPONSE | jq -r '.txid')

# Poll until approved
while true; do
  STATE=$(curl -s http://localhost:8081/api/v1/transactions/$TX_ID | jq -r '.state')
  if [ "$STATE" = "approved" ]; then
    END=$(date +%s%N)
    break
  fi
  sleep 0.5
done

LATENCY=$(( (END - START) / 1000000 ))  # Convert to ms
echo "Consensus latency: $LATENCY ms"
```

**Target**: < 5000ms (5 seconds)

---

### 11.3 API Response Time

**Test ID**: PERF-003
**Öncelik**: MEDIUM

```bash
# Measure health endpoint response time
for i in {1..10}; do
  time curl -s http://localhost:8081/health > /dev/null
done
```

**Target**: < 200ms per request

---

### 11.4 Memory Usage Check

**Test ID**: PERF-004
**Öncelik**: HIGH

```bash
# Check memory usage
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"
```

**Target**:
- Each node < 2GB
- PostgreSQL < 1GB
- etcd < 512MB

---

### 11.5 CPU Usage Check

**Test ID**: PERF-005
**Öncelik**: MEDIUM

```bash
# Monitor CPU usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}"
```

**Target**: Average < 50% per container

---

## PHASE 12: Automated Test Suites

### 12.1 Run All E2E Tests

**Test ID**: AUTO-001
**Öncelik**: CRITICAL

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production

# Run complete test suite
cargo test --manifest-path e2e/Cargo.toml -- --ignored --test-threads=1 --nocapture 2>&1 | tee full_test_results.log
```

**Beklenen**: All tests pass

---

### 12.2 Cluster Setup Tests

**Test ID**: AUTO-002
**Öncelik**: HIGH

```bash
cargo test --test cluster_setup -- --ignored --nocapture
```

---

### 12.3 Transaction Lifecycle Tests

**Test ID**: AUTO-003
**Öncelik**: HIGH

```bash
cargo test --test transaction_lifecycle -- --ignored --nocapture
```

---

### 12.4 Byzantine Scenarios Tests

**Test ID**: AUTO-004
**Öncelik**: HIGH

```bash
cargo test --test byzantine_scenarios -- --ignored --nocapture
```

---

### 12.5 Fault Tolerance Tests

**Test ID**: AUTO-005
**Öncelik**: HIGH

```bash
cargo test --test fault_tolerance -- --ignored --nocapture
```

---

### 12.6 Concurrency Tests

**Test ID**: AUTO-006
**Öncelik**: MEDIUM

```bash
cargo test --test concurrency -- --ignored --nocapture
```

---

### 12.7 Network Partition Tests

**Test ID**: AUTO-007
**Öncelik**: MEDIUM

```bash
cargo test --test network_partition -- --ignored --nocapture
```

---

### 12.8 Certificate Rotation Tests

**Test ID**: AUTO-008
**Öncelik**: LOW

```bash
cargo test --test certificate_rotation -- --ignored --nocapture
```

---

## PHASE 13: Final Validation

### 13.1 System Health Summary

**Test ID**: FINAL-001
**Öncelik**: CRITICAL

```bash
echo "=== SYSTEM HEALTH SUMMARY ==="
echo ""
echo "Docker Containers:"
docker-compose ps
echo ""
echo "Node Health:"
for i in {1..5}; do
  echo -n "Node $i: "
  curl -s http://localhost:808$i/health | jq -r '.status'
done
echo ""
echo "Cluster Status:"
curl -s http://localhost:8081/api/v1/cluster/status | jq
echo ""
echo "Database Tables:"
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
echo ""
echo "etcd Health:"
docker exec mpc-etcd-1 etcdctl endpoint health --cluster
```

---

### 13.2 Transaction Statistics

**Test ID**: FINAL-002
**Öncelik**: HIGH

```bash
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT
    state,
    count(*) as count
  FROM transactions
  GROUP BY state
  ORDER BY
    CASE state
      WHEN 'pending' THEN 1
      WHEN 'voting' THEN 2
      WHEN 'collecting' THEN 3
      WHEN 'threshold_reached' THEN 4
      WHEN 'approved' THEN 5
      WHEN 'rejected' THEN 6
      WHEN 'signing' THEN 7
      WHEN 'signed' THEN 8
      WHEN 'submitted' THEN 9
      WHEN 'broadcasting' THEN 10
      WHEN 'confirmed' THEN 11
      WHEN 'failed' THEN 12
      WHEN 'aborted_byzantine' THEN 13
    END;
"
```

---

### 13.3 Byzantine Violations Summary

**Test ID**: FINAL-003
**Öncelik**: HIGH

```bash
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "
  SELECT
    violation_type,
    count(*) as count
  FROM byzantine_violations
  GROUP BY violation_type;
"
```

---

### 13.4 Performance Summary

**Test ID**: FINAL-004
**Öncelik**: MEDIUM

```bash
echo "=== PERFORMANCE SUMMARY ==="
echo ""
echo "Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""
echo "Disk Usage:"
df -h | grep -E "Filesystem|/mnt/c"
echo ""
echo "Docker Volumes:"
docker volume ls
```

---

### 13.5 Log Analysis

**Test ID**: FINAL-005
**Öncelik**: HIGH

```bash
echo "=== LOG ANALYSIS ==="
echo ""
echo "Errors in logs:"
docker-compose logs | grep -i error | wc -l
echo ""
echo "Warnings in logs:"
docker-compose logs | grep -i warn | wc -l
echo ""
echo "Panics in logs:"
docker-compose logs | grep -i panic | wc -l
```

**Beklenen**:
- Errors: Minimal (Byzantine test errors expected)
- Warnings: Some acceptable
- Panics: 0

---

## Test Execution Summary Template

```
═══════════════════════════════════════════════════════════════
MPC WALLET - TEST EXECUTION SUMMARY
═══════════════════════════════════════════════════════════════

Test Date: 2026-01-21
Tester: [Name]
Duration: [Total Time]

PHASE RESULTS:
─────────────────────────────────────────────────────────────
Phase 1:  Infrastructure & Setup        [ PASS / FAIL ]
Phase 2:  Deployment & Startup          [ PASS / FAIL ]
Phase 3:  Network Communication         [ PASS / FAIL ]
Phase 3.5: Orchestration Services       [ PASS / FAIL ] **YENİ**
Phase 4:  Transaction Lifecycle         [ PASS / FAIL ]
Phase 5:  Byzantine Fault Tolerance     [ PASS / FAIL ]
Phase 6:  Fault Tolerance & Recovery    [ PASS / FAIL ]
Phase 7:  API & CLI Tests               [ PASS / FAIL ]
Phase 8:  State Management              [ PASS / FAIL ]
Phase 9:  Concurrency Tests             [ PASS / FAIL ]
Phase 10: Edge Cases                    [ PASS / FAIL ]
Phase 11: Performance & Stress          [ PASS / FAIL ]
Phase 12: Automated Test Suites         [ PASS / FAIL ]
Phase 13: Final Validation              [ PASS / FAIL ]

TEST STATISTICS:
─────────────────────────────────────────────────────────────
Total Tests:         95+
Passed:              [ X ]
Failed:              [ Y ]
Skipped:             [ Z ]
Pass Rate:           [ X/95 * 100 ]%

CRITICAL ISSUES:     [ Number ]
HIGH ISSUES:         [ Number ]
MEDIUM ISSUES:       [ Number ]
LOW ISSUES:          [ Number ]

PERFORMANCE METRICS:
─────────────────────────────────────────────────────────────
Consensus Latency:          [ X ] ms (target: < 5000ms)
Transaction Throughput:     [ X ] tx/sec (target: > 5)
API Response Time:          [ X ] ms (target: < 200ms)
Node Recovery Time:         [ X ] sec (target: < 60s)

SYSTEM HEALTH:
─────────────────────────────────────────────────────────────
Containers Running:         9 / 9
Nodes Online:               5 / 5
etcd Cluster:               [ HEALTHY / UNHEALTHY ]
PostgreSQL:                 [ HEALTHY / UNHEALTHY ]
Consensus:                  [ WORKING / BROKEN ]

DATA INTEGRITY:
─────────────────────────────────────────────────────────────
Duplicate Votes:            [ 0 / N ]
Invalid State Transitions:  [ 0 / N ]
Data Corruption:            [ NONE / DETECTED ]
Audit Log Complete:         [ YES / NO ]

BYZANTINE TOLERANCE:
─────────────────────────────────────────────────────────────
Violations Detected:        [ X ]
Violations Recorded:        [ X ]
Auto-Ban Working:           [ YES / NO ]
Recovery After Attack:      [ SUCCESS / FAIL ]

OVERALL ASSESSMENT:
─────────────────────────────────────────────────────────────
Status: [ ✅ PRODUCTION READY / ❌ NOT READY ]

BLOCKERS:
1. [Issue 1 if any]
2. [Issue 2 if any]

RECOMMENDATIONS:
1. [Recommendation 1]
2. [Recommendation 2]

SIGN-OFF:
─────────────────────────────────────────────────────────────
Tester:         ________________  Date: __________
Tech Lead:      ________________  Date: __________
Security:       ________________  Date: __________

═══════════════════════════════════════════════════════════════
```

---

## Cleanup After Tests

### Full Cleanup

```bash
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production/docker

# Stop all services
docker-compose down

# Remove volumes (WARNING: Deletes all data)
docker-compose down -v

# Clean Docker system
docker system prune -a

# Clean build artifacts
cd ..
cargo clean
```

---

## Quick Reference Commands

```bash
# Start system
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production/docker && docker-compose up -d

# Stop system
docker-compose down

# View logs
docker-compose logs -f --tail=100

# Check all nodes
for i in {1..5}; do curl http://localhost:808$i/health; echo; done

# Run all automated tests
cd /mnt/c/Users/user/Desktop/MPC-WALLET/production && cargo test --manifest-path e2e/Cargo.toml -- --ignored --test-threads=1 --nocapture

# Submit test transaction
curl -X POST http://localhost:8081/api/v1/transactions -H "Content-Type: application/json" -d '{"recipient":"tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx","amount_sats":10000,"metadata":"Test"}'

# Check PostgreSQL
docker exec mpc-postgres psql -U mpc -d mpc_wallet -c "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5;"

# Check etcd
docker exec mpc-etcd-1 etcdctl endpoint health --cluster

# Resource monitoring
docker stats --no-stream
```

---

## Notlar

- Her test sonrası sonuçları kaydet
- Başarısız testleri loglarla birlikte dokümante et
- Performance metriklerini benchmark için kullan
- Edge case'lerde beklenmeyen davranışları not et
- Byzantine testlerinde violation detection zamanlamalarını ölç

---

**Test Planı Versiyonu**: 1.0.0
**Son Güncelleme**: 2026-01-21
**Durum**: READY FOR EXECUTION
**Tahmini Tamamlanma Süresi**: 30-45 dakika
