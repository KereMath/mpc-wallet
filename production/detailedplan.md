# 🚀 Enterprise MPC-Wallet: Ultimate Integration Blueprint

**Version:** 1.0
**Date:** January 20, 2026
**Status:** Master Implementation Plan
**Objective:** Build a production-grade Bitcoin MPC wallet by merging the best components from three existing projects

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Inventory & Component Analysis](#project-inventory--component-analysis)
3. [Architectural Vision](#architectural-vision)
4. [Layer-by-Layer Integration Plan](#layer-by-layer-integration-plan)
5. [Module Extraction & Adaptation Strategy](#module-extraction--adaptation-strategy)
6. [Data Flow & Protocol Orchestration](#data-flow--protocol-orchestration)
7. [Security & Compliance Framework](#security--compliance-framework)
8. [Performance Optimization Strategy](#performance-optimization-strategy)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Testing & Validation Strategy](#testing--validation-strategy)
11. [Deployment Architecture](#deployment-architecture)
12. [Monitoring & Observability](#monitoring--observability)

---

## 🎯 Executive Summary

### Vision Statement
Create a **military-grade, enterprise-ready Bitcoin MPC wallet** that combines:
- **QUIC protocol** for zero Head-of-Line blocking and multiplexed streams
- **Mutual TLS (mTLS)** for certificate-based authentication
- **Byzantine Fault Tolerance (BFT)** for malicious node detection
- **Presignature Pool** for sub-500ms signing performance
- **Dual protocol support**: CGGMP24 (ECDSA) and FROST (Schnorr/Taproot)

### Success Criteria
- ✅ Signing latency: **<500ms** (down from 2s)
- ✅ Byzantine tolerance: **⌊(N-1)/3⌋** malicious nodes
- ✅ Network resilience: **99.99% uptime** under packet loss
- ✅ Security: **Zero trust architecture** with mTLS everywhere
- ✅ Auditability: **Complete transaction trail** in PostgreSQL

---

## 📦 Project Inventory & Component Analysis

### Source Project 1: `torcus-wallet`
**Purpose:** QUIC-based MPC wallet with coordinator-node architecture
**Key Strengths:**
- ✨ QUIC transport implementation (quinn library)
- ✨ Multi-stream session management
- ✨ FROST protocol for Schnorr signatures
- ✨ Bitcoin blockchain integration (Esplora API)
- ✨ Coordinator discovery mechanism

**Files to Extract:**

| File Path | Purpose | Integration Target |
|-----------|---------|-------------------|
| `crates/protocols/src/p2p/quic_transport.rs` | QUIC connection handling | Network layer foundation |
| `crates/protocols/src/p2p/session.rs` | Stream multiplexing & session state | MPC round management |
| `crates/protocols/src/p2p/quic_listener.rs` | Server-side QUIC listener | Node server bootstrap |
| `crates/protocols/src/frost/keygen.rs` | FROST DKG implementation | Schnorr key generation |
| `crates/protocols/src/frost/signing.rs` | FROST signing rounds | Taproot signature creation |
| `crates/common/src/bitcoin_tx.rs` | Transaction building utilities | OP_RETURN embedding |
| `crates/chains/src/bitcoin/client.rs` | Esplora/RPC integration | Blockchain broadcast |
| `crates/coordinator/src/registry.rs` | Node discovery & health checks | Peer management |

---

### Source Project 2: `mtls-comm`
**Purpose:** mTLS-secured MPC with Byzantine fault detection
**Key Strengths:**
- 🔐 Certificate authority (CA) infrastructure
- 🔐 Mutual TLS authentication layer
- 🛡️ Byzantine behavior detection engine
- 🛡️ Raft-based consensus via etcd
- 📊 PostgreSQL audit logging

**Files to Extract:**

| File Path | Purpose | Integration Target |
|-----------|---------|-------------------|
| `crates/network/src/cert_manager.rs` | X.509 certificate validation & rotation | mTLS wrapper for QUIC |
| `crates/network/src/tls_config.rs` | TLS 1.3 configuration builder | QUIC TLS settings |
| `crates/consensus/src/byzantine.rs` | 4-type Byzantine violation detector | Voting validation layer |
| `crates/consensus/src/fsm.rs` | Finite state machine for consensus | Transaction approval FSM |
| `crates/consensus/src/vote_processor.rs` | Vote aggregation & threshold checks | Consensus orchestration |
| `crates/storage/src/etcd.rs` | Distributed lock & counter management | State synchronization |
| `crates/storage/src/postgres.rs` | Audit trail & event logging | Compliance database |

---

### Source Project 3: `threshold-signing (Copy)`
**Purpose:** High-performance CGGMP24 with presignature pool
**Key Strengths:**
- ⚡ Presignature generation & caching
- ⚡ Fast signing (<500ms with pool)
- 🔑 CGGMP24 DKG and signing protocols
- 🔑 Auxiliary info caching

**Files to Extract:**

| File Path | Purpose | Integration Target |
|-----------|---------|-------------------|
| `node/src/presignature_pool.rs` | Presignature generation & management | Performance optimization layer |
| `node/src/signing_fast.rs` | Pool-based rapid signing | Primary signing engine |
| `crypto/src/cggmp24/keygen.rs` | CGGMP24 distributed key generation | ECDSA key setup |
| `crypto/src/cggmp24/signing.rs` | CGGMP24 signing rounds | ECDSA signature creation |
| `crypto/src/cggmp24/aux_info.rs` | Zero-knowledge proof parameters | One-time setup data |

---

### ~~Source Project 4: `p2p-comm`~~ ❌ NOT USED

**Why Excluded:**
This project is based on **libp2p**, which conflicts with our **QUIC-native architecture** from torcus-wallet. Since we're using QUIC for all peer-to-peer communication with built-in multiplexing and stream management, the libp2p abstractions (behavior patterns, gossip protocols) are unnecessary and would add complexity without benefit.

**What We're Using Instead:**
- **Network Layer:** QUIC from torcus-wallet (replaces libp2p transport)
- **Request-Response:** QUIC bidirectional streams (replaces libp2p req/res protocol)
- **Message Serialization:** New implementation with protobuf/bincode
- **Consensus/Voting:** Vote processor from mtls-comm (covers all voting logic)

**Note:** p2p-comm remains in the repository as a reference implementation but **zero files will be extracted** from it.

---

## 🏗️ Architectural Vision

### System Layers (Bottom to Top)

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 7: Application Interface                            │
│  ├─ REST API (Axum)                                        │
│  ├─ CLI Tool (Clap)                                        │
│  └─ Web UI (Optional)                                      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 6: Business Logic & Orchestration                   │
│  ├─ Transaction Builder (OP_RETURN embedding)              │
│  ├─ Signing Coordinator (Pool management)                  │
│  └─ Wallet State Manager (Balance, UTXOs)                  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Cryptographic Protocols                          │
│  ├─ CGGMP24 Engine (Fast ECDSA via Pool)                  │
│  ├─ FROST Engine (Schnorr/Taproot)                        │
│  └─ Auxiliary Info Manager (ZKP parameters)                │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Consensus & Byzantine Protection                 │
│  ├─ Vote Processor (Threshold aggregation)                 │
│  ├─ Byzantine Detector (4 violation types)                 │
│  ├─ FSM Controller (Transaction approval flow)             │
│  └─ Raft Coordinator (etcd locks & counters)               │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Session & Message Management                     │
│  ├─ MPC Session Handler (Round synchronization)            │
│  ├─ Request-Response Router (Message dispatching)          │
│  └─ Presignature Pool (Background generation)              │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Secure Transport (QUIC + mTLS)                   │
│  ├─ QUIC Engine (quinn + multi-stream)                    │
│  ├─ mTLS Wrapper (Certificate validation)                  │
│  ├─ Connection Pool (Peer connection management)           │
│  └─ Stream Multiplexer (Independent MPC rounds)            │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Storage & External Integrations                  │
│  ├─ Local State File (Encrypted shares)                    │
│  ├─ PostgreSQL (Audit logs & history)                      │
│  ├─ etcd (Distributed locks & state)                       │
│  └─ Bitcoin Node (Esplora/RPC broadcast)                   │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

#### 🔒 Security First
- **Zero Trust:** Every connection requires valid mTLS certificate
- **Certificate Rotation:** Automated cert renewal every 30 days
- **At-Rest Encryption:** AES-256-GCM for local state files
- **In-Transit Encryption:** TLS 1.3 mandatory for all QUIC streams
- **Audit Everything:** Every vote, signature, and transaction logged

#### ⚡ Performance Optimized
- **Presignature Pool:** Pre-compute 100 signatures, maintain 20 minimum
- **Stream Multiplexing:** Parallel DKG/signing rounds on separate QUIC streams
- **Connection Reuse:** Persistent QUIC connections (no handshake overhead)
- **Zero-Copy:** Direct buffer passing between QUIC and crypto layers

#### 🛡️ Byzantine Resilient
- **Double-Vote Detection:** Track all votes per round, reject duplicates
- **Invalid Signature Detection:** Verify every intermediate signature share
- **Timeout Detection:** Auto-exclude nodes that don't respond in 5s
- **Slashing (Future):** Permanent ban for proven Byzantine behavior

#### 📊 Enterprise Ready
- **Prometheus Metrics:** Signing latency, pool size, Byzantine events
- **Structured Logging:** JSON logs with trace IDs for all operations
- **Health Checks:** HTTP endpoint for orchestrator monitoring
- **Graceful Shutdown:** Drain pending signatures before exit

---

## 🔧 Layer-by-Layer Integration Plan

### Layer 1: Storage & External Integrations

#### Component 1.1: Local Encrypted State
**Source:** New implementation (inspired by torcus-wallet state patterns)
**Purpose:** Store key shares, presignatures, and node configuration

**Implementation Details:**
- **File Format:** JSON with versioning (`{"version": 1, "encrypted_data": "..."}`)
- **Encryption:** ChaCha20-Poly1305 with Argon2id key derivation
- **Key Material:** Derived from environment variable `STATE_ENCRYPTION_KEY`
- **Backup Strategy:** Atomic writes with temp file + rename pattern
- **Fields to Store:**
  - Node ID and peer list
  - CGGMP24/FROST key shares (encrypted)
  - Auxiliary info (ZKP parameters)
  - Presignature pool items
  - Last used presignature index

**File Structure:**
```
state.json (encrypted)
├─ node_config: {id, peers, threshold}
├─ key_shares: {cggmp24: {...}, frost: {...}}
├─ aux_info: {params, timestamp}
├─ presignatures: [{id, nonce, timestamp}, ...]
└─ metadata: {version, last_updated}
```

---

#### Component 1.2: PostgreSQL Audit Database
**Source:** `mtls-comm/crates/storage/src/postgres.rs`
**Purpose:** Immutable audit trail for compliance

**Schema Design:**

**Table: `transactions`**
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Auto-increment primary key |
| txid | TEXT | Bitcoin transaction ID |
| unsigned_tx | BYTEA | Raw unsigned transaction |
| signed_tx | BYTEA | Fully signed transaction |
| op_return_data | TEXT | Embedded metadata |
| created_at | TIMESTAMP | Request timestamp |
| broadcast_at | TIMESTAMP | Broadcast timestamp |
| status | ENUM | pending/signed/broadcast/confirmed |

**Table: `voting_rounds`**
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| transaction_id | BIGINT | FK to transactions |
| round_number | INTEGER | MPC round index |
| vote_data | JSONB | All votes received |
| threshold | INTEGER | Required votes |
| result | ENUM | approved/rejected/timeout |
| byzantine_events | JSONB | Detected violations |

**Table: `byzantine_violations`**
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| node_id | TEXT | Offending node identifier |
| violation_type | ENUM | double_vote/invalid_sig/timeout/malformed |
| round_id | BIGINT | FK to voting_rounds |
| evidence | JSONB | Proof of violation |
| detected_at | TIMESTAMP | Detection time |

**Table: `presignature_usage`**
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| presig_id | TEXT | Presignature identifier |
| transaction_id | BIGINT | FK to transactions |
| used_at | TIMESTAMP | Usage timestamp |
| generation_time_ms | INTEGER | Time to generate |

---

#### Component 1.3: etcd Distributed Coordination
**Source:** `mtls-comm/crates/storage/src/etcd.rs`
**Purpose:** Raft-based consensus and distributed locking

**Key-Value Structure:**

**Lock Keys:**
- `/locks/signing/{txid}` → Ensures only one signing session per TX
- `/locks/presig-generation` → Prevents duplicate presignature generation
- `/locks/dkg-session` → Serializes DKG operations

**Counter Keys:**
- `/counters/transactions` → Global TX counter
- `/counters/presignatures` → Total presignatures generated
- `/counters/byzantine-events` → Byzantine violation count

**State Keys:**
- `/nodes/{node_id}/status` → Node health (online/offline/degraded)
- `/nodes/{node_id}/last-heartbeat` → Timestamp of last ping
- `/cluster/threshold` → Current signing threshold (t-of-n)
- `/cluster/peers` → JSON array of active peer addresses

**TTL Strategy:**
- Locks: 30s TTL with 10s renewal
- Heartbeats: 5s TTL (3 missed = node considered dead)
- Status: 60s TTL

---

#### Component 1.4: Bitcoin Blockchain Integration
**Source:** `torcus-wallet/crates/chains/src/bitcoin/client.rs`
**Purpose:** UTXO fetching, fee estimation, transaction broadcast

**API Modes:**

**Mode 1: Esplora API (Default)**
- **Endpoint:** `https://blockstream.info/api` (mainnet)
- **Methods Used:**
  - `GET /address/{address}/utxo` → Fetch unspent outputs
  - `GET /fee-estimates` → Get mempool-based fee rates
  - `POST /tx` → Broadcast signed transaction
  - `GET /tx/{txid}/status` → Confirm transaction inclusion

**Mode 2: Bitcoin Core RPC (Optional)**
- **Methods Used:**
  - `listunspent` → UTXO retrieval
  - `estimatesmartfee` → Fee estimation
  - `sendrawtransaction` → Broadcast
  - `getrawtransaction` → TX confirmation

**Configuration:**
- Retry logic: 3 attempts with exponential backoff
- Timeout: 30s per request
- Fallback: Switch to RPC if Esplora fails

---

### Layer 2: Secure Transport (QUIC + mTLS)

#### Component 2.1: QUIC Transport Foundation
**Source:** `torcus-wallet/crates/protocols/src/p2p/quic_transport.rs`

**Why QUIC?**
- ❌ **Problem with TCP:** Head-of-Line blocking (one slow packet blocks entire stream)
- ✅ **QUIC Solution:** Independent streams per MPC round
- ✅ **Multiplexing:** Run DKG + Presig Generation + Signing simultaneously
- ✅ **0-RTT:** Resume connections without handshake
- ✅ **Built-in TLS 1.3:** Encryption by default

**🔒 CRITICAL ARCHITECTURAL NOTE: QUIC + mTLS Integration**

QUIC protocol **natively includes TLS 1.3** as part of its specification. We are **NOT** running a separate mTLS layer on top of QUIC. Instead:

- **QUIC provides:** Transport layer with built-in TLS 1.3 encryption
- **We configure:** QUIC's TLS 1.3 to require **mutual authentication** (client + server certificates)
- **Certificate management logic:** Taken from `mtls-comm/crates/network/src/cert_manager.rs`
- **TCP code from mtls-comm:** ❌ NOT USED (incompatible with QUIC architecture)

**What we extract from mtls-comm:**
- ✅ Certificate loading/validation (`cert_manager.rs`)
- ✅ CA hierarchy and verification logic (`tls_config.rs`)
- ✅ Certificate rotation policies
- ❌ TCP socket code (discarded - QUIC uses UDP)

**Integration point:**
```
QUIC Connection (UDP-based transport with TLS 1.3)
    └─> Configure rustls ServerConfig with:
        ├─> Client certificate verifier (from mtls-comm)
        ├─> Node certificate + private key (from mtls-comm cert_manager)
        └─> CA root certificate (from mtls-comm)
```

**Result:** Single unified transport layer with QUIC performance + mTLS security, avoiding the misconception of "two separate layers."

**Integration Steps:**

1. **Extract QUIC Engine:**
   - Copy `quic_transport.rs` → `production/crates/network/src/quic_engine.rs`
   - Copy `session.rs` → `production/crates/network/src/quic_session.rs`
   - Copy `quic_listener.rs` → `production/crates/network/src/quic_server.rs`

2. **Adapt Connection Handling:**
   - Replace hardcoded self-signed certs with mTLS certs from cert_manager
   - Add peer verification callback to validate certificate CN matches node ID
   - Implement connection pooling (max 50 concurrent connections per peer)

3. **Stream Management:**
   - **Stream ID Convention:**
     - `0-99`: Control messages (heartbeat, discovery)
     - `100-999`: DKG rounds (one stream per round)
     - `1000-9999`: Signing rounds (one stream per signature request)
     - `10000+`: Presignature generation
   - **Bidirectional Streams:** For request-response patterns
   - **Unidirectional Streams:** For broadcast messages (health checks)

4. **Error Handling:**
   - Connection timeout → Retry with exponential backoff (1s, 2s, 4s)
   - Stream reset → Log and move to next presignature in pool
   - TLS error → Alert operator, ban peer if certificate invalid

**Configuration Parameters:**
```
[quic]
max_idle_timeout_ms = 30000
keep_alive_interval_ms = 5000
max_concurrent_streams = 100
max_stream_data = 10MB
initial_congestion_window = 10
```

---

#### Component 2.2: mTLS Certificate Management
**Source:** `mtls-comm/crates/network/src/cert_manager.rs`, `tls_config.rs`

**⚠️ IMPORTANT:** We are NOT using mtls-comm's TCP transport layer. Only certificate management logic is extracted:
- ✅ **cert_manager.rs:** Certificate loading, validation, rotation
- ✅ **tls_config.rs:** rustls configuration for mutual authentication
- ❌ **tcp_socket.rs, connection_pool.rs:** DISCARDED (QUIC uses UDP, not TCP)

**Certificate Architecture:**

**Root CA (Certificate Authority):**
- **Location:** Offline cold storage (Hardware Security Module recommended)
- **Purpose:** Sign intermediate CA and node certificates
- **Validity:** 10 years
- **Algorithm:** RSA 4096-bit or ECDSA P-384

**Intermediate CA:**
- **Purpose:** Sign node certificates (root CA stays offline)
- **Validity:** 2 years
- **Rotation:** Automated via renewal script

**Node Certificates:**
- **Common Name (CN):** Node ID (e.g., `node-01.mpc-wallet.internal`)
- **SAN (Subject Alternative Names):** IP addresses and DNS names
- **Validity:** 90 days
- **Auto-Renewal:** At 60 days (30-day safety margin)

**Integration Steps:**

1. **Extract Certificate Manager:**
   - Copy `cert_manager.rs` → `production/crates/security/src/cert_manager.rs`
   - Copy `tls_config.rs` → `production/crates/security/src/tls_config.rs`

2. **CA Setup Process:**
   - Generate root CA with `openssl` or `cfssl`
   - Store root CA private key in HSM or encrypted vault
   - Generate intermediate CA signed by root
   - Distribute intermediate CA cert to all nodes

3. **Node Certificate Issuance:**
   - Each node generates CSR (Certificate Signing Request)
   - CSR sent to CA service (manual approval for first cert)
   - CA signs and returns certificate
   - Node stores cert + private key in encrypted state file

4. **Certificate Validation Logic:**
   - **On Connection:** Verify peer cert signed by trusted CA
   - **CN Check:** Extract node ID from CN, match against expected peer list
   - **Expiry Check:** Reject certs expiring within 7 days
   - **Revocation:** Check CRL (Certificate Revocation List) or OCSP

5. **Rotation Strategy:**
   - Background task checks cert expiry every 24h
   - At 60 days remaining: Generate new CSR, request new cert
   - At 30 days: Switch to new cert, keep old for 7 days (overlap period)
   - After overlap: Delete old cert

**mTLS Handshake Flow:**
```
Node A                          Node B
  |                               |
  |----[1] ClientHello + CertReq->|
  |                               |
  |<---[2] ServerHello + Cert-----|
  |                               |
  |----[3] ClientCert + Verify--->|
  |                               |
  |<---[4] Finished---------------|
  |----[5] Finished-------------->|
  |                               |
  |<---[6] Application Data------>|
```

---

#### Component 2.3: Connection Pool Manager
**Source:** New implementation (pattern from torcus-wallet coordinator)

**Purpose:** Maintain persistent QUIC connections to all peers

**Pool Design:**
- **Max Connections:** 50 per peer (for parallel MPC rounds)
- **Min Connections:** 2 per peer (hot standby)
- **Health Check:** Every 5s via ping stream
- **Auto-Reconnect:** On connection drop, retry with backoff

**Connection States:**
```
Idle → Connecting → Active → Degraded → Dead
         ↓            ↓         ↓         ↓
      [timeout]   [slow]    [error]   [remove]
```

**Connection Metrics:**
- Latency (p50, p99)
- Packet loss rate
- Stream success rate
- Last successful message timestamp

---

### Layer 3: Session & Message Management

#### Component 3.1: MPC Session Handler
**Source:** `torcus-wallet/crates/protocols/src/p2p/session.rs`

**Session Lifecycle:**

```
[1] Session Created
      ↓
[2] Peers Discovered (via etcd /cluster/peers)
      ↓
[3] QUIC Connections Established
      ↓
[4] Round 1 Messages Sent
      ↓
[5] Await Responses (timeout: 10s)
      ↓
[6] Round 2 Messages Sent
      ↓
... (repeat until protocol complete)
      ↓
[N] Session Finalized (signature/key produced)
```

**Session State Machine:**

| State | Trigger | Next State | Actions |
|-------|---------|-----------|---------|
| `Created` | Start command | `Connecting` | Fetch peer list from etcd |
| `Connecting` | All peers online | `Round1` | Send round 1 messages |
| `Round1` | All responses | `Round2` | Aggregate, send round 2 |
| `Round2` | All responses | `Round3` | Continue protocol |
| `RoundN` | Final round done | `Complete` | Store result, cleanup |
| `*` | Timeout (30s) | `Failed` | Log error, retry |
| `*` | Byzantine detected | `Aborted` | Log violation, exclude node |

**Message Format:**
```
MessageEnvelope {
  session_id: UUID,
  round_number: u32,
  sender_node_id: String,
  recipient_node_id: String,
  payload: ProtocolMessage,  // CGGMP24Round1 | FROSTRound2 | etc.
  signature: Vec<u8>,  // Ed25519 signature over payload
  timestamp: i64,
}
```

**Timeout Handling:**
- Per-round timeout: 10s
- Total session timeout: 60s
- On timeout: Mark slow nodes, exclude if >3 consecutive timeouts

---

#### Component 3.2: Request-Response Router
**Source:** New implementation (using QUIC bidirectional streams)

**Message Types:**

| Message | Direction | Purpose |
|---------|-----------|---------|
| `PingRequest` | Bidirectional | Health check |
| `DKGRoundMessage` | Bidirectional | Key generation round data |
| `SigningRoundMessage` | Bidirectional | Signature round data |
| `PresignatureRequest` | Client → Pool | Request presignature from pool |
| `VoteRequest` | Coordinator → Nodes | Request vote on transaction |
| `VoteResponse` | Nodes → Coordinator | Approve/Reject vote |
| `BroadcastTransaction` | Coordinator → Nodes | Notify of signed TX |

**Routing Logic:**
```
Incoming Message
      ↓
Extract message_type
      ↓
Match handler:
  - DKGRoundMessage → dkg_handler.process()
  - SigningRoundMessage → signing_handler.process()
  - VoteRequest → consensus_handler.vote()
  - ...
      ↓
Return Response (or Error)
```

**Handler Registration:**
- Each protocol registers handlers at startup
- Handlers are async functions: `async fn(msg: Message) -> Result<Response>`
- Unhandled message types return `UnsupportedMessageType` error

---

#### Component 3.3: Presignature Pool Manager
**Source:** `threshold-signing (Copy)/node/src/presignature_pool.rs`

**Why Presignature Pool?**
- **Problem:** CGGMP24 signing takes 2+ seconds (multiple rounds)
- **Solution:** Pre-generate signatures, use instantly when needed
- **Result:** Signing drops to <500ms (just final round)

**Pool Architecture:**

```
┌─────────────────────────────────────────┐
│         Presignature Pool               │
│  ┌───────────────────────────────────┐  │
│  │ Available: 87 presignatures       │  │
│  │ In-Use: 3 presignatures           │  │
│  │ Failed: 2 presignatures           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Background Generator Thread:           │
│  - Target: 100 presignatures           │
│  - Minimum: 20 presignatures           │
│  - Generation Rate: 5/minute           │
└─────────────────────────────────────────┘
```

**Pool Operations:**

**1. Background Generation:**
- Runs in separate tokio task
- Checks pool size every 10s
- If `available < 20`: Generate batch of 10
- Generation process:
  - Lock `/locks/presig-generation` in etcd
  - Run CGGMP24 presigning rounds with all peers
  - Store result in local state file
  - Unlock etcd lock

**2. Presignature Retrieval:**
- On signing request: Pop oldest presignature from pool
- Mark as `in-use` with transaction ID
- If signing fails: Mark as `failed`, try next presignature
- If signing succeeds: Delete from pool, log to PostgreSQL

**3. Pool Maintenance:**
- Every hour: Prune presignatures older than 24h (security best practice)
- Every day: Generate fresh batch even if pool full (rotation)

**Data Structure:**
```
Presignature {
  id: UUID,
  created_at: Timestamp,
  nonce_shares: HashMap<NodeId, NonceShare>,
  commitment: G1Point,
  status: Available | InUse | Failed,
  associated_tx: Option<String>,
}
```

---

### Layer 4: Consensus & Byzantine Protection

#### Component 4.1: Byzantine Detector
**Source:** `mtls-comm/crates/consensus/src/byzantine.rs`

**Violation Types Detected:**

**Type 1: Double Voting**
- **Definition:** Node sends two different votes for same transaction
- **Detection:** Store all votes in HashMap, check for duplicates
- **Evidence:** Both vote messages with signatures
- **Response:** Reject both votes, log violation

**Type 2: Invalid Signature**
- **Definition:** Vote signature doesn't verify against node's public key
- **Detection:** Verify Ed25519 signature on every vote
- **Evidence:** Vote message + failed verification
- **Response:** Reject vote, increment strike counter

**Type 3: Timeout/Silent**
- **Definition:** Node doesn't respond within timeout window
- **Detection:** Track response times, flag >10s responses
- **Evidence:** Request timestamp + no response
- **Response:** Exclude from current round, warning log

**Type 4: Malformed Message**
- **Definition:** Message doesn't deserialize or violates protocol rules
- **Detection:** Schema validation on every message
- **Evidence:** Raw message bytes + parse error
- **Response:** Reject message, log parsing error

**Detector Implementation:**

**Violation Tracking:**
```
ByzantineTracker {
  violations: HashMap<NodeId, Vec<Violation>>,
  strike_counts: HashMap<NodeId, u32>,
  banned_nodes: HashSet<NodeId>,
}

impl ByzantineTracker {
  fn record_violation(node_id, violation_type, evidence) {
    // Store violation
    // Increment strike count
    // If strikes >= 3: Ban node permanently
    // Write to PostgreSQL byzantine_violations table
  }

  fn is_banned(node_id) -> bool {
    // Check banned_nodes set
    // Also query etcd /cluster/banned/{node_id}
  }
}
```

**Integration Points:**
- Vote Processor: Calls detector on every vote
- Signing Handler: Validates signatures before aggregation
- Session Manager: Excludes banned nodes from peer list

---

#### Component 4.2: Vote Processor
**Source:** `mtls-comm/crates/consensus/src/vote_processor.rs`

**Voting Workflow:**

```
Transaction Request
      ↓
[1] Coordinator creates VoteRequest
      ↓
[2] Broadcast to all N nodes
      ↓
[3] Each node validates TX:
    - UTXO availability
    - Fee reasonableness
    - OP_RETURN validity
      ↓
[4] Node sends VoteResponse (Approve/Reject + signature)
      ↓
[5] Coordinator collects votes
      ↓
[6] Check threshold: >= t votes required
      ↓
[7] If met: Proceed to signing
    If not met: Abort transaction
```

**Vote Validation Rules:**

**Per-Vote Checks:**
- ✅ Signature valid (Ed25519 verify)
- ✅ Node ID in approved peer list
- ✅ Node not banned (check Byzantine tracker)
- ✅ Vote timestamp within 60s window
- ✅ No duplicate vote from same node (double-vote check)

**Threshold Logic:**
- **Configuration:** `t-of-n` threshold (e.g., 3-of-5)
- **Approval:** Requires `>= t` Approve votes
- **Rejection:** If `>= (n - t + 1)` Reject votes (majority impossible)
- **Timeout:** If not resolved in 30s, abort

**Vote Aggregation:**
```
VoteAggregator {
  votes_received: HashMap<NodeId, Vote>,
  approve_count: u32,
  reject_count: u32,
  threshold: u32,
  total_nodes: u32,
}

impl VoteAggregator {
  fn add_vote(node_id, vote) -> AggregationResult {
    // Validate vote
    // Store in votes_received
    // Increment approve_count or reject_count
    // Check if threshold met
    // Return: Approved | Rejected | Pending
  }
}
```

---

#### Component 4.3: Finite State Machine (FSM)
**Source:** `mtls-comm/crates/consensus/src/fsm.rs`

**Transaction FSM States:**

```
Created → Voting → Approved → Signing → Signed → Broadcasting → Broadcast → Confirmed
            ↓         ↓          ↓          ↓           ↓
         Rejected  TimedOut   Failed    Failed     Failed
                                                      ↓
                                                  [Retry 3x]
```

**State Definitions:**

| State | Entry Condition | Exit Condition | Timeout |
|-------|----------------|----------------|---------|
| `Created` | TX request received | Vote started | - |
| `Voting` | Vote request sent | t votes received | 30s |
| `Approved` | t approve votes | Signing started | - |
| `Signing` | Presig retrieved | Signature produced | 60s |
| `Signed` | Signature valid | Broadcast started | - |
| `Broadcasting` | Broadcast sent | Blockchain acks | 30s |
| `Broadcast` | In mempool | Block confirmation | 60min |
| `Confirmed` | In block | Final state | - |
| `Rejected` | t reject votes | Final state | - |
| `Failed` | Error occurred | Final state (or retry) | - |

**FSM Implementation:**
```
TransactionFSM {
  current_state: State,
  tx_data: Transaction,
  votes: VoteAggregator,
  signature: Option<Signature>,
  broadcast_result: Option<TxId>,
  error: Option<Error>,
}

impl TransactionFSM {
  async fn transition(&mut self, event: Event) -> Result<()> {
    match (self.current_state, event) {
      (Created, StartVote) => {
        // Send vote requests
        self.current_state = Voting;
      },
      (Voting, VoteReceived(vote)) => {
        // Add vote to aggregator
        if aggregator.is_approved() {
          self.current_state = Approved;
          // Trigger signing
        }
      },
      // ... all state transitions
    }
  }
}
```

**Persistence:**
- Every state transition logged to PostgreSQL `transactions` table
- Current state stored in etcd `/transactions/{txid}/state`
- On node restart: Load state from etcd, resume from last state

---

#### Component 4.4: Raft Coordinator (etcd)
**Source:** `mtls-comm/crates/storage/src/etcd.rs`

**Why Raft/etcd?**
- **Consensus:** All nodes agree on current state (no split-brain)
- **Atomic Operations:** Distributed locks prevent race conditions
- **Leader Election:** Automatic failover if coordinator crashes
- **Consistency:** Strong consistency guarantees (linearizability)

**Critical Operations:**

**1. Distributed Locking:**
```
Purpose: Ensure only one signing session per transaction

Pseudocode:
  lock_key = f"/locks/signing/{txid}"
  lease = etcd.grant_lease(ttl=30s)

  success = etcd.put_if_not_exists(lock_key, node_id, lease)

  if success:
    // Acquired lock
    perform_signing()
    etcd.delete(lock_key)  // Release lock
  else:
    // Another node already signing
    wait_or_abort()
```

**2. Atomic Counters:**
```
Purpose: Generate unique transaction IDs

Pseudocode:
  counter_key = "/counters/transactions"

  loop:
    current_value = etcd.get(counter_key)
    new_value = current_value + 1

    success = etcd.compare_and_swap(counter_key, current_value, new_value)

    if success:
      return new_value  // Got unique ID
    else:
      continue  // Retry (another node incremented)
```

**3. Leader Election:**
```
Purpose: Elect transaction coordinator among nodes

Pseudocode:
  election_key = "/cluster/coordinator"
  lease = etcd.grant_lease(ttl=10s)

  success = etcd.put_if_not_exists(election_key, my_node_id, lease)

  if success:
    // I am coordinator
    renew_lease_every(5s)
    coordinate_transactions()
  else:
    // Another node is coordinator
    watch_for_changes(election_key)  // Detect coordinator failure
```

**4. Heartbeat Monitoring:**
```
Purpose: Detect crashed nodes

Every node:
  Every 3s:
    etcd.put(f"/nodes/{my_id}/heartbeat", timestamp(), ttl=5s)

Coordinator:
  Every 5s:
    for peer_id in peers:
      heartbeat = etcd.get(f"/nodes/{peer_id}/heartbeat")
      if heartbeat is None:
        mark_node_as_dead(peer_id)
```

---

### Layer 5: Cryptographic Protocols

#### Component 5.1: CGGMP24 Protocol Engine
**Source:** `threshold-signing (Copy)/crypto/src/cggmp24/`

**Protocol Phases:**

**Phase 1: Distributed Key Generation (DKG)**
**Source File:** `keygen.rs`

**Purpose:** Generate ECDSA key pair where private key is secret-shared

**Rounds:**
```
Round 1: Commitment Phase
  - Each node generates random polynomial coefficients
  - Commits to coefficients (hash commitment)
  - Broadcasts commitments to all peers

Round 2: Share Distribution
  - Each node evaluates polynomial at peer indices
  - Sends shares to corresponding peers (encrypted)
  - Receives shares from all peers

Round 3: Share Verification
  - Each node verifies received shares against commitments
  - If verification fails: Complain & restart
  - If all valid: Compute local key share

Round 4: Public Key Derivation
  - Each node broadcasts verification key
  - All nodes compute same public key (via Lagrange interpolation)
  - Store: private_share, public_key, peer_verification_keys
```

**Output:**
- Node's secret share: `x_i` (scalar)
- Public key: `Y = x * G` (EC point)
- Verification keys: `{Y_1, Y_2, ..., Y_n}` (for signature verification)

---

**Phase 2: Auxiliary Info Generation**
**Source File:** `aux_info.rs`

**Purpose:** Generate zero-knowledge proof parameters (one-time setup)

**Steps:**
```
1. Paillier Key Generation
   - Each node generates Paillier public/private key pair
   - Paillier keys enable additive homomorphic encryption

2. Ring-Pedersen Parameters
   - Generate safe primes for ZK proofs
   - Required for proving correctness without revealing secrets

3. Proof of Knowledge
   - Each node proves it knows discrete log of verification key
   - Prevents rogue-key attacks

4. Parameter Exchange
   - Nodes exchange Paillier public keys
   - Store in local state (reused for all signatures)
```

**Output:**
- Paillier keys: `(paillier_pk, paillier_sk)`
- Ring-Pedersen params: `(N, s, t)`
- Peer Paillier public keys: `{paillier_pk_1, ..., paillier_pk_n}`

**Performance:** ~30s for 5 nodes (only done once after DKG)

---

**Phase 3: Presignature Generation**
**Source File:** `signing.rs` (presigning rounds)

**Purpose:** Pre-compute signature components (k, R) for later use

**Rounds:**
```
Round 1: Nonce Generation
  - Each node generates random nonce k_i
  - Computes commitment R_i = k_i * G
  - Encrypts k_i with Paillier encryption
  - Broadcasts: enc(k_i), R_i, ZK proof of correctness

Round 2: Nonce Aggregation
  - Collect all R_i commitments
  - Compute R = R_1 + R_2 + ... + R_n (EC point addition)
  - Store: (k_i, R) as presignature
```

**Output (per node):**
- Nonce share: `k_i`
- Group commitment: `R` (same for all nodes)

**Performance:** ~400ms for 5 nodes (batched in background)

---

**Phase 4: Fast Signing (with Presignature Pool)**
**Source File:** `threshold-signing (Copy)/node/src/signing_fast.rs`

**Purpose:** Sign message hash using pre-computed presignature

**Rounds:**
```
Round 1: Retrieve Presignature
  - Pop (k_i, R) from presignature pool
  - Extract r = R.x (x-coordinate of R)

Round 2: Partial Signature Computation
  - Compute s_i = k_i^(-1) * (H(m) + r * x_i)  [mod q]
  - Broadcast s_i to all peers

Round 3: Signature Aggregation
  - Collect t partial signatures {s_1, s_2, ..., s_t}
  - Compute s = s_1 + s_2 + ... + s_t  [mod q]
  - Final signature: (r, s)

Round 4: Verification
  - Verify: s * G == R + H(m) * Y
  - If valid: Return signature
```

**Output:**
- ECDSA signature: `(r, s)` (64 bytes)

**Performance:** <500ms for 5 nodes (vs 2s without presignatures)

---

#### Component 5.2: FROST Protocol Engine
**Source:** `torcus-wallet/crates/protocols/src/frost/`

**Why FROST?**
- **Schnorr Signatures:** Native support for Bitcoin Taproot
- **Simpler:** Fewer rounds than CGGMP24 (2 rounds vs 5+)
- **Non-Interactive DKG:** Can use Pedersen VSS (faster setup)
- **Better Privacy:** Signature indistinguishable from single-key signature

**Protocol Phases:**

**Phase 1: DKG (Distributed Key Generation)**
**Source File:** `keygen.rs`

**Rounds:**
```
Round 1: VSS Commitment
  - Each node generates random polynomial f_i(x) of degree t-1
  - Computes commitments C_i = [f_i(0)*G, f_i(1)*G, ..., f_i(t-1)*G]
  - Broadcasts C_i to all peers

Round 2: Share Distribution
  - Each node sends f_i(j) to peer j (encrypted)
  - Receives shares from all peers
  - Verifies shares: f_i(j)*G == C_i[0] + j*C_i[1] + ... + j^(t-1)*C_i[t-1]

Round 3: Secret Aggregation
  - Each node computes x_i = f_1(i) + f_2(i) + ... + f_n(i)
  - Public key: Y = C_1[0] + C_2[0] + ... + C_n[0]
```

**Output:**
- Secret share: `x_i`
- Public key: `Y` (Taproot-compatible)

**Performance:** ~500ms for 5 nodes (simpler than CGGMP24)

---

**Phase 2: Signing**
**Source File:** `signing.rs`

**Rounds:**
```
Round 1: Nonce Commitment
  - Each signer i generates random d_i, e_i
  - Computes D_i = d_i*G, E_i = e_i*G
  - Broadcasts (D_i, E_i)

Round 2: Signature Share
  - Binding value: ρ_i = H(i, m, {D_j, E_j})
  - Nonce: R_i = D_i + ρ_i * E_i
  - Group nonce: R = R_1 + R_2 + ... + R_t
  - Challenge: c = H(R, Y, m)
  - Response: z_i = d_i + e_i*ρ_i + λ_i*x_i*c  [λ_i = Lagrange coefficient]
  - Broadcast z_i

Round 3: Aggregation
  - Compute z = z_1 + z_2 + ... + z_t
  - Signature: (R, z)
  - Verify: z*G == R + c*Y
```

**Output:**
- Schnorr signature: `(R, z)` (64 bytes)

**Performance:** ~800ms for 5 nodes (no presignature pool yet)

---

#### Component 5.3: Protocol Selection Logic
**Source:** New implementation

**When to Use CGGMP24 vs FROST:**

| Criterion | CGGMP24 | FROST |
|-----------|---------|-------|
| **Bitcoin Address Type** | P2WPKH, P2WSH (SegWit) | P2TR (Taproot) |
| **Signature Type** | ECDSA | Schnorr |
| **Performance (with pool)** | <500ms | ~800ms |
| **Setup Complexity** | High (aux info) | Medium (VSS) |
| **Privacy** | Medium (linkable sigs) | High (indistinguishable) |
| **Use Case** | Legacy/SegWit wallets | Modern Taproot wallets |

**Decision Tree:**
```
Is Taproot required?
  ├─ Yes → Use FROST
  └─ No → Use CGGMP24
            ├─ Need <500ms signing? → Use with Presignature Pool
            └─ Setup simplicity priority? → Use without pool
```

**Implementation:**
```
enum ProtocolType {
  CGGMP24,
  FROST,
}

impl Wallet {
  fn select_protocol(address_type: AddressType) -> ProtocolType {
    match address_type {
      AddressType::P2TR => ProtocolType::FROST,
      AddressType::P2WPKH | AddressType::P2WSH => ProtocolType::CGGMP24,
    }
  }
}
```

---

### Layer 6: Business Logic & Orchestration

#### Component 6.1: Transaction Builder
**Source:** `torcus-wallet/crates/common/src/bitcoin_tx.rs`

**Purpose:** Construct unsigned Bitcoin transactions with OP_RETURN metadata

**Transaction Building Steps:**

```
Step 1: UTXO Selection
  - Fetch all UTXOs for wallet address (via Esplora API)
  - Filter confirmed UTXOs (at least 1 confirmation)
  - Select UTXOs to cover: amount + fee
  - Strategy: Largest-first (minimize UTXO fragmentation)

Step 2: Fee Estimation
  - Query mempool fee rates (sat/vB)
  - Estimate transaction size:
    - Inputs: num_inputs * 68 vB (SegWit P2WPKH)
    - Outputs: num_outputs * 31 vB
    - OP_RETURN: 83 vB (80 bytes data + overhead)
    - Overhead: 10 vB
  - Total fee = (estimated_size) * (fee_rate)

Step 3: Output Construction
  - Output 1: Recipient address + amount
  - Output 2: OP_RETURN + metadata (80 bytes max)
  - Output 3: Change address + (total_input - amount - fee)

Step 4: Unsigned TX Assembly
  - Version: 2
  - Inputs: [UTXOs selected]
  - Outputs: [recipient, OP_RETURN, change]
  - Locktime: 0 (or current block height for anti-fee-sniping)
  - Witness: Empty (filled after signing)
```

**OP_RETURN Metadata Format:**
```
Byte Layout (80 bytes max):
  [0-3]:   Magic bytes "MPCW" (identifies our wallet)
  [4-7]:   Version (u32, currently 1)
  [8-15]:  Timestamp (u64, Unix epoch)
  [16-47]: Transaction UUID (32 bytes)
  [48-79]: Custom metadata (JSON compressed with zstd)

Example Metadata:
{
  "tx_type": "withdrawal",
  "requester": "user-12345",
  "approval_count": 3,
  "policy_id": "pol-abc"
}
```

**Integration:**
```
Function Signature:
  build_unsigned_transaction(
    recipient: Address,
    amount: u64,
    metadata: Vec<u8>,
    fee_rate: u64,
  ) -> Result<UnsignedTransaction>

Returns:
  UnsignedTransaction {
    txid: String,  // Hash of unsigned TX
    raw_tx: Vec<u8>,  // Serialized transaction
    sighashes: Vec<[u8; 32]>,  // One per input (for signing)
    utxos_used: Vec<UTXO>,
  }
```

---

#### Component 6.2: Signing Coordinator
**Source:** New implementation (orchestrates pool + protocol)

**Purpose:** Manage end-to-end signing workflow

**Workflow:**

```
[1] Receive Signing Request
    ↓
[2] Select Protocol (CGGMP24 or FROST based on address type)
    ↓
[3] Acquire Presignature from Pool
    ├─ If CGGMP24: Pop from presignature_pool
    └─ If FROST: Generate fresh nonce (no pool yet)
    ↓
[4] Create MPC Session
    ├─ Session ID: UUID
    ├─ Participants: Threshold nodes (t-of-n)
    └─ Message: sighash from unsigned TX
    ↓
[5] Execute Signing Rounds
    ├─ Round 1: Distribute presignature/nonce commitments
    ├─ Round 2: Compute partial signatures
    └─ Round 3: Aggregate into final signature
    ↓
[6] Verify Signature
    ├─ Check: verify_ecdsa(sig, sighash, pubkey) == true
    └─ If invalid: Retry with next presignature
    ↓
[7] Attach Signature to TX
    ├─ Fill witness field with signature
    └─ Serialize final transaction
    ↓
[8] Return Signed Transaction
```

**Error Handling:**

| Error | Recovery Strategy |
|-------|------------------|
| Presignature pool empty | Wait 10s for generation, retry |
| Node timeout | Exclude node, retry with different t nodes |
| Invalid signature | Try next presignature (max 3 attempts) |
| Byzantine detected | Abort, log violation, alert operator |
| Network partition | Retry after 30s (etcd resolves partition) |

**Metrics Tracked:**
- Signing latency (p50, p99, p999)
- Presignature usage rate
- Signature verification failures
- Byzantine events per hour

---

#### Component 6.3: Wallet State Manager
**Source:** New implementation (inspired by torcus-wallet coordinator state)

**Purpose:** Track wallet balance, UTXOs, and transaction history

**State Structure:**
```
WalletState {
  // Identity
  wallet_id: String,
  public_key: PublicKey,  // Derived from DKG
  address: String,  // Bitcoin address

  // Balance
  confirmed_balance: u64,  // Satoshis in confirmed TXs
  unconfirmed_balance: u64,  // Satoshis in mempool

  // UTXOs
  utxos: Vec<UTXO>,

  // Transaction History
  pending_txs: HashMap<TxId, Transaction>,
  confirmed_txs: Vec<Transaction>,

  // MPC State
  key_share: KeyShare,  // CGGMP24 or FROST share
  threshold: (u32, u32),  // (t, n)
  peers: Vec<PeerInfo>,
}

UTXO {
  txid: String,
  vout: u32,
  value: u64,
  script_pubkey: Vec<u8>,
  confirmations: u32,
}

Transaction {
  txid: String,
  raw_tx: Vec<u8>,
  status: TxStatus,  // Pending | Broadcast | Confirmed
  created_at: Timestamp,
  confirmed_at: Option<Timestamp>,
  block_height: Option<u32>,
}
```

**Operations:**

**1. Sync UTXOs:**
```
Every 60s:
  - Fetch UTXOs from Esplora API
  - Diff with local UTXO set
  - Add new UTXOs (from received TXs)
  - Remove spent UTXOs
  - Update balances
```

**2. Track Transaction:**
```
On TX broadcast:
  - Add to pending_txs
  - Poll Esplora every 10s for confirmation
  - Once confirmed: Move to confirmed_txs
  - Update UTXO set (remove spent, add new)
```

**3. Persist State:**
```
On every change:
  - Serialize WalletState to JSON
  - Encrypt with ChaCha20-Poly1305
  - Atomic write to state.json (write temp + rename)
```

---

### Layer 7: Application Interface

#### Component 7.1: REST API
**Source:** New implementation (Axum framework)

**Endpoints:**

**Authentication:**
- All endpoints require JWT token in `Authorization: Bearer <token>` header
- JWT signed with node's private key, verified by coordinator

**API Routes:**

```
POST /api/v1/wallet/create
  Description: Initialize new MPC wallet (run DKG)
  Request: {
    "threshold": 3,
    "total_nodes": 5,
    "protocol": "cggmp24" | "frost"
  }
  Response: {
    "wallet_id": "wallet-abc123",
    "public_key": "02a1b2c3...",
    "address": "bc1q..."
  }

GET /api/v1/wallet/{wallet_id}/balance
  Description: Get current balance
  Response: {
    "confirmed": 1000000,
    "unconfirmed": 50000,
    "total_utxos": 3
  }

GET /api/v1/wallet/{wallet_id}/utxos
  Description: List all UTXOs
  Response: {
    "utxos": [
      {"txid": "abc...", "vout": 0, "value": 500000, "confirmations": 6},
      ...
    ]
  }

POST /api/v1/wallet/{wallet_id}/send
  Description: Create and sign transaction
  Request: {
    "recipient": "bc1q...",
    "amount": 100000,
    "fee_rate": 10,
    "metadata": {"memo": "Payment for services"}
  }
  Response: {
    "txid": "def123...",
    "status": "broadcast",
    "explorer_url": "https://mempool.space/tx/def123..."
  }

GET /api/v1/wallet/{wallet_id}/transactions
  Description: Get transaction history
  Query Params: ?limit=50&offset=0
  Response: {
    "transactions": [
      {
        "txid": "abc...",
        "status": "confirmed",
        "block_height": 800000,
        "confirmations": 6
      },
      ...
    ]
  }

GET /api/v1/pool/status
  Description: Check presignature pool status
  Response: {
    "available": 87,
    "in_use": 3,
    "target": 100,
    "generation_rate": 5.2
  }

GET /api/v1/consensus/votes/{tx_id}
  Description: View voting status for transaction
  Response: {
    "votes_received": 3,
    "threshold": 3,
    "result": "approved",
    "votes": [
      {"node_id": "node-1", "vote": "approve", "timestamp": 1234567890},
      ...
    ]
  }

GET /api/v1/health
  Description: Health check endpoint
  Response: {
    "status": "healthy",
    "uptime_seconds": 86400,
    "peer_count": 4,
    "pool_size": 87
  }
```

---

#### Component 7.2: CLI Tool
**Source:** `torcus-wallet/crates/cli/src/main.rs` (adapt structure)

**Commands:**

```bash
# Wallet Management
mpc-wallet init --threshold 3 --nodes 5 --protocol cggmp24
mpc-wallet balance --wallet-id wallet-abc123
mpc-wallet address --wallet-id wallet-abc123

# Transactions
mpc-wallet send \
  --wallet-id wallet-abc123 \
  --to bc1q... \
  --amount 0.001 \
  --fee-rate 10 \
  --metadata '{"memo": "test"}'

mpc-wallet history --wallet-id wallet-abc123 --limit 10

# Node Operations
mpc-wallet node start --config config.toml
mpc-wallet node status
mpc-wallet node peers

# Pool Management
mpc-wallet pool status
mpc-wallet pool generate --count 10

# Debugging
mpc-wallet logs --level debug --follow
mpc-wallet metrics --format prometheus
```

**Configuration File (config.toml):**
```toml
[node]
id = "node-01"
listen_address = "0.0.0.0:9000"
data_dir = "/var/lib/mpc-wallet"

[network]
bootstrap_peers = [
  "node-02.mpc.internal:9000",
  "node-03.mpc.internal:9000"
]
max_connections = 50
connection_timeout_ms = 5000

[security]
cert_path = "/etc/mpc-wallet/certs/node-01.crt"
key_path = "/etc/mpc-wallet/certs/node-01.key"
ca_cert_path = "/etc/mpc-wallet/certs/ca.crt"

[storage]
state_file = "/var/lib/mpc-wallet/state.json"
encryption_key_env = "STATE_ENCRYPTION_KEY"

[postgres]
host = "localhost"
port = 5432
database = "mpc_wallet"
username = "mpc_user"
password_env = "POSTGRES_PASSWORD"

[etcd]
endpoints = ["http://etcd-1:2379", "http://etcd-2:2379"]
timeout_ms = 5000

[bitcoin]
network = "mainnet"  # or "testnet", "regtest"
esplora_url = "https://blockstream.info/api"
rpc_url = "http://localhost:8332"  # optional

[protocols.cggmp24]
enable_presignature_pool = true
pool_target_size = 100
pool_min_size = 20
generation_batch_size = 10

[protocols.frost]
enable = true

[consensus]
vote_timeout_ms = 30000
signing_timeout_ms = 60000

[logging]
level = "info"
format = "json"
output = "stdout"
```

---

## 📊 Data Flow & Protocol Orchestration

### End-to-End Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ [USER] → POST /api/v1/wallet/{id}/send                             │
│   {recipient, amount, fee_rate, metadata}                           │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Transaction Builder                                   │
│  1. Fetch UTXOs from Esplora                                        │
│  2. Select UTXOs to cover amount + fee                              │
│  3. Build unsigned TX with OP_RETURN(metadata)                      │
│  4. Compute sighashes for each input                                │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Consensus Layer                                       │
│  1. Acquire etcd lock: /locks/signing/{txid}                        │
│  2. Create VoteRequest message                                      │
│  3. Broadcast to all N nodes via QUIC                               │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [NODES] Vote Processing                                             │
│  1. Validate TX (UTXO exists, fee reasonable, etc.)                 │
│  2. Generate VoteResponse (Approve/Reject)                          │
│  3. Sign vote with Ed25519 private key                              │
│  4. Send vote to coordinator via QUIC                               │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Vote Aggregation                                      │
│  1. Collect votes (timeout: 30s)                                    │
│  2. Verify signatures (detect Byzantine behavior)                   │
│  3. Check threshold: >= t Approve votes                             │
│  4. Write votes to PostgreSQL (audit trail)                         │
│  5. Update FSM: Voting → Approved                                   │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Signing Orchestration                                 │
│  1. Select protocol: CGGMP24 (for SegWit) or FROST (for Taproot)   │
│  2. Retrieve presignature from pool (if CGGMP24)                    │
│  3. Create MPC signing session (session_id: UUID)                   │
│  4. Select t signing nodes (exclude Byzantine nodes)                │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [NODES] MPC Signing Rounds (CGGMP24 Fast)                          │
│                                                                     │
│  Round 1: Presignature Retrieval                                    │
│    - Each node loads (k_i, R) from presignature pool               │
│    - Coordinator broadcasts sighash(m)                              │
│                                                                     │
│  Round 2: Partial Signature Computation                             │
│    - Each node computes: s_i = k_i^(-1) * (H(m) + r * x_i)         │
│    - Broadcast s_i to all peers via dedicated QUIC stream           │
│                                                                     │
│  Round 3: Signature Aggregation                                     │
│    - Coordinator collects {s_1, ..., s_t}                           │
│    - Computes: s = s_1 + s_2 + ... + s_t                           │
│    - Final signature: (r, s)                                        │
│                                                                     │
│  Round 4: Verification                                              │
│    - Verify: s*G == R + H(m)*Y                                      │
│    - If valid: Signature complete (TIME: <500ms)                    │
│    - If invalid: Retry with next presignature                       │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Transaction Finalization                              │
│  1. Attach signature to unsigned TX (fill witness field)            │
│  2. Serialize final transaction                                     │
│  3. Update FSM: Signing → Signed                                    │
│  4. Log to PostgreSQL: signature + timing                           │
│  5. Mark presignature as used (delete from pool)                    │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Blockchain Broadcast                                  │
│  1. POST signed TX to Esplora: /tx                                  │
│  2. Receive TXID from blockchain node                               │
│  3. Update FSM: Signed → Broadcast                                  │
│  4. Release etcd lock: /locks/signing/{txid}                        │
│  5. Start polling for confirmation (every 30s)                      │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Confirmation Monitoring                               │
│  1. Poll Esplora: GET /tx/{txid}/status                             │
│  2. Wait for block inclusion (timeout: 60 min)                      │
│  3. On confirmation:                                                │
│     - Update FSM: Broadcast → Confirmed                             │
│     - Update wallet state (remove spent UTXOs)                      │
│     - Write to PostgreSQL: confirmed_at, block_height               │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [USER] ← Response                                                   │
│  {                                                                  │
│    "txid": "abc123...",                                             │
│    "status": "confirmed",                                           │
│    "block_height": 800123,                                          │
│    "explorer_url": "https://mempool.space/tx/abc123..."             │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Presignature Pool Background Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Background Task] Pool Monitor (runs every 10s)                     │
│  1. Check pool size                                                 │
│  2. If available < 20: Trigger generation                           │
│  3. Acquire etcd lock: /locks/presig-generation                     │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Presignature Generation Session                       │
│  1. Select t nodes for generation                                   │
│  2. Create MPC session (batch: 10 presignatures)                    │
│  3. Broadcast generation request via QUIC                           │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [NODES] CGGMP24 Presigning Rounds                                  │
│                                                                     │
│  Round 1: Nonce Generation                                          │
│    - Each node generates random k_i                                 │
│    - Computes R_i = k_i * G                                         │
│    - Encrypts k_i with Paillier encryption                          │
│    - Broadcasts: enc(k_i), R_i, ZK proof                            │
│                                                                     │
│  Round 2: Nonce Aggregation                                         │
│    - Collect all {R_1, R_2, ..., R_t}                               │
│    - Compute R = R_1 + R_2 + ... + R_t                              │
│    - Each node stores: (k_i, R) as presignature                     │
│                                                                     │
│  TIME: ~400ms per presignature (batched: 4s for 10)                │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [NODES] Store Presignatures                                         │
│  1. Add to local presignature_pool vector                           │
│  2. Encrypt with state encryption key                               │
│  3. Write to state.json (atomic write)                              │
│  4. Log to PostgreSQL: presig_id, created_at                        │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [COORDINATOR] Pool Update                                           │
│  1. Increment etcd counter: /counters/presignatures                 │
│  2. Update Prometheus metric: presignature_pool_size                │
│  3. Release etcd lock: /locks/presig-generation                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Compliance Framework

### Threat Model

**Assets to Protect:**
1. Private key shares (loss = wallet compromise)
2. Presignatures (reuse = signature forgery)
3. Node certificates (theft = impersonation)
4. Transaction metadata (leak = privacy violation)

**Threat Actors:**
- **External Attacker:** Network eavesdropper, MITM
- **Byzantine Node:** Compromised insider node
- **Malicious Operator:** Rogue administrator

**Attack Vectors & Mitigations:**

| Attack | Mitigation |
|--------|-----------|
| **Key Share Extraction** | At-rest encryption (ChaCha20), HSM storage (future) |
| **MITM on QUIC** | mTLS with certificate pinning |
| **Byzantine Double-Vote** | Violation detector + PostgreSQL audit |
| **Presignature Reuse** | One-time use enforcement, deletion after use |
| **etcd Compromise** | No secrets in etcd (only coordination data) |
| **Replay Attack** | Timestamp validation (60s window) |
| **DDoS on Coordinator** | Rate limiting (10 req/s per peer) |

---

### Compliance Requirements

**SOC 2 Type II:**
- ✅ Audit logging: All transactions, votes, Byzantine events
- ✅ Access control: mTLS + JWT authentication
- ✅ Encryption: At-rest (AES-256) + In-transit (TLS 1.3)
- ✅ Monitoring: Real-time alerts on Byzantine violations

**PCI-DSS (if handling card data):**
- ✅ Network segmentation: Separate VLAN for MPC nodes
- ✅ Key rotation: Certificates renewed every 30 days
- ✅ Logging retention: 1 year in PostgreSQL

**GDPR (if storing EU user data):**
- ✅ Data minimization: Only store transaction metadata, no PII
- ✅ Right to erasure: Soft-delete transactions (retain audit hash)
- ✅ Encryption: All data encrypted with user-provided key

---

### Certificate Management

**CA Hierarchy:**
```
Root CA (offline, HSM)
    ↓
Intermediate CA (online, rotated every 2 years)
    ↓
Node Certificates (90-day validity, auto-renewed at 60 days)
```

**Certificate Deployment:**
1. Generate root CA once (store offline)
2. Generate intermediate CA, sign with root
3. Deploy intermediate CA cert to all nodes
4. Each node generates CSR, submits to CA service
5. CA service signs CSR, returns cert
6. Node stores cert in `/etc/mpc-wallet/certs/`

**Rotation Process:**
```
Day 0: Cert issued (valid 90 days)
Day 30: Background task checks expiry
Day 60: Generate new CSR, request new cert
Day 61: Receive new cert, store alongside old cert
Day 62-69: Overlap period (both certs valid)
Day 70: Delete old cert
```

**Revocation:**
- Maintain CRL (Certificate Revocation List) in etcd: `/certs/revoked`
- On peer connect: Check CRL before accepting connection
- Emergency revocation: Operator adds cert serial to CRL, all nodes refresh

---

## ⚡ Performance Optimization Strategy

### Latency Targets

| Operation | Target | Actual (5 nodes) |
|-----------|--------|------------------|
| DKG (CGGMP24) | <10s | ~8s |
| DKG (FROST) | <3s | ~500ms |
| Aux Info Generation | <60s | ~30s |
| Presignature Generation | <1s | ~400ms |
| Signing (with pool) | <500ms | ~350ms |
| Signing (without pool) | <3s | ~2s |
| Vote Aggregation | <1s | ~200ms |
| TX Broadcast | <5s | ~2s (Esplora latency) |

### Bottleneck Analysis

**Bottleneck 1: Signing Latency (2s → 500ms)**
- **Root Cause:** Multiple rounds of MPC protocol
- **Solution:** Presignature pool (pre-compute rounds 1-2)
- **Implementation:** Extract from `threshold-signing/node/src/presignature_pool.rs`

**Bottleneck 2: QUIC Handshake (0-RTT not used)**
- **Root Cause:** New connection per signing session
- **Solution:** Connection pool with persistent connections
- **Implementation:** Maintain 2-5 warm connections per peer

**Bottleneck 3: PostgreSQL Write Latency**
- **Root Cause:** Synchronous writes block signing flow
- **Solution:** Async write queue with batching
- **Implementation:** Buffer 100 writes, flush every 5s or on demand

**Bottleneck 4: etcd Lock Contention**
- **Root Cause:** All nodes compete for same lock
- **Solution:** Shard locks by transaction ID hash
- **Implementation:** Lock key: `/locks/signing/{txid % 10}`

---

### Caching Strategy

**Cache 1: Peer Public Keys**
- **Data:** Ed25519 verification keys for all peers
- **Location:** In-memory HashMap
- **TTL:** Infinite (updated on peer join/leave)
- **Hit Rate:** ~100% (static data)

**Cache 2: UTXO Set**
- **Data:** Wallet's unspent outputs
- **Location:** In-memory + disk (state.json)
- **TTL:** 60s (refresh from Esplora)
- **Hit Rate:** ~90% (most TXs use recent UTXOs)

**Cache 3: Fee Estimates**
- **Data:** Mempool fee rates (sat/vB)
- **Location:** In-memory
- **TTL:** 120s
- **Hit Rate:** ~80% (fees don't change rapidly)

**Cache 4: Presignatures**
- **Data:** Pre-computed (k_i, R) pairs
- **Location:** Disk (state.json) + in-memory pool
- **TTL:** 24h (prune old presigs)
- **Hit Rate:** ~95% (pool rarely empty)

---

## 🗺️ Implementation Roadmap

### Phase 0: Project Setup (Week 1)

**Deliverables:**
- [ ] Create `production/` directory structure
- [ ] Initialize Cargo workspace with crates:
  - `crates/network` (QUIC + mTLS)
  - `crates/security` (certificates)
  - `crates/consensus` (Byzantine + voting)
  - `crates/protocols` (CGGMP24 + FROST)
  - `crates/storage` (PostgreSQL + etcd + state file)
  - `crates/bitcoin` (TX building + broadcast)
  - `crates/api` (REST API)
  - `crates/cli` (CLI tool)
- [ ] Set up PostgreSQL schema (tables: transactions, voting_rounds, byzantine_violations)
- [ ] Deploy etcd cluster (3 nodes for HA)
- [ ] Generate root CA and intermediate CA

---

### Phase 1: Network & Security Layer (Week 2-3)

**Tasks:**

**1. QUIC Transport Foundation**
- [ ] Copy `torcus-wallet/crates/protocols/src/p2p/quic_transport.rs`
- [ ] Copy `torcus-wallet/crates/protocols/src/p2p/session.rs`
- [ ] Copy `torcus-wallet/crates/protocols/src/p2p/quic_listener.rs`
- [ ] Adapt to use quinn 0.10.x (latest stable)
- [ ] Implement stream ID convention (control, DKG, signing, presig)
- [ ] Add connection pooling (max 50 per peer)

**2. mTLS Integration**
- [ ] Copy `mtls-comm/crates/network/src/cert_manager.rs`
- [ ] Copy `mtls-comm/crates/network/src/tls_config.rs`
- [ ] Wrap QUIC connections with mTLS validation
- [ ] Implement certificate verification callback:
  - Verify signature chain (root → intermediate → node)
  - Extract node ID from CN field
  - Check expiry (reject if <7 days remaining)
  - Check CRL (query etcd `/certs/revoked`)
- [ ] Implement certificate rotation logic:
  - Background task checks expiry every 24h
  - Generate CSR at 60 days remaining
  - Request new cert from CA service
  - Store new cert, overlap for 7 days, delete old

**3. Testing**
- [ ] Unit test: Certificate validation (valid, expired, revoked, invalid CN)
- [ ] Integration test: QUIC connection with mTLS handshake
- [ ] Load test: 100 concurrent connections per node
- [ ] Security test: MITM attempt (should fail)

**Acceptance Criteria:**
- ✅ Two nodes can establish mTLS QUIC connection
- ✅ Invalid certificate rejected
- ✅ Connection survives 24h with keep-alive
- ✅ Latency p99 <50ms for new connection

---

### Phase 2: Storage & Coordination Layer (Week 4)

**Tasks:**

**1. etcd Integration**
- [ ] Copy `mtls-comm/crates/storage/src/etcd.rs`
- [ ] Implement distributed lock operations:
  - `acquire_lock(key, ttl)` → Result<Lease>
  - `renew_lock(lease)` → Result<()>
  - `release_lock(lease)` → Result<()>
- [ ] Implement atomic counter operations:
  - `increment_counter(key)` → Result<u64>
  - `get_counter(key)` → Result<u64>
- [ ] Implement leader election:
  - `try_become_leader(key)` → Result<bool>
  - `is_leader(key)` → bool
  - `watch_leader(key)` → Stream<LeaderChange>
- [ ] Implement heartbeat system:
  - Background task writes `/nodes/{id}/heartbeat` every 3s
  - Coordinator polls all heartbeats every 5s
  - Mark node dead if heartbeat missing

**2. PostgreSQL Integration**
- [ ] Copy `mtls-comm/crates/storage/src/postgres.rs`
- [ ] Create schema (migrations with sqlx):
  - `transactions` table
  - `voting_rounds` table
  - `byzantine_violations` table
  - `presignature_usage` table
- [ ] Implement async write operations:
  - `insert_transaction(tx)` → Result<i64>
  - `update_transaction_status(id, status)` → Result<()>
  - `insert_vote(round_id, votes)` → Result<()>
  - `insert_byzantine_violation(node_id, evidence)` → Result<()>
- [ ] Implement write batching:
  - Buffer up to 100 writes
  - Flush every 5s or on demand

**3. Local State File**
- [ ] Define state schema (JSON):
  - node_config, key_shares, aux_info, presignatures, metadata
- [ ] Implement encryption (ChaCha20-Poly1305):
  - Key derivation from env var via Argon2id
  - AEAD with associated data (version string)
- [ ] Implement atomic writes:
  - Write to `state.json.tmp`
  - fsync()
  - Rename to `state.json`
- [ ] Implement state loading:
  - Read `state.json`
  - Decrypt and deserialize
  - Validate version compatibility

**4. Testing**
- [ ] Unit test: etcd lock acquisition (concurrent attempts)
- [ ] Unit test: PostgreSQL write batching (1000 writes <1s)
- [ ] Unit test: State file encryption (decrypt matches plaintext)
- [ ] Integration test: Leader election (kill leader, new leader elected)

**Acceptance Criteria:**
- ✅ etcd locks prevent race conditions (100 concurrent lock attempts, only 1 succeeds)
- ✅ PostgreSQL handles 1000 writes/s
- ✅ State file survives encryption/decryption round-trip
- ✅ Leader election completes within 5s of leader failure

---

### Phase 3: Consensus & Byzantine Protection (Week 5-6)

**Tasks:**

**1. Byzantine Detector**
- [ ] Copy `mtls-comm/crates/consensus/src/byzantine.rs`
- [ ] Implement violation detection:
  - `check_double_vote(votes)` → Option<Violation>
  - `verify_signature(vote, pubkey)` → Result<()>
  - `check_timeout(vote, deadline)` → Option<Violation>
  - `validate_message_format(msg)` → Result<()>
- [ ] Implement violation tracking:
  - In-memory HashMap: `node_id → Vec<Violation>`
  - Increment strike counter on each violation
  - Ban node after 3 strikes (add to etcd `/cluster/banned/{node_id}`)
- [ ] Implement evidence logging:
  - Serialize violation + evidence
  - Write to PostgreSQL `byzantine_violations` table

**2. Vote Processor**
- [ ] Copy `mtls-comm/crates/consensus/src/vote_processor.rs`
- [ ] Implement vote aggregation:
  - Store votes in HashMap: `node_id → Vote`
  - Verify each vote signature (call Byzantine detector)
  - Increment approve/reject counters
  - Check threshold: `>= t` approve or `>= (n-t+1)` reject
- [ ] Implement vote request broadcast:
  - Serialize VoteRequest message
  - Send to all peers via QUIC
  - Set timeout: 30s
- [ ] Implement vote response handling:
  - Deserialize VoteResponse
  - Call `vote_aggregator.add_vote()`
  - If threshold met: Trigger signing
  - If rejected: Abort transaction

**3. FSM Controller**
- [ ] Copy `mtls-comm/crates/consensus/src/fsm.rs`
- [ ] Implement state machine:
  - Define states: Created, Voting, Approved, Signing, Signed, Broadcasting, Broadcast, Confirmed, Rejected, Failed
  - Define events: StartVote, VoteReceived, VoteThresholdMet, SigningComplete, BroadcastComplete, Confirmed
  - Implement `transition(event)` function
- [ ] Implement state persistence:
  - On every transition: Write to PostgreSQL `transactions` table
  - Write to etcd `/transactions/{txid}/state`
- [ ] Implement recovery:
  - On node restart: Load pending transactions from etcd
  - Resume FSM from last state

**4. Testing**
- [ ] Unit test: Byzantine detector (double-vote, invalid sig, timeout, malformed)
- [ ] Unit test: Vote aggregator (threshold met, rejected, timeout)
- [ ] Unit test: FSM transitions (all valid transitions)
- [ ] Integration test: End-to-end voting (5 nodes, 3 approve, transaction proceeds)
- [ ] Chaos test: Byzantine node sends double-vote (should be detected and banned)

**Acceptance Criteria:**
- ✅ Double-vote detected within 100ms
- ✅ Byzantine node banned after 3 violations
- ✅ Vote aggregation completes in <200ms for 5 nodes
- ✅ FSM persists state (survives coordinator crash)

---

### Phase 4: Cryptographic Protocols (Week 7-9)

**Tasks:**

**1. CGGMP24 DKG**
- [ ] Copy `threshold-signing (Copy)/crypto/src/cggmp24/keygen.rs`
- [ ] Adapt to use QUIC transport (replace TCP sockets)
- [ ] Implement session management:
  - Create MPC session with unique ID
  - Track round progress per session
  - Handle timeouts (10s per round)
- [ ] Implement round message handlers:
  - Round 1: Broadcast commitments
  - Round 2: Exchange shares (encrypted)
  - Round 3: Verify shares, broadcast verification keys
  - Round 4: Derive public key
- [ ] Store output:
  - `key_share.x_i` → Encrypted in state.json
  - `key_share.public_key` → PostgreSQL + etcd
  - `verification_keys` → In-memory cache

**2. CGGMP24 Auxiliary Info**
- [ ] Copy `threshold-signing (Copy)/crypto/src/cggmp24/aux_info.rs`
- [ ] Implement Paillier key generation:
  - Generate safe primes (p, q)
  - Compute N = p * q
  - Store (N, λ(N)) as private key
- [ ] Implement Ring-Pedersen parameter generation
- [ ] Implement ZK proof of discrete log:
  - Prove knowledge of x_i in Y_i = x_i * G
- [ ] Exchange parameters with peers:
  - Broadcast Paillier public keys
  - Store in state.json (reused for all signatures)

**3. Presignature Pool**
- [ ] Copy `threshold-signing (Copy)/node/src/presignature_pool.rs`
- [ ] Implement pool data structure:
  - `available: Vec<Presignature>`
  - `in_use: HashMap<TxId, Presignature>`
  - `failed: Vec<Presignature>`
- [ ] Implement background generator:
  - Tokio task runs every 10s
  - Check: if `available.len() < 20`
  - Acquire etcd lock `/locks/presig-generation`
  - Generate batch of 10 presignatures
  - Release lock
- [ ] Implement presignature generation:
  - Round 1: Generate nonce k_i, compute R_i = k_i * G
  - Round 2: Broadcast R_i, collect all, compute R
  - Store (k_i, R) in pool
- [ ] Implement retrieval:
  - `pop_presignature()` → Move from available to in_use
  - `mark_used(tx_id)` → Delete from in_use, log to PostgreSQL
  - `mark_failed(presig_id)` → Move to failed, try next
- [ ] Implement pruning:
  - Every hour: Delete presigs older than 24h

**4. CGGMP24 Fast Signing**
- [ ] Copy `threshold-signing (Copy)/node/src/signing_fast.rs`
- [ ] Implement signing with presignature:
  - Retrieve (k_i, R) from pool
  - Extract r = R.x
  - Compute s_i = k_i^(-1) * (H(m) + r * x_i)
  - Broadcast s_i
  - Aggregate: s = sum(s_i)
  - Return (r, s)
- [ ] Implement verification:
  - Check: s * G == R + H(m) * Y
  - If invalid: Try next presignature (max 3 attempts)

**5. FROST Protocol**
- [ ] Copy `torcus-wallet/crates/protocols/src/frost/keygen.rs`
- [ ] Copy `torcus-wallet/crates/protocols/src/frost/signing.rs`
- [ ] Adapt to QUIC transport
- [ ] Implement DKG (VSS rounds)
- [ ] Implement signing (nonce commitment + response)

**6. Testing**
- [ ] Unit test: CGGMP24 DKG (3-of-5, derive same public key)
- [ ] Unit test: Presignature generation (valid R, unique nonces)
- [ ] Unit test: Fast signing (signature verifies)
- [ ] Integration test: Full DKG → Aux Info → Pool → Sign flow
- [ ] Benchmark test: Signing latency (target <500ms)

**Acceptance Criteria:**
- ✅ DKG completes in <10s for 5 nodes
- ✅ Presignature pool maintains 20+ presigs
- ✅ Signing latency <500ms (with pool)
- ✅ 100% signature verification success rate

---

### Phase 5: Bitcoin Integration (Week 10)

**Tasks:**

**1. Transaction Builder**
- [ ] Copy `torcus-wallet/crates/common/src/bitcoin_tx.rs`
- [ ] Implement UTXO selection:
  - Fetch UTXOs from Esplora `/address/{addr}/utxo`
  - Filter confirmed (>= 1 confirmation)
  - Select largest-first to cover amount + fee
- [ ] Implement fee estimation:
  - Fetch fee rates from Esplora `/fee-estimates`
  - Estimate TX size (inputs * 68 + outputs * 31 + overhead)
  - Calculate fee = size * fee_rate
- [ ] Implement OP_RETURN embedding:
  - Encode metadata (magic bytes + version + timestamp + UUID + JSON)
  - Create OP_RETURN output (max 80 bytes)
- [ ] Implement unsigned TX construction:
  - Add inputs (selected UTXOs)
  - Add outputs (recipient, OP_RETURN, change)
  - Compute sighashes (one per input)

**2. Blockchain Client**
- [ ] Copy `torcus-wallet/crates/chains/src/bitcoin/client.rs`
- [ ] Implement Esplora API client:
  - `fetch_utxos(address)` → Vec<UTXO>
  - `estimate_fee()` → FeeRate
  - `broadcast_tx(raw_tx)` → TxId
  - `get_tx_status(txid)` → TxStatus
- [ ] Implement retry logic:
  - 3 attempts with exponential backoff (1s, 2s, 4s)
  - Fallback to RPC if Esplora fails
- [ ] Implement confirmation polling:
  - Poll every 30s
  - Timeout after 60 min
  - Update PostgreSQL on confirmation

**3. Testing**
- [ ] Unit test: UTXO selection (sufficient funds, change calculation)
- [ ] Unit test: Fee estimation (reasonable fee for given size)
- [ ] Unit test: OP_RETURN encoding (data fits in 80 bytes)
- [ ] Integration test: Build → Sign → Broadcast (testnet)
- [ ] End-to-end test: Full TX lifecycle (regtest)

**Acceptance Criteria:**
- ✅ UTXO selection always covers amount + fee
- ✅ OP_RETURN metadata fits in 80 bytes
- ✅ Broadcast succeeds on testnet
- ✅ Confirmation detected within 30s of block inclusion

---

### Phase 6: API & Orchestration (Week 11-12)

**Tasks:**

**1. Signing Coordinator**
- [ ] Implement signing orchestration:
  - `sign_transaction(unsigned_tx)` → Result<SignedTx>
  - Select protocol (CGGMP24 or FROST based on address type)
  - Acquire presignature from pool
  - Create MPC session
  - Execute signing rounds
  - Verify signature
  - Attach to TX
- [ ] Implement error recovery:
  - On presignature pool empty: Wait 10s, retry
  - On node timeout: Exclude node, retry with different t nodes
  - On invalid signature: Try next presignature (max 3)

**2. Wallet State Manager**
- [ ] Implement WalletState struct:
  - `balance()` → (confirmed, unconfirmed)
  - `utxos()` → Vec<UTXO>
  - `transactions()` → Vec<Transaction>
- [ ] Implement background sync:
  - Every 60s: Fetch UTXOs from Esplora
  - Diff with local state
  - Update balances
- [ ] Implement state persistence:
  - On every change: Write to state.json (encrypted)

**3. REST API**
- [ ] Set up Axum framework
- [ ] Implement endpoints:
  - `POST /api/v1/wallet/create` → DKG flow
  - `GET /api/v1/wallet/{id}/balance`
  - `POST /api/v1/wallet/{id}/send` → Full TX flow
  - `GET /api/v1/wallet/{id}/transactions`
  - `GET /api/v1/pool/status`
  - `GET /api/v1/health`
- [ ] Implement JWT authentication:
  - Generate JWT signed with node private key
  - Verify on every request
- [ ] Implement rate limiting:
  - 10 requests/s per peer
  - 429 Too Many Requests on exceed

**4. CLI Tool**
- [ ] Set up Clap framework
- [ ] Implement commands:
  - `init`, `balance`, `send`, `history`
  - `node start`, `node status`, `node peers`
  - `pool status`, `pool generate`
  - `logs`, `metrics`
- [ ] Implement config file parsing (TOML)
- [ ] Implement logging (tracing crate, JSON format)

**5. Testing**
- [ ] Unit test: Signing coordinator (all error paths)
- [ ] Integration test: REST API endpoints (create wallet, send TX)
- [ ] End-to-end test: CLI flow (init → send → confirm)
- [ ] Load test: 100 concurrent send requests

**Acceptance Criteria:**
- ✅ Signing coordinator handles all error cases gracefully
- ✅ REST API responds in <100ms (p99)
- ✅ CLI successfully creates wallet and sends TX on testnet
- ✅ Load test achieves 50 TX/min throughput

---

### Phase 7: Monitoring & Deployment (Week 13)

**Tasks:**

**1. Prometheus Metrics**
- [ ] Implement metrics:
  - `signing_latency_seconds` (histogram)
  - `presignature_pool_size` (gauge)
  - `byzantine_events_total` (counter)
  - `vote_aggregation_latency_seconds` (histogram)
  - `active_connections` (gauge)
- [ ] Expose `/metrics` endpoint (Axum)

**2. Structured Logging**
- [ ] Implement tracing subscribers:
  - JSON format for production
  - Pretty format for development
- [ ] Add trace IDs to all logs (UUID per request)
- [ ] Implement log levels (debug, info, warn, error)

**3. Docker Deployment**
- [ ] Create Dockerfiles:
  - `Dockerfile.node` (MPC node)
  - `Dockerfile.coordinator` (transaction coordinator)
- [ ] Create docker-compose.yml:
  - 5 MPC nodes
  - 1 coordinator
  - 3 etcd nodes
  - 1 PostgreSQL database
  - 1 Prometheus instance
  - 1 Grafana instance
- [ ] Create Grafana dashboards:
  - Signing latency over time
  - Presignature pool size
  - Byzantine events timeline
  - Node health status

**4. Testing**
- [ ] Integration test: Full system in Docker (docker-compose up)
- [ ] Chaos test: Kill random nodes, verify recovery
- [ ] Load test: 1000 TX over 1 hour

**Acceptance Criteria:**
- ✅ Docker deployment succeeds (all containers healthy)
- ✅ Prometheus scrapes metrics every 15s
- ✅ Grafana dashboards visualize all key metrics
- ✅ System recovers from single node failure within 30s

---

### Phase 8: Security Audit & Hardening (Week 14)

**Tasks:**

**1. Security Review**
- [ ] Code review: All crypto operations (constant-time, no panics)
- [ ] Dependency audit: Check for known vulnerabilities (cargo audit)
- [ ] Penetration test: Attempt MITM, replay, Byzantine attacks
- [ ] Fuzz testing: Invalid message formats, large inputs

**2. Hardening**
- [ ] Enable compiler security features:
  - Stack canaries: `-Z stack-protector=all`
  - ASLR: Enable by default on Linux
- [ ] Secrets management:
  - Never log private keys or presignatures
  - Zeroize sensitive memory on drop
- [ ] Input validation:
  - Max message size: 10 MB
  - Max OP_RETURN: 80 bytes
  - Signature format validation

**3. Incident Response Plan**
- [ ] Document Byzantine node response:
  - Detection → Log → Alert → Ban
- [ ] Document key compromise response:
  - Revoke certificates → Rotate keys → Audit logs
- [ ] Document etcd failure response:
  - Automatic failover to replica

**Acceptance Criteria:**
- ✅ Zero critical vulnerabilities (cargo audit)
- ✅ Penetration test: All attacks blocked
- ✅ Fuzz test: No crashes after 1M inputs
- ✅ Incident response plan documented and tested

---

## 🧪 Testing & Validation Strategy

### Unit Tests

**Coverage Target:** 80%+

**Test Categories:**

**1. Cryptographic Operations**
- DKG produces same public key across all nodes
- Presignature nonces are unique
- Signatures verify correctly
- Invalid signatures rejected

**2. Network Layer**
- QUIC connection establishment
- mTLS certificate validation (valid, expired, revoked, wrong CN)
- Stream multiplexing (100 concurrent streams)
- Connection recovery after network partition

**3. Consensus Layer**
- Vote aggregation (threshold met, rejected, timeout)
- Byzantine detection (all 4 violation types)
- FSM transitions (all valid state changes)
- etcd lock acquisition (concurrent attempts)

**4. Bitcoin Layer**
- UTXO selection (sufficient funds, edge cases)
- Fee estimation (reasonable fees)
- OP_RETURN encoding (fits in 80 bytes)
- Transaction parsing (valid, invalid)

---

### Integration Tests

**Test Scenarios:**

**Scenario 1: Full DKG Flow**
```
Given: 5 nodes with valid certificates
When: DKG initiated with threshold 3-of-5
Then:
  - All nodes derive same public key
  - Key shares stored encrypted
  - Aux info generated successfully
  - Total time <10s
```

**Scenario 2: Transaction Signing (Happy Path)**
```
Given: Wallet with funds (1 BTC)
When: Send request (0.1 BTC to address)
Then:
  - UTXO selected (sufficient funds)
  - Vote aggregation completes (3/5 approve)
  - Presignature retrieved from pool
  - Signature generated (<500ms)
  - TX broadcast succeeds
  - TXID returned
```

**Scenario 3: Byzantine Node Detection**
```
Given: 5 nodes, 1 Byzantine (sends double-vote)
When: Vote request sent
Then:
  - Byzantine detector flags double-vote
  - Violation logged to PostgreSQL
  - Node banned from future rounds
  - Transaction proceeds with remaining 4 nodes
```

**Scenario 4: Coordinator Failure**
```
Given: Coordinator node running
When: Kill coordinator process
Then:
  - etcd leader election triggers
  - New coordinator elected within 5s
  - Pending transactions resume
  - No data loss
```

---

### End-to-End Tests

**E2E Test 1: Testnet Transaction**
```
1. Deploy 5 nodes on testnet
2. Run DKG (generate wallet)
3. Fund wallet (send tBTC from faucet)
4. Wait for confirmation
5. Send transaction (0.001 tBTC)
6. Monitor confirmation
7. Verify TX on blockchain explorer
```

**E2E Test 2: High-Volume Stress Test**
```
1. Deploy system in Docker
2. Pre-generate 100 presignatures
3. Send 100 transactions concurrently
4. Measure:
   - Throughput (TX/s)
   - Latency (p50, p99)
   - Pool depletion rate
   - Error rate
5. Assert:
   - Throughput >50 TX/min
   - Latency p99 <1s
   - Error rate <1%
```

---

### Performance Benchmarks

**Benchmark Suite:**

```rust
#[bench]
fn bench_cggmp24_dkg_5_nodes(b: &mut Bencher) {
    b.iter(|| {
        // Run DKG with 5 nodes, 3-of-5 threshold
        // Target: <10s
    });
}

#[bench]
fn bench_presignature_generation(b: &mut Bencher) {
    b.iter(|| {
        // Generate 1 presignature
        // Target: <400ms
    });
}

#[bench]
fn bench_signing_with_pool(b: &mut Bencher) {
    b.iter(|| {
        // Sign message with presignature from pool
        // Target: <500ms
    });
}

#[bench]
fn bench_vote_aggregation(b: &mut Bencher) {
    b.iter(|| {
        // Aggregate 5 votes
        // Target: <200ms
    });
}
```

**Performance Targets:**

| Operation | Target | P50 | P99 | P999 |
|-----------|--------|-----|-----|------|
| CGGMP24 DKG | <10s | 8s | 9.5s | 10s |
| FROST DKG | <3s | 500ms | 1s | 2s |
| Presig Gen | <1s | 400ms | 600ms | 800ms |
| Signing (pool) | <500ms | 350ms | 480ms | 500ms |
| Vote Aggregation | <1s | 200ms | 400ms | 800ms |
| TX Broadcast | <5s | 2s | 4s | 5s |

---

## 🚢 Deployment Architecture

### Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (HAProxy)                 │
│                     HTTPS → Round-robin                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Coordinator Cluster (Active-Standby)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Coordinator 1│  │Coordinator 2│  │Coordinator 3│         │
│  │  (Leader)   │  │  (Standby)  │  │  (Standby)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      MPC Node Cluster                       │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐              │
│  │Node1│  │Node2│  │Node3│  │Node4│  │Node5│              │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘              │
│  (All nodes peer-to-peer via QUIC + mTLS)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Storage & Coordination Layer               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │etcd Cluster  │  │PostgreSQL    │  │Bitcoin Node  │      │
│  │(3 nodes)     │  │(Primary +    │  │(Esplora/RPC) │      │
│  │Raft consensus│  │ Replica)     │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Monitoring & Observability                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Prometheus    │  │Grafana       │  │Loki (Logs)   │      │
│  │(Metrics)     │  │(Dashboards)  │  │(Aggregation) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

### High Availability Configuration

**Node Distribution:**
- **5 MPC Nodes:** 3-of-5 threshold (tolerates 2 failures)
- **3 etcd Nodes:** Raft quorum (tolerates 1 failure)
- **2 PostgreSQL:** Primary + replica (async replication)
- **3 Coordinators:** Leader election (tolerates 2 failures)

**Failure Scenarios:**

| Failure | Impact | Recovery |
|---------|--------|----------|
| 1 MPC node | None (threshold 3-of-5) | Auto-exclude from sessions |
| 2 MPC nodes | None (threshold still met) | Manual intervention to add node |
| 3 MPC nodes | **System down** (can't meet threshold) | Emergency DKG with new nodes |
| 1 etcd node | None (quorum 2-of-3) | Auto-failover to replicas |
| Coordinator | None (standby promoted) | Leader election (<5s) |
| PostgreSQL primary | None (promote replica) | Automatic via Patroni |

---

### Resource Requirements

**Per MPC Node:**
- **CPU:** 4 cores (2 for MPC, 2 for network)
- **RAM:** 8 GB (4 GB presignature pool, 4 GB buffers)
- **Disk:** 100 GB SSD (state file + logs)
- **Network:** 1 Gbps (low latency critical)

**Per Coordinator:**
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Disk:** 50 GB SSD

**etcd Cluster:**
- **CPU:** 2 cores per node
- **RAM:** 4 GB per node
- **Disk:** 20 GB SSD per node (fast I/O critical)

**PostgreSQL:**
- **CPU:** 4 cores
- **RAM:** 16 GB (8 GB shared buffers)
- **Disk:** 500 GB SSD (audit logs grow over time)

**Total (minimum):**
- **CPU:** 36 cores
- **RAM:** 76 GB
- **Disk:** 1.2 TB SSD

---

## 📊 Monitoring & Observability

### Key Metrics

**Performance Metrics:**
```
# Signing latency (histogram)
signing_latency_seconds{protocol="cggmp24", pool="true"}

# Presignature pool (gauge)
presignature_pool_size{status="available|in_use|failed"}

# Vote aggregation (histogram)
vote_aggregation_latency_seconds{result="approved|rejected|timeout"}

# Transaction throughput (counter)
transactions_total{status="pending|signed|broadcast|confirmed|failed"}

# Network connections (gauge)
active_quic_connections{peer="node-01|node-02|..."}
```

**Security Metrics:**
```
# Byzantine violations (counter)
byzantine_violations_total{type="double_vote|invalid_sig|timeout|malformed", node_id="..."}

# Certificate validation (counter)
certificate_validations_total{result="success|expired|revoked|invalid"}

# Failed signature attempts (counter)
signature_failures_total{reason="invalid|timeout|pool_empty"}
```

**System Health Metrics:**
```
# Node health (gauge: 0=down, 1=up)
node_health{node_id="node-01"}

# etcd health (gauge)
etcd_leader_changes_total

# PostgreSQL health (gauge)
postgres_connection_pool_size{status="active|idle"}
```

---

### Alerting Rules

**Critical Alerts (PagerDuty):**

```yaml
- alert: ByzantineNodeDetected
  expr: rate(byzantine_violations_total[5m]) > 0
  for: 1m
  severity: critical
  description: "Node {{ $labels.node_id }} committed Byzantine violation: {{ $labels.type }}"

- alert: PresignaturePoolDepleted
  expr: presignature_pool_size{status="available"} < 5
  for: 2m
  severity: critical
  description: "Presignature pool critically low ({{ $value }}), signing will fail"

- alert: SigningLatencyHigh
  expr: histogram_quantile(0.99, signing_latency_seconds) > 2
  for: 5m
  severity: critical
  description: "Signing latency p99 = {{ $value }}s (target <500ms)"

- alert: NodeOffline
  expr: node_health == 0
  for: 30s
  severity: critical
  description: "Node {{ $labels.node_id }} offline"
```

**Warning Alerts (Slack):**

```yaml
- alert: PresignaturePoolLow
  expr: presignature_pool_size{status="available"} < 20
  for: 5m
  severity: warning
  description: "Presignature pool below target ({{ $value }})"

- alert: HighVoteRejectionRate
  expr: rate(vote_aggregation_total{result="rejected"}[10m]) > 0.1
  severity: warning
  description: "High vote rejection rate: {{ $value }} rejections/s"

- alert: CertificateExpiringSoon
  expr: certificate_expiry_days < 14
  severity: warning
  description: "Certificate for {{ $labels.node_id }} expires in {{ $value }} days"
```

---

### Grafana Dashboards

**Dashboard 1: System Overview**
- Panel 1: Transaction throughput (TX/min) over time
- Panel 2: Signing latency (p50, p99, p999) over time
- Panel 3: Node health status (green/red tiles)
- Panel 4: Presignature pool size (gauge)

**Dashboard 2: Security Monitoring**
- Panel 1: Byzantine violations timeline (bar chart)
- Panel 2: Failed signature attempts (counter)
- Panel 3: Certificate validation failures (pie chart)
- Panel 4: Vote rejection rate (line chart)

**Dashboard 3: Performance Deep Dive**
- Panel 1: DKG latency breakdown (by round)
- Panel 2: Presignature generation rate (presigs/min)
- Panel 3: QUIC connection latency (p99)
- Panel 4: PostgreSQL write latency (histogram)

---

## 🎯 Success Criteria & Acceptance

### Functional Requirements

- ✅ **DKG:** Generate wallet with 3-of-5 threshold in <10s
- ✅ **Signing:** Sign transaction in <500ms with presignature pool
- ✅ **Byzantine Tolerance:** Detect and ban malicious nodes
- ✅ **Consensus:** Vote aggregation with threshold enforcement
- ✅ **Broadcast:** Successfully submit transactions to Bitcoin network
- ✅ **OP_RETURN:** Embed 80-byte metadata in every transaction

### Non-Functional Requirements

- ✅ **Availability:** 99.99% uptime (tolerates 2-of-5 node failures)
- ✅ **Latency:** p99 signing latency <1s
- ✅ **Throughput:** 50+ transactions per minute
- ✅ **Security:** Zero trust (mTLS everywhere), at-rest encryption
- ✅ **Auditability:** Complete transaction trail in PostgreSQL
- ✅ **Observability:** Real-time metrics and alerting

### Deployment Readiness

- ✅ **Docker:** Multi-container deployment with docker-compose
- ✅ **Monitoring:** Prometheus + Grafana dashboards
- ✅ **Logging:** Structured JSON logs with trace IDs
- ✅ **Documentation:** API reference, operator runbook
- ✅ **Testing:** 80%+ code coverage, E2E tests pass on testnet

---

## 📚 Appendix: File Extraction Checklist

### From `torcus-wallet`

```
✅ crates/protocols/src/p2p/quic_transport.rs → production/crates/network/src/quic_engine.rs
✅ crates/protocols/src/p2p/session.rs → production/crates/network/src/quic_session.rs
✅ crates/protocols/src/p2p/quic_listener.rs → production/crates/network/src/quic_server.rs
✅ crates/protocols/src/frost/keygen.rs → production/crates/protocols/src/frost/keygen.rs
✅ crates/protocols/src/frost/signing.rs → production/crates/protocols/src/frost/signing.rs
✅ crates/common/src/bitcoin_tx.rs → production/crates/bitcoin/src/tx_builder.rs
✅ crates/chains/src/bitcoin/client.rs → production/crates/bitcoin/src/client.rs
✅ crates/coordinator/src/registry.rs → production/crates/network/src/peer_registry.rs
```

### From `mtls-comm`

**Certificate Management (Security Layer):**
```
✅ crates/network/src/cert_manager.rs → production/crates/security/src/cert_manager.rs
✅ crates/network/src/tls_config.rs → production/crates/security/src/tls_config.rs
```

**Consensus & Byzantine Fault Tolerance:**
```
✅ crates/consensus/src/byzantine.rs → production/crates/consensus/src/byzantine.rs
✅ crates/consensus/src/fsm.rs → production/crates/consensus/src/fsm.rs
✅ crates/consensus/src/vote_processor.rs → production/crates/consensus/src/vote_processor.rs
```

**Storage Layer:**
```
✅ crates/storage/src/etcd.rs → production/crates/storage/src/etcd.rs
✅ crates/storage/src/postgres.rs → production/crates/storage/src/postgres.rs
```

**❌ NOT EXTRACTED (TCP-based, incompatible with QUIC):**
```
❌ crates/network/src/tcp_socket.rs → DISCARDED
❌ crates/network/src/connection_pool.rs → DISCARDED
❌ crates/network/src/tcp_listener.rs → DISCARDED
```
**Reason:** mtls-comm uses TCP transport. We use QUIC (UDP-based) from torcus-wallet instead.

### From `threshold-signing (Copy)`

```
✅ node/src/presignature_pool.rs → production/crates/protocols/src/cggmp24/presig_pool.rs
✅ node/src/signing_fast.rs → production/crates/protocols/src/cggmp24/signing_fast.rs
✅ crypto/src/cggmp24/keygen.rs → production/crates/protocols/src/cggmp24/keygen.rs
✅ crypto/src/cggmp24/signing.rs → production/crates/protocols/src/cggmp24/signing.rs
✅ crypto/src/cggmp24/aux_info.rs → production/crates/protocols/src/cggmp24/aux_info.rs
```

### From `p2p-comm`

```
❌ NO FILES EXTRACTED - Project uses libp2p, incompatible with QUIC architecture
```

**Rationale:** p2p-comm is built on libp2p which conflicts with our QUIC-native network layer from torcus-wallet. All networking is handled via QUIC streams, and consensus/voting logic comes from mtls-comm.

---

## 📋 Architecture Decision Records (ADRs)

### ADR-001: QUIC Transport with mTLS Authentication

**Date:** 2026-01-20
**Status:** ✅ Accepted
**Context:** Enterprise MPC wallet deployment across multi-cloud environment (AWS, GCP, Azure)

**Decision:**
Use **QUIC protocol from torcus-wallet** with **mTLS certificate management from mtls-comm**, rejecting pure TCP+mTLS approach.

**Rationale:**

| Requirement | TCP + mTLS | QUIC + mTLS | Winner |
|-------------|-----------|-------------|---------|
| **Signing Latency** | >1s (HoL blocking) | <500ms (multiplexed) | QUIC ✅ |
| **Multi-round Protocols** | New conn per round | Stream reuse | QUIC ✅ |
| **Connection Migration** | ❌ IP change breaks | ✅ Seamless migration | QUIC ✅ |
| **0-RTT Resumption** | ❌ Full handshake | ✅ Resume instantly | QUIC ✅ |
| **Firewall Compatibility** | ✅ TCP:443 universal | ⚠️ UDP:443 (99% ok) | Tie |
| **Debugging Tools** | ✅ Mature (tcpdump) | ⚠️ Limited | TCP ✅ |
| **Industry Standard** | ✅ Proven | ✅ HTTP/3, adopted | Tie |

**Performance Impact:**
- DKG (5 rounds): TCP=600ms, QUIC=360ms → **240ms saved**
- Presig generation (7 rounds): TCP=840ms, QUIC=420ms → **420ms saved**
- Total signing (presig + signing): TCP=1.2s, QUIC=0.48s → **60% improvement**

**Security Considerations:**
- QUIC includes TLS 1.3 natively (no separate layer)
- Mutual authentication configured via rustls ServerConfig
- Certificate validation identical to TCP+mTLS (same cert_manager.rs logic)
- Forward secrecy guaranteed per-stream

**Consequences:**
- ✅ mtls-comm's `cert_manager.rs` and `tls_config.rs` extracted
- ❌ mtls-comm's TCP socket code discarded
- ✅ torcus-wallet's QUIC engine forms transport foundation
- ⚠️ Requires UDP:443 open on firewalls (enterprise clouds support this)

**Alternatives Considered:**
1. **Pure TCP+mTLS:** Rejected due to HoL blocking and connection overhead
2. **Dual transport (QUIC + TCP fallback):** Rejected due to implementation complexity
3. **libp2p (from p2p-comm):** Rejected due to incompatibility with QUIC

---

### ADR-002: Exclude p2p-comm from Integration

**Date:** 2026-01-20
**Status:** ✅ Accepted
**Context:** p2p-comm uses libp2p for networking, conflicts with QUIC architecture

**Decision:**
Do NOT extract any files from p2p-comm. Use only three source projects: torcus-wallet, mtls-comm, threshold-signing.

**Rationale:**
- p2p-comm networking: libp2p (incompatible with QUIC)
- Consensus/voting: Already in mtls-comm (byzantine.rs, vote_processor.rs)
- Peer discovery: Static configuration (enterprise deployment doesn't need DHT)

**Consequences:**
- ✅ Cleaner architecture (no libp2p dependency)
- ✅ All networking unified under QUIC
- ❌ Must implement broadcast manually (no GossipSub)

---

## 🏁 Final Notes

This plan provides **exhaustive detail** on every component, integration point, and operational concern. By following this roadmap:

1. **Week 1-3:** Network layer (QUIC + mTLS) provides secure, low-latency transport
2. **Week 4-6:** Consensus layer (BFT + Raft) ensures Byzantine resilience
3. **Week 7-9:** Crypto layer (CGGMP24 + FROST + Pool) delivers <500ms signing
4. **Week 10-12:** Integration layer (Bitcoin + API) completes user-facing features
5. **Week 13-14:** Deployment + Security hardens for production

**Result:** A production-grade MPC wallet that combines the best of three core projects (torcus-wallet, mtls-comm, threshold-signing) into a unified, enterprise-ready system.

---

**Document Status:** ✅ Complete
**Review Required:** Architecture Team, Security Team
**Next Steps:** Phase 0 execution (project setup)
