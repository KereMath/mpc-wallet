# 🚨 CRITICAL ARCHITECTURE GAP ANALYSIS

**Date**: 2026-01-21
**Severity**: CRITICAL
**Status**: BLOCKING ALL TRANSACTION PROCESSING

---

## Executive Summary

The production MPC wallet system has a **critical missing component**: There is **NO transaction lifecycle orchestrator/worker** to process transactions through their states. Transactions remain stuck in `pending` state indefinitely because no background service exists to:

1. Poll for pending transactions
2. Initiate voting rounds
3. Collect and process votes
4. Check consensus threshold
5. Trigger signing operations
6. Broadcast completed transactions

## Current System State

### ✅ What's Working

1. **Infrastructure Layer** - All services healthy:
   - etcd cluster: 3/3 nodes operational
   - PostgreSQL: 9 tables created, accepting connections
   - Docker networking: Internal/external networks configured
   - Certificates: mTLS certificates properly deployed

2. **Data Layer** - All storage components functional:
   - PostgreSQL schemas deployed correctly
   - etcd cluster coordination working
   - Database connections established

3. **API Layer** - REST endpoints functional:
   - `POST /api/v1/transactions` - Creates transactions successfully
   - `GET /api/v1/transactions/:txid` - Retrieves transaction data
   - `GET /health` - Health checks passing
   - All 5 nodes responding on ports 8081-8085

4. **Transaction Creation** - Successfully tested:
   ```json
   {
     "txid": "8721bc1c9c5a7ae3801a0dd6277526e55a30c3c922f181c30280fa1cc803edc6",
     "state": "pending",
     "recipient": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
     "amount_sats": 75000,
     "fee_sats": 747,
     "created_at": "2026-01-21T08:23:30.785965975Z"
   }
   ```

### ❌ What's Missing - THE CRITICAL GAP

**NO TRANSACTION LIFECYCLE ORCHESTRATOR**

The current deployment runs ONLY the `mpc-wallet-server` binary (from [crates/api/src/bin/server.rs](crates/api/src/bin/server.rs)), which is a REST API server. This binary:
- Accepts HTTP requests
- Creates transactions in `pending` state
- Returns responses
- **DOES NOTHING ELSE**

There is NO background worker/service that:
- Monitors the `transactions` table for `pending` transactions
- Initiates `voting_rounds` in the database
- Sends vote requests to nodes via QUIC/mTLS network
- Collects votes and checks threshold (4-of-5)
- Transitions states: `pending` → `voting` → `threshold_reached` → `signing` → `signed`
- Broadcasts completed transactions to Bitcoin network

## Evidence of the Gap

### 1. Transaction Stuck in Pending State

Monitored transaction for 45 seconds (15 checks x 3 seconds):
```
=== Check 1-15 ===
"state": "pending"
"state": "pending"
"state": "pending"
... (all 15 checks show "pending")
```

**Expected behavior** (from E2E test [e2e/transaction_lifecycle.rs:38-67](e2e/transaction_lifecycle.rs#L38-L67)):
```rust
// Should progress: Pending → Voting → ThresholdReached → Approved → Signing
assert!(matches!(
    tx.state,
    TransactionState::Voting
    | TransactionState::ThresholdReached
    | TransactionState::Approved
    | TransactionState::Signing
));
```

### 2. No Voting Rounds Created

```sql
SELECT COUNT(*) FROM voting_rounds;
 count
-------
     0
```

Zero voting rounds exist despite 2 transactions created. The orchestrator should have created voting rounds automatically.

### 3. No Background Workers in Logs

```
{"message":"Starting MPC Wallet API Server"}
{"message":"PostgreSQL storage initialized"}
{"message":"etcd storage initialized"}
{"message":"Bitcoin client initialized"}
{"message":"API server starting on 0.0.0.0:8080"}
{"message":"Starting API server on 0.0.0.0:8080"}
```

Logs show ONLY API server initialization. No evidence of:
- "Starting transaction orchestrator"
- "Starting vote collector"
- "Starting signing coordinator"
- "Polling for pending transactions"

### 4. Docker Configuration Runs Only API Server

[docker/Dockerfile.node:103](docker/Dockerfile.node#L103):
```dockerfile
# Run the server
ENTRYPOINT ["/app/mpc-wallet-server"]
```

This runs only the `mpc-wallet-server` binary, which is the REST API server from [crates/api/src/bin/server.rs](crates/api/src/bin/server.rs).

### 5. No Orchestrator Code Found

Searched production codebase:
```bash
# No results for:
- **/orchestrator*.rs
- **/worker*.rs
- **/lifecycle*.rs
- async fn process_transaction
```

The architecture documentation mentions orchestration ([detailedplan.md:88](detailedplan.md#L88)):
```markdown
| `crates/consensus/src/vote_processor.rs` | Vote aggregation & threshold checks | Consensus orchestration |
```

But `VoteProcessor` is a **reactive component** that processes individual votes when called. It does NOT:
- Poll for pending transactions
- Initiate voting rounds
- Coordinate the full lifecycle

## Architecture Components Available But Not Orchestrated

The following components **exist** in the codebase but are **not connected**:

1. **Consensus Layer** ([crates/consensus/](crates/consensus/)):
   - `VoteProcessor`: Can process individual votes ✅
   - `ByzantineDetector`: Can detect malicious behavior ✅
   - `VoteFSM`: Defines state transitions ✅

2. **Network Layer** ([crates/network/](crates/network/)):
   - `QuicEngine`: Can send/receive messages ✅
   - `QuicListener`: Listens for connections ✅
   - mTLS authentication configured ✅

3. **Storage Layer** ([crates/storage/](crates/storage/)):
   - `PostgresStorage`: Database operations ✅
   - `EtcdStorage`: Distributed coordination ✅
   - All tables created ✅

4. **Protocols Layer** ([crates/protocols/](crates/protocols/)):
   - FROST signing protocol implementation ✅
   - CGGMP24 protocol code ✅

**BUT NO COORDINATOR/ORCHESTRATOR TO WIRE THESE TOGETHER**

## What Needs to Be Implemented

To fix this critical gap, we need a **Transaction Lifecycle Orchestrator** service:

### Required Components

#### 1. Transaction Orchestrator Worker (NEW)

**File**: `crates/orchestrator/src/lib.rs` (new crate)

**Responsibilities**:
```rust
pub struct TransactionOrchestrator {
    postgres: PostgresStorage,
    etcd: EtcdStorage,
    vote_processor: VoteProcessor,
    network: QuicEngine,
    bitcoin: BitcoinClient,
}

impl TransactionOrchestrator {
    /// Main orchestration loop
    pub async fn run(&self) {
        loop {
            // 1. Poll for pending transactions
            let pending_txs = self.postgres.get_pending_transactions().await;

            for tx in pending_txs {
                // 2. Create voting round
                let round_id = self.create_voting_round(&tx).await;

                // 3. Request votes from all nodes
                self.request_votes(round_id, &tx).await;

                // 4. Wait for votes (with timeout)
                tokio::time::sleep(Duration::from_secs(5)).await;

                // 5. Check if threshold reached
                let vote_count = self.etcd.get_vote_count(&tx.txid).await;

                if vote_count >= self.threshold {
                    // 6. Transition to signing
                    self.postgres.update_transaction_state(&tx.txid, "signing").await;

                    // 7. Initiate signing protocol
                    self.initiate_signing(&tx).await;

                    // 8. Broadcast to Bitcoin network
                    self.bitcoin.broadcast_transaction(&signed_tx).await;

                    // 9. Mark as confirmed
                    self.postgres.update_transaction_state(&tx.txid, "confirmed").await;
                }
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
}
```

#### 2. Vote Request Handler (NEW)

Nodes need to handle incoming vote requests:
```rust
async fn handle_vote_request(tx: &Transaction) -> Vote {
    // Validate transaction
    // Create vote
    // Sign vote with node's private key
    // Return vote
}
```

#### 3. Signing Coordinator (NEW)

Orchestrate the multi-round signing protocol:
```rust
async fn coordinate_signing(tx: &Transaction, nodes: &[NodeId]) {
    // Run FROST/CGGMP24 signing rounds
    // Coordinate with threshold subset of nodes
    // Aggregate signature shares
    // Construct final signature
}
```

#### 4. Updated Docker Deployment

**Option A**: Run orchestrator in same container as API
```dockerfile
# Start both API and orchestrator
CMD ["/app/mpc-wallet-server", "--with-orchestrator"]
```

**Option B**: Separate orchestrator container (better)
```yaml
services:
  node-1-api:
    entrypoint: ["/app/mpc-wallet-server"]

  node-1-orchestrator:
    entrypoint: ["/app/mpc-orchestrator"]
    depends_on:
      - node-1-api
```

## Impact Analysis

### Test Results So Far

| Phase | Status | Notes |
|-------|--------|-------|
| PHASE 1: Infrastructure | ✅ PASS | Docker, Rust, certificates verified |
| PHASE 2: Deployment | ✅ PASS | All 9 containers healthy |
| PHASE 3: Network | ✅ PASS | All nodes responding |
| PHASE 4: Transaction Lifecycle | ❌ BLOCKED | Transactions stuck in `pending` |
| PHASE 5-13 | ⏸️ CANNOT TEST | All depend on working transaction lifecycle |

### Affected Functionality

ALL transaction-related functionality is broken:
- ❌ Transaction voting
- ❌ Consensus threshold detection
- ❌ Transaction signing
- ❌ Bitcoin broadcasting
- ❌ Transaction confirmation
- ❌ Byzantine fault detection (no votes to analyze)
- ❌ Presignature pool usage (signing never triggered)

### What Still Works

- ✅ Creating transactions (REST API)
- ✅ Querying transaction data (REST API)
- ✅ Health checks
- ✅ Database queries
- ✅ etcd operations
- ✅ Network connectivity

## Comparison with E2E Tests

The E2E tests ([e2e/transaction_lifecycle.rs](e2e/transaction_lifecycle.rs)) ASSUME the orchestrator exists:

```rust
// E2E test expects automatic progression:
let response = cluster.nodes[0].send_transaction(&tx_request).await?;
assert_eq!(response.state, TransactionState::Pending);  // Initial

tokio::time::sleep(Duration::from_secs(3)).await;

// Test EXPECTS state to have progressed automatically
for (idx, node) in cluster.nodes.iter().enumerate() {
    let tx = node.get_transaction(&txid).await?;

    // E2E expects: Voting | ThresholdReached | Approved | Signing
    assert!(matches!(
        tx.state,
        TransactionState::Voting | TransactionState::ThresholdReached | ...
    ));
}
```

**These tests would fail** with the current deployment because no orchestrator runs to progress the state.

## Recommended Next Steps

### Immediate Actions

1. **Document this gap** in all relevant files ✅ (this document)
2. **Inform user** of the architectural gap ⏩ NEXT
3. **Assess if orchestrator code exists** in other repositories
4. **Decide on implementation approach**:
   - Option A: Implement new orchestrator from scratch
   - Option B: Port orchestrator from `torcus-wallet` or `mtls-comm`
   - Option C: Modify existing components to add orchestration

### Implementation Priority

**CRITICAL - P0**: Without this component, the system cannot process transactions at all.

**Estimated Effort**:
- Simple polling-based orchestrator: 2-3 days
- Full production-grade orchestrator with error handling: 1-2 weeks
- Integration with existing protocols layer: Additional 1 week

## Related Files

- [production/crates/api/src/bin/server.rs](crates/api/src/bin/server.rs) - Current API-only server
- [production/crates/consensus/src/vote_processor.rs](crates/consensus/src/vote_processor.rs) - Vote processing (reactive)
- [production/crates/consensus/src/fsm.rs](crates/consensus/src/fsm.rs) - State machine definitions
- [production/e2e/transaction_lifecycle.rs](e2e/transaction_lifecycle.rs) - E2E test showing expected behavior
- [production/docker/Dockerfile.node](docker/Dockerfile.node) - Deployment configuration
- [production/detailedplan.md](detailedplan.md) - Architecture plan

---

## Conclusion

The MPC wallet production system has excellent components for:
- ✅ Network communication (QUIC + mTLS)
- ✅ Data storage (PostgreSQL + etcd)
- ✅ Cryptographic protocols (FROST, CGGMP24)
- ✅ Byzantine fault detection
- ✅ REST API

But it's **missing the orchestration layer** that connects these components and drives the transaction lifecycle. Without this critical component, **transactions cannot progress beyond the `pending` state**.

This is like having a car with a great engine, transmission, wheels, and steering wheel—but no one in the driver's seat.

**RECOMMENDATION**: Before proceeding with remaining tests (PHASE 5-13), we need to either:
1. Implement the transaction orchestrator
2. Locate existing orchestrator code in other repositories
3. Modify the test plan to only test API-level functionality

---

**Status**: Report complete, awaiting user decision on next steps.
