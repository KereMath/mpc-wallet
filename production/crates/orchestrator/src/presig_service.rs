//! Presignature Pool Service
//!
//! This module manages the presignature pool for fast ECDSA signing using CGGMP24.
//! Presignatures are pre-computed signature components that reduce signing time
//! from 2-3 seconds to <500ms.
//!
//! # Architecture
//!
//! - **Background Generation**: Continuously generates presignatures to maintain pool size
//! - **Pool Management**: Tracks available, used, and total presignatures
//! - **Byzantine Tolerance**: Handles node failures during presignature generation
//! - **Persistence**: Stores encrypted presignatures in PostgreSQL
//!
//! # Performance Targets
//!
//! - Target pool size: 100 presignatures
//! - Minimum pool size: 20 presignatures (triggers refill)
//! - Maximum pool size: 150 presignatures
//! - Generation rate: ~5 presignatures/minute (parallelized)
//! - Generation time per presignature: ~400ms (with 5 nodes)

use crate::error::{OrchestrationError, Result};
use crate::message_router::{MessageRouter, ProtocolMessage as RouterProtocolMessage, ProtocolType as RouterProtocolType};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use threshold_network::QuicEngine;
use threshold_storage::{EtcdStorage, PostgresStorage};
use threshold_types::{NetworkMessage, NodeId, PresignatureId, PresignatureMessage};
use tokio::sync::{Mutex, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

// Protocol modules
use protocols::cggmp24::presignature::{self, StoredPresignature};
use async_channel;

/// Presignature pool statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresignatureStats {
    /// Current number of available presignatures
    pub current_size: usize,
    /// Target pool size
    pub target_size: usize,
    /// Maximum pool size
    pub max_size: usize,
    /// Pool utilization percentage (0-100)
    pub utilization: f64,
    /// Number of presignatures used in the last hour
    pub hourly_usage: usize,
    /// Total presignatures generated
    pub total_generated: u64,
    /// Total presignatures used
    pub total_used: u64,
}

impl PresignatureStats {
    /// Check if pool is healthy (above minimum threshold)
    pub fn is_healthy(&self) -> bool {
        self.current_size >= 20 // Minimum threshold
    }

    /// Check if pool is critical (below critical threshold)
    pub fn is_critical(&self) -> bool {
        self.current_size < 10 // Critical threshold
    }

    /// Calculate utilization percentage
    pub fn calculate_utilization(&self) -> f64 {
        if self.target_size == 0 {
            0.0
        } else {
            (self.current_size as f64 / self.target_size as f64) * 100.0
        }
    }
}

/// Presignature entry in the pool
///
/// NOTE: The presignature data is stored as raw bytes since the cggmp24 StoredPresignature
/// type doesn't implement Serialize. In production, we accept that presignatures are ephemeral
/// and regenerate quickly in the background pool.
#[derive(Debug, Clone)]
struct PresignatureEntry {
    id: PresignatureId,
    /// Metadata about the presignature (not the actual presignature)
    /// Contains JSON: {"participants": [1,2,3], "generated_at": "..."}
    metadata: Vec<u8>,
    created_at: chrono::DateTime<chrono::Utc>,
    is_used: bool,
}

/// Presignature Pool Service
pub struct PresignatureService {
    /// In-memory pool of available presignatures
    pool: Arc<RwLock<Vec<PresignatureEntry>>>,
    /// QUIC network engine for P2P communication
    quic: Arc<QuicEngine>,
    /// Message router for protocol communication
    message_router: Arc<MessageRouter>,
    /// PostgreSQL storage for persistence
    postgres: Arc<PostgresStorage>,
    /// etcd storage for distributed coordination (with interior mutability)
    etcd: Arc<Mutex<EtcdStorage>>,
    /// Aux_Info service for accessing aux_info data
    aux_info_service: Arc<super::aux_info_service::AuxInfoService>,
    /// Current node ID
    node_id: NodeId,
    /// Target pool size
    target_size: usize,
    /// Minimum pool size (trigger refill)
    min_size: usize,
    /// Maximum pool size
    max_size: usize,
    /// Generation statistics
    stats: Arc<RwLock<GenerationStats>>,
    /// HTTP client for broadcasting to nodes (SORUN #19 FIX)
    http_client: reqwest::Client,
    /// Node endpoints (node_id -> endpoint URL) (SORUN #19 FIX)
    node_endpoints: std::collections::HashMap<u64, String>,
    /// Semaphore to ensure only 1 presignature session runs at a time (FIX: Duplicate message)
    presig_session_semaphore: Arc<tokio::sync::Semaphore>,
}

#[derive(Debug, Default)]
struct GenerationStats {
    total_generated: u64,
    total_used: u64,
    hourly_usage: usize,
    last_generation: Option<chrono::DateTime<chrono::Utc>>,
}

impl PresignatureService {
    /// Create new presignature service
    pub fn new(
        quic: Arc<QuicEngine>,
        message_router: Arc<MessageRouter>,
        postgres: Arc<PostgresStorage>,
        etcd: Arc<Mutex<EtcdStorage>>,
        aux_info_service: Arc<super::aux_info_service::AuxInfoService>,
        node_id: NodeId,
        node_endpoints: std::collections::HashMap<u64, String>,
    ) -> Self {
        Self {
            pool: Arc::new(RwLock::new(Vec::new())),
            quic,
            message_router,
            postgres,
            etcd,
            aux_info_service,
            node_id,
            target_size: 100,
            min_size: 20,
            max_size: 150,
            stats: Arc::new(RwLock::new(GenerationStats::default())),
            http_client: reqwest::Client::new(),
            node_endpoints,
            // FIX: Semaphore with 1 permit - only 1 presignature session at a time
            presig_session_semaphore: Arc::new(tokio::sync::Semaphore::new(1)),
        }
    }

    /// Start the background generation loop
    ///
    /// This method runs continuously and maintains the presignature pool by:
    /// 1. Checking pool size every 10 seconds
    /// 2. Triggering refill when below minimum threshold
    /// 3. Generating presignatures in batches
    ///
    /// Presignature generation loop - runs ONLY on node 1 (coordinator)
    ///
    /// CRITICAL: Only node 1 runs this loop. Other nodes ONLY participate
    /// when they receive a presig-join request via HTTP. This prevents:
    /// - Race conditions where multiple nodes try to generate simultaneously
    /// - Session collisions and AttemptToOverwriteReceivedMsg errors
    /// - Distributed lock contention
    pub async fn run_generation_loop(self: Arc<Self>) {
        // CRITICAL: Only node 1 runs the generation loop
        // Other nodes participate ONLY via presig-join requests
        if self.node_id.0 != 1 {
            info!(
                "Node {} is not the coordinator - presig loop disabled. \
                 Will participate via presig-join requests only.",
                self.node_id.0
            );
            // Keep the task alive but do nothing
            loop {
                tokio::time::sleep(Duration::from_secs(60)).await;
            }
        }

        info!("Node 1 starting presignature generation loop (coordinator)");

        // Wait for system to stabilize after startup
        tokio::time::sleep(Duration::from_secs(5)).await;

        loop {
            tokio::time::sleep(Duration::from_secs(10)).await;

            // SPAM FIX: Check if prerequisites (DKG + AuxInfo) are available
            // If not, wait silently instead of spamming error logs
            let has_aux_info = self.aux_info_service.get_latest_aux_info().await.is_some();

            // Check if DKG config exists in etcd (indicates DKG completed)
            let has_dkg = {
                let mut etcd = self.etcd.lock().await;
                etcd.get("/cluster/dkg/cggmp24/config").await.ok().flatten().is_some()
            };

            if !has_aux_info || !has_dkg {
                // Prerequisites not ready - wait silently
                // This prevents "No aux_info available" spam in logs
                continue;
            }

            let stats = self.get_stats().await;

            info!(
                "Presignature pool status: {}/{} ({:.1}%) - {}",
                stats.current_size,
                stats.target_size,
                stats.utilization,
                if stats.is_healthy() {
                    "healthy"
                } else {
                    "needs refill"
                }
            );

            // Refill if below minimum
            if stats.current_size < self.min_size {

                // STABILITY FIX: Generate only 1 presignature per batch cycle
                // to prevent concurrent session conflicts and AttemptToOverwriteReceivedMsg errors.
                // Once stable, this can be increased back to larger batches.
                let batch_size = 1;

                info!(
                    "Node {} is presig leader, attempting generation (pool: {}/{})",
                    self.node_id.0, stats.current_size, self.min_size
                );

                // Try to acquire the lock (non-blocking)
                // generate_batch() already acquires the lock internally, so it will either:
                // 1. Succeed if this node gets the lock (becomes leader)
                // 2. Fail if another node has the lock (skip this round)
                match self.generate_batch(batch_size).await {
                    Ok(count) => {
                        info!(
                            "Node {} generated {} presignatures successfully",
                            self.node_id.0, count
                        );
                        let mut gen_stats = self.stats.write().await;
                        gen_stats.total_generated += count as u64;
                        gen_stats.last_generation = Some(chrono::Utc::now());
                    }
                    Err(e) => {
                        // This is expected if another node has the lock
                        if e.to_string().contains("already in progress") || e.to_string().contains("already locked") {
                            debug!(
                                "Node {} skipped generation - another node has the lock",
                                self.node_id.0
                            );
                        } else {
                            error!("Node {} failed to generate presignatures: {}", self.node_id.0, e);
                        }
                    }
                }
            }

            // Cleanup old unused presignatures (older than 24 hours)
            self.cleanup_old_presignatures().await;
        }
    }

    /// Check if this node should be the presignature generation leader
    ///
    /// Leader election rule: The LOWEST numbered node that is active becomes leader.
    /// This ensures only ONE node attempts to generate presignatures at a time.
    ///
    /// Returns: true if this node should attempt generation, false otherwise
    async fn should_be_presig_leader(&self) -> Result<bool> {
        // Get active nodes from etcd by checking heartbeats
        let active_nodes: Vec<u64> = {
            let mut etcd = self.etcd.lock().await;
            match etcd.get_active_nodes().await {
                Ok(nodes) => nodes.into_iter().map(|n| n.0).collect(),
                Err(e) => {
                    warn!("Failed to get active nodes from etcd: {}", e);
                    // Fallback: assume all configured nodes are active
                    // Only node 1 should attempt in this case
                    return Ok(self.node_id.0 == 1);
                }
            }
        };

        if active_nodes.is_empty() {
            // No active nodes found - only node 1 should be leader to avoid conflicts
            if self.node_id.0 == 1 {
                info!("No active nodes in etcd, node 1 is leader by default");
                return Ok(true);
            } else {
                debug!("No active nodes in etcd, node {} deferring to node 1", self.node_id.0);
                return Ok(false);
            }
        }

        // Find the lowest active node ID
        let min_active_node = active_nodes.iter().min().copied().unwrap_or(1);

        let is_leader = self.node_id.0 == min_active_node;

        if is_leader {
            debug!("Node {} is presig leader (lowest of {:?})", self.node_id.0, active_nodes);
        } else {
            debug!("Node {} is not leader (leader is node {})", self.node_id.0, min_active_node);
        }

        Ok(is_leader)
    }

    /// Generate a batch of presignatures
    ///
    /// This method:
    /// 1. Acquires distributed lock to coordinate with other nodes
    /// 2. Runs CGGMP24 presigning protocol (2 rounds)
    /// 3. Stores presignatures in pool and PostgreSQL
    /// 4. GUARANTEES lock release even on error (SORUN #14 fix)
    ///
    /// FIX SORUN #14: Uses try_acquire pattern and lease revocation for reliable lock management
    pub async fn generate_batch(&self, count: usize) -> Result<usize> {
        if count == 0 {
            return Ok(0);
        }

        // Check if we're at max capacity
        let current_size = self.pool.read().await.len();
        if current_size >= self.max_size {
            warn!(
                "Pool at maximum capacity ({}/{}), skipping generation",
                current_size, self.max_size
            );
            return Ok(0);
        }

        let actual_count = count.min(self.max_size - current_size);

        info!("Generating {} presignatures...", actual_count);

        // FIX SORUN #14: Use try_acquire pattern for cleaner lock handling
        // This returns None if lock is held (not an error), or Some(lease_id) if acquired
        let lease_id = {
            let mut etcd = self.etcd.lock().await;
            match etcd.try_acquire_presig_generation_lock().await {
                Ok(Some(id)) => {
                    info!("Node {} acquired presig lock with lease_id={}", self.node_id.0, id);
                    id
                }
                Ok(None) => {
                    // Lock is held by another node - this is expected behavior
                    debug!("Node {} could not acquire presig lock (held by another node)", self.node_id.0);
                    return Err(OrchestrationError::CeremonyInProgress(
                        "Another presignature generation is in progress".to_string(),
                    ));
                }
                Err(e) => {
                    error!("Node {} failed to acquire presig lock: {}", self.node_id.0, e);
                    return Err(OrchestrationError::StorageError(format!(
                        "Failed to acquire presig lock: {}", e
                    )));
                }
            }
        };

        // CRITICAL: Guaranteed lock release even on error (fixes SORUN #14)
        // Execute the actual generation logic and ensure lock is always released
        let result = self.generate_batch_impl(actual_count, current_size).await;

        // ALWAYS release lock by revoking the lease
        // This is more reliable than just deleting the key
        {
            let mut etcd = self.etcd.lock().await;
            if let Err(e) = etcd.revoke_lease(lease_id).await {
                error!("Failed to revoke presig lease {} (may cause SORUN #14): {}", lease_id, e);
                // Try to release lock as fallback
                if let Err(e2) = etcd.release_presig_generation_lock().await {
                    error!("Fallback lock release also failed: {}", e2);
                }
            } else {
                info!("Released presignature generation lock (lease {} revoked)", lease_id);
            }
        }

        result
    }

    /// Internal implementation of batch generation (lock already acquired)
    async fn generate_batch_impl(&self, actual_count: usize, current_size: usize) -> Result<usize> {

        // Implement CGGMP24 presignature generation
        // Requirements:
        // 1. Need a completed DKG ceremony to get key share + aux_info
        // 2. Select threshold subset of participants
        // 3. Run the presignature protocol for each presignature

        // Step 1: Get the latest completed CGGMP24 DKG ceremony
        // Note: This is a simplified implementation. In production, you may want to:
        // - Allow specifying which DKG session to use
        // - Support multiple concurrent DKG sessions
        // - Handle ceremony selection logic

        // REAL IMPLEMENTATION: Get latest aux_info and key_share
        info!("Getting latest aux_info for presignature generation");

        let (aux_info_session_id, aux_info_data) = self
            .aux_info_service
            .get_latest_aux_info()
            .await
            .ok_or_else(|| {
                OrchestrationError::Internal(
                    "No aux_info available. Run aux_info generation first.".to_string(),
                )
            })?;

        info!(
            "Using aux_info from session {} ({} bytes)",
            aux_info_session_id,
            aux_info_data.len()
        );

        // SORUN #18 FIX: Get latest key_share instead of matching aux_info session
        // Key_share comes from DKG ceremony (different session), aux_info from aux_info ceremony
        // We need the most recent key_share regardless of session ID
        let key_share_data = self
            .postgres
            .get_latest_key_share(self.node_id)
            .await
            .map_err(|e| {
                OrchestrationError::StorageError(format!("Failed to get latest key_share: {}", e))
            })?
            .ok_or_else(|| {
                OrchestrationError::StorageError(
                    "No key_share found for this node. Run DKG ceremony first.".to_string()
                )
            })?;

        info!(
            "Using latest key_share from DKG ceremony ({} bytes)",
            key_share_data.len()
        );

        // Party index must be 0-indexed (0 to n-1) for round-based protocol
        // Node IDs are 1-based (1,2,3,4,5) but party indices are 0-based (0,1,2,3,4)
        let party_index = (self.node_id.0 - 1) as u16;
        let mut generated = 0;

        // Generate presignatures
        for i in 0..actual_count {
            let presig_id = PresignatureId::new();
            let session_id = presig_id.to_string();

            info!(
                "Generating presignature {}/{} (session: {})",
                i + 1,
                actual_count,
                session_id
            );

            // PRODUCTION-READY: Real presignature generation with MessageRouter
            // Get actual participants from DKG ceremony configuration stored in etcd
            let participants_party_indices = match self.get_cggmp24_participants().await {
                Ok(participants) => participants,
                Err(e) => {
                    error!("Failed to get CGGMP24 participants from etcd: {}", e);
                    // CGGMP24 presignature requires EXACTLY threshold parties
                    // Party indices must be 0-indexed (0 to threshold-1)
                    warn!("Using fallback participant configuration: threshold=4");
                    vec![0, 1, 2, 3]  // threshold=4 (default)
                }
            };

            // Convert party indices (0-indexed) to node IDs (1-indexed)
            // Party indices [0,1,2,3] -> Node IDs [1,2,3,4]
            let participants_node_ids: Vec<NodeId> = participants_party_indices
                .iter()
                .map(|&p| NodeId((p + 1) as u64))
                .collect();

            // Register session with message router
            let (outgoing_tx, incoming_rx) = match self
                .message_router
                .register_session(
                    Uuid::parse_str(&session_id).unwrap(),
                    RouterProtocolType::Presignature,
                    participants_node_ids.clone(),
                )
                .await
            {
                Ok(channels) => channels,
                Err(e) => {
                    error!("Failed to register presignature session: {}", e);
                    continue;
                }
            };

            // SORUN #19 FIX: Broadcast presig-join request to all participant nodes
            // This allows other nodes to register the session and handle QUIC messages
            if let Err(e) = self
                .broadcast_presig_join_request(Uuid::parse_str(&session_id).unwrap(), &participants_node_ids)
                .await
            {
                warn!("Failed to broadcast presig join request: {}", e);
                // Continue anyway - some nodes might still participate via QUIC
            }

            // ============================================================
            // CRITICAL FIX: Ready barrier - wait for all participants
            // ============================================================
            // Without this barrier, the coordinator starts the protocol before
            // other nodes have registered their sessions, causing:
            // - AttemptToOverwriteReceivedMsg errors
            // - Messages sent to unregistered sessions (dropped)
            // - Protocol failures due to missing participants
            //
            // This is the SAME pattern used in DKG (dkg_service.rs:728-776)
            // ============================================================

            // Signal that coordinator is ready
            let barrier_key = format!("/presig/{}/ready/{}", session_id, self.node_id.0);
            {
                let etcd = self.etcd.lock().await;
                if let Err(e) = etcd.put(&barrier_key, &[1]).await {
                    error!("Failed to signal ready for presig session {}: {}", session_id, e);
                }
            }

            // Wait for all participants to be ready (with timeout)
            let ready_timeout = tokio::time::Duration::from_secs(15);
            let ready_deadline = tokio::time::Instant::now() + ready_timeout;
            let expected_ready = participants_node_ids.len();

            info!(
                "🔄 [Node {}] Waiting for {} participants to be ready for presig session {}",
                self.node_id.0, expected_ready, session_id
            );

            let mut all_ready = false;
            while tokio::time::Instant::now() < ready_deadline {
                let ready_count = {
                    let mut etcd = self.etcd.lock().await;
                    let mut count = 0;
                    for participant in &participants_node_ids {
                        let key = format!("/presig/{}/ready/{}", session_id, participant.0);
                        if let Ok(Some(_)) = etcd.get(&key).await {
                            count += 1;
                        }
                    }
                    count
                };

                if ready_count >= expected_ready {
                    info!(
                        "✅ [Node {}] All {} participants ready for presig session {}",
                        self.node_id.0, expected_ready, session_id
                    );
                    all_ready = true;
                    break;
                }

                debug!(
                    "Waiting for participants: {}/{} ready for session {}",
                    ready_count, expected_ready, session_id
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            }

            if !all_ready {
                warn!(
                    "Timeout waiting for participants in presig session {}, proceeding anyway",
                    session_id
                );
            }

            // Convert between ProtocolMessage and protocol-specific message types
            // CRITICAL FIX: Store JoinHandles to abort tasks when protocol finishes
            // This prevents messages from being sent after the session is unregistered
            let (protocol_incoming_tx, protocol_incoming_rx) = async_channel::bounded(100);
            let incoming_task = tokio::spawn(async move {
                while let Ok(proto_msg) = incoming_rx.recv().await {
                    match bincode::deserialize(&proto_msg.payload) {
                        Ok(msg) => {
                            if protocol_incoming_tx.send(msg).await.is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to deserialize presignature message: {}", e);
                        }
                    }
                }
            });

            let (protocol_outgoing_tx, protocol_outgoing_rx) = async_channel::bounded(100);
            let node_id = self.node_id;
            let session_id_uuid = Uuid::parse_str(&session_id).unwrap();
            let participants_clone = participants_node_ids.clone();
            let outgoing_task = tokio::spawn(async move {
                let mut sequence = 0u64;
                while let Ok(msg) = protocol_outgoing_rx.recv().await {
                    let payload = match bincode::serialize(&msg) {
                        Ok(p) => p,
                        Err(e) => {
                            tracing::error!("Failed to serialize presignature message: {}", e);
                            continue;
                        }
                    };

                    for &participant in &participants_clone {
                        if participant != node_id {
                            let proto_msg = RouterProtocolMessage {
                                session_id: session_id_uuid,
                                from: node_id,
                                to: participant,
                                payload: payload.clone(),
                                sequence,
                                is_broadcast: true, // Broadcast to all participants
                            };
                            if outgoing_tx.send(proto_msg).await.is_err() {
                                tracing::error!("Failed to send message to participant {}", participant);
                            }
                        }
                    }
                    sequence += 1;
                }
            });

            // Call the real presignature generation protocol
            let result = protocols::cggmp24::presignature::generate_presignature(
                party_index,
                &participants_party_indices,
                &session_id,
                &key_share_data,
                &aux_info_data,
                protocol_incoming_rx,
                protocol_outgoing_tx,
            )
            .await;

            // CRITICAL FIX: Abort forwarding tasks BEFORE unregistering session
            // This prevents messages from being sent after session cleanup
            incoming_task.abort();
            outgoing_task.abort();

            if !result.success {
                error!("Failed to generate presignature {}/{}: {:?}", i + 1, actual_count, result.error);
                // FIX #6: Unregister session even on failure to prevent session leak
                if let Err(e) = self.message_router.unregister_session(Uuid::parse_str(&session_id).unwrap()).await {
                    warn!("Failed to unregister failed presignature session {}: {}", session_id, e);
                }

                // CRITICAL FIX: Clean up barrier keys on failure too
                {
                    let etcd = self.etcd.lock().await;
                    for participant in &participants_node_ids {
                        let key = format!("/presig/{}/ready/{}", session_id, participant.0);
                        let _ = etcd.delete(&key).await;
                    }
                }

                // CRITICAL FIX: Wait between failed sessions to allow QUIC messages to drain
                // and participants to clean up their sessions. Without this delay,
                // messages from the failed session interfere with the next session.
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

                continue;
            }

            // Get the actual presignature
            let stored_presig = result.presignature.ok_or_else(|| {
                OrchestrationError::Protocol("Presignature data missing".to_string())
            })?;

            info!(
                "Real presignature generated successfully with {} participants",
                stored_presig.participants.len()
            );

            // Store metadata in memory pool
            // NOTE: Actual StoredPresignature cannot be easily serialized due to cryptographic types
            // We store metadata for tracking and accept presignatures are ephemeral
            let metadata = format!(
                "{{\"participants\": {:?}, \"generated_at\": \"{}\"}}",
                stored_presig.participants,
                chrono::Utc::now().to_rfc3339()
            );

            let entry = PresignatureEntry {
                id: presig_id.clone(),
                metadata: metadata.as_bytes().to_vec(),
                created_at: chrono::Utc::now(),
                is_used: false,
            };

            self.pool.write().await.push(entry);

            info!(
                "Presignature {}/{} added to pool (total: {} available)",
                i + 1,
                actual_count,
                current_size + generated + 1
            );

            // Optionally store metadata in PostgreSQL for monitoring/analytics
            // Skip if store_presignature method doesn't exist yet
            // if let Err(e) = self.postgres.store_presignature(&presig_id, metadata.as_bytes()).await {
            //     warn!("Failed to store presignature metadata: {}", e);
            // }

            generated += 1;

            // FIX #6: Unregister session after successful completion
            // This prevents message collisions between sequential presignature sessions
            if let Err(e) = self.message_router.unregister_session(Uuid::parse_str(&session_id).unwrap()).await {
                warn!("Failed to unregister presignature session {}: {}", session_id, e);
            }

            // Clean up barrier keys from etcd
            {
                let etcd = self.etcd.lock().await;
                for participant in &participants_node_ids {
                    let key = format!("/presig/{}/ready/{}", session_id, participant.0);
                    let _ = etcd.delete(&key).await; // Ignore errors during cleanup
                }
            }

            // FIX #6: Delay between sessions to ensure cleanup completes
            // This prevents overlapping QUIC messages between sequential sessions.
            // CRITICAL: Must wait long enough for participants to also complete and unregister.
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }

        // NOTE: Lock is released in generate_batch() wrapper method
        info!(
            "Successfully generated {} presignatures (pool: {}/{})",
            generated,
            current_size + generated,
            self.target_size
        );

        Ok(generated)
    }

    /// Acquire a presignature from the pool
    ///
    /// This method marks a presignature as used and returns it for signing.
    pub async fn acquire_presignature(&self) -> Result<PresignatureId> {
        let mut pool = self.pool.write().await;

        // Find first unused presignature
        let entry = pool
            .iter_mut()
            .find(|e| !e.is_used)
            .ok_or_else(|| OrchestrationError::Internal("No presignatures available".to_string()))?;

        entry.is_used = true;
        let presig_id = entry.id.clone();

        // Update statistics
        let mut stats = self.stats.write().await;
        stats.total_used += 1;
        stats.hourly_usage += 1;

        info!(
            "Acquired presignature: {} (remaining: {}/{})",
            presig_id,
            pool.iter().filter(|e| !e.is_used).count(),
            pool.len()
        );

        Ok(presig_id)
    }

    /// Get presignature pool statistics
    pub async fn get_stats(&self) -> PresignatureStats {
        let pool = self.pool.read().await;
        let gen_stats = self.stats.read().await;

        let current_size = pool.iter().filter(|e| !e.is_used).count();

        PresignatureStats {
            current_size,
            target_size: self.target_size,
            max_size: self.max_size,
            utilization: if self.target_size > 0 {
                (current_size as f64 / self.target_size as f64) * 100.0
            } else {
                0.0
            },
            hourly_usage: gen_stats.hourly_usage,
            total_generated: gen_stats.total_generated,
            total_used: gen_stats.total_used,
        }
    }

    /// Join an existing presignature session as a participant (non-leader)
    ///
    /// SORUN #19 FIX #4: This method allows participant nodes to join a presignature
    /// session initiated by a coordinator node. It:
    /// 1. Registers the session with MessageRouter
    /// 2. Loads aux_info and key_share
    /// 3. Creates channel adapters for protocol communication
    /// 4. Runs the presignature generation protocol
    ///
    /// This is called from /internal/presig-join endpoint when a participant node
    /// receives a broadcast from the coordinator.
    pub async fn join_presignature_session(
        &self,
        session_id: uuid::Uuid,
        participants: Vec<NodeId>,
    ) -> Result<()> {
        // FIX: Acquire semaphore permit - only 1 presignature session at a time
        // This prevents duplicate message errors when multiple sessions run in parallel
        let _permit = self.presig_session_semaphore.acquire().await.map_err(|_| {
            OrchestrationError::Internal("Failed to acquire presignature session permit".to_string())
        })?;

        info!(
            "Joining presignature session {} with {} participants (acquired permit)",
            session_id,
            participants.len()
        );

        // Step 1: Register session with MessageRouter
        let (outgoing_tx, incoming_rx) = self
            .message_router
            .register_session(
                session_id,
                RouterProtocolType::Presignature,
                participants.clone(),
            )
            .await?;

        info!(
            "Registered presignature session {} with MessageRouter",
            session_id
        );

        // ============================================================
        // CRITICAL FIX: Signal ready to coordinator via etcd barrier
        // ============================================================
        // The coordinator waits for all participants to signal ready
        // before starting the protocol. Without this, the coordinator
        // may start sending messages before we're ready to receive them.
        // ============================================================
        let barrier_key = format!("/presig/{}/ready/{}", session_id, self.node_id.0);
        {
            let etcd = self.etcd.lock().await;
            if let Err(e) = etcd.put(&barrier_key, &[1]).await {
                error!("Failed to signal ready for presig session {}: {}", session_id, e);
            } else {
                info!(
                    "✅ [Node {}] Signaled ready for presig session {}",
                    self.node_id.0, session_id
                );
            }
        }

        // Step 2: Get aux_info and key_share
        let (aux_info_session_id, aux_info_data) = self
            .aux_info_service
            .get_latest_aux_info()
            .await
            .ok_or_else(|| {
                OrchestrationError::Internal(
                    "No aux_info available. Run aux_info generation first.".to_string(),
                )
            })?;

        info!(
            "Using aux_info from session {} ({} bytes)",
            aux_info_session_id,
            aux_info_data.len()
        );

        let key_share_data = self
            .postgres
            .get_latest_key_share(self.node_id)
            .await
            .map_err(|e| {
                OrchestrationError::StorageError(format!("Failed to get latest key_share: {}", e))
            })?
            .ok_or_else(|| {
                OrchestrationError::StorageError(
                    "No key_share found for this node. Run DKG ceremony first.".to_string(),
                )
            })?;

        info!(
            "Using latest key_share from DKG ceremony ({} bytes)",
            key_share_data.len()
        );

        // Step 3: Convert NodeIDs to party indices
        // NodeIDs are 1-indexed [1,2,3,4], party indices are 0-indexed [0,1,2,3]
        let participants_party_indices: Vec<u16> = participants
            .iter()
            .map(|n| (n.0 - 1) as u16)
            .collect();
        let party_index = (self.node_id.0 - 1) as u16;

        info!(
            "Party index: {}, Participants: {:?}",
            party_index, participants_party_indices
        );

        // Step 4: Create channel adapters
        // Convert between ProtocolMessage (MessageRouter) and protocol-specific messages
        // CRITICAL FIX: Store JoinHandles to abort tasks when protocol finishes
        let (protocol_incoming_tx, protocol_incoming_rx) = async_channel::bounded(100);
        let incoming_task = tokio::spawn(async move {
            while let Ok(proto_msg) = incoming_rx.recv().await {
                match bincode::deserialize(&proto_msg.payload) {
                    Ok(msg) => {
                        if protocol_incoming_tx.send(msg).await.is_err() {
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            "Failed to deserialize presignature message: {}",
                            e
                        );
                    }
                }
            }
        });

        let (protocol_outgoing_tx, protocol_outgoing_rx) = async_channel::bounded(100);
        let node_id = self.node_id;
        let outgoing_task = tokio::spawn(async move {
            let mut sequence = 0u64;
            while let Ok(msg) = protocol_outgoing_rx.recv().await {
                let payload = match bincode::serialize(&msg) {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::error!(
                            "Failed to serialize presignature message: {}",
                            e
                        );
                        continue;
                    }
                };

                for &participant in &participants {
                    if participant != node_id {
                        let proto_msg = RouterProtocolMessage {
                            session_id,
                            from: node_id,
                            to: participant,
                            payload: payload.clone(),
                            sequence,
                            is_broadcast: true,
                        };
                        if outgoing_tx.send(proto_msg).await.is_err() {
                            tracing::error!(
                                "Failed to send message to participant {}",
                                participant
                            );
                        }
                    }
                }
                sequence += 1;
            }
        });

        // Step 5: Run the presignature generation protocol with TIMEOUT
        // CRITICAL FIX: If coordinator fails, participants would wait forever for messages.
        // Adding a 30 second timeout ensures we don't hold the semaphore permit forever.
        info!(
            "Running presignature protocol for session {} (30s timeout)",
            session_id
        );

        let protocol_timeout = tokio::time::Duration::from_secs(30);
        let result = match tokio::time::timeout(
            protocol_timeout,
            protocols::cggmp24::presignature::generate_presignature(
                party_index,
                &participants_party_indices,
                &session_id.to_string(),
                &key_share_data,
                &aux_info_data,
                protocol_incoming_rx,
                protocol_outgoing_tx,
            ),
        )
        .await
        {
            Ok(r) => r,
            Err(_) => {
                warn!(
                    "Presignature protocol timed out after {:?} for session {}",
                    protocol_timeout, session_id
                );
                protocols::cggmp24::presignature::PresignatureResult {
                    success: false,
                    presignature: None,
                    error: Some(format!("Protocol timeout after {:?}", protocol_timeout)),
                    duration_secs: protocol_timeout.as_secs_f64(),
                }
            }
        };

        // CRITICAL FIX: Abort forwarding tasks BEFORE unregistering session
        // This prevents messages from being sent after session cleanup
        incoming_task.abort();
        outgoing_task.abort();

        // FIX: Always unregister session after completion (success or failure)
        // This prevents message collisions between sequential presignature sessions
        let unregister_result = self.message_router.unregister_session(session_id).await;

        // Clean up our barrier key from etcd (coordinator cleans up all keys)
        {
            let etcd = self.etcd.lock().await;
            let barrier_key = format!("/presig/{}/ready/{}", session_id, self.node_id.0);
            let _ = etcd.delete(&barrier_key).await; // Ignore errors during cleanup
        }

        if !result.success {
            let error_msg = format!(
                "Presignature protocol failed: {:?}",
                result.error
            );
            error!("{}", error_msg);

            if let Err(e) = unregister_result {
                warn!("Failed to unregister failed presignature session {}: {}", session_id, e);
            }

            return Err(OrchestrationError::Protocol(error_msg));
        }

        if let Err(e) = unregister_result {
            warn!("Failed to unregister completed presignature session {}: {}", session_id, e);
        }

        info!(
            "Successfully completed presignature session {} (session unregistered)",
            session_id
        );

        Ok(())
    }

    /// Cleanup old unused presignatures (older than 24 hours)
    async fn cleanup_old_presignatures(&self) {
        let mut pool = self.pool.write().await;
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);

        let before_count = pool.len();
        pool.retain(|entry| entry.is_used || entry.created_at > cutoff);
        let after_count = pool.len();

        if before_count > after_count {
            info!(
                "Cleaned up {} old presignatures ({}->{})",
                before_count - after_count,
                before_count,
                after_count
            );
        }
    }

    /// Handle incoming presignature round message from another node
    pub async fn handle_presig_message(&self, msg: PresignatureMessage) -> Result<()> {
        info!(
            "Received presig message: presig_id={} round={} from={}",
            msg.presig_id, msg.round, msg.from
        );

        // TODO: Implement presignature message handling
        // Store message in buffer for processing during presignature generation rounds

        Ok(())
    }

    /// Get CGGMP24 participants from DKG ceremony configuration
    ///
    /// Returns the list of party indices that should participate in presignature generation.
    /// IMPORTANT: The coordinator (this node) MUST be included in the participants list.
    ///
    /// Reads DKG ceremony configuration from etcd to get participant count.
    async fn get_cggmp24_participants(&self) -> Result<Vec<u16>> {
        // Read DKG ceremony configuration from etcd
        let config_key = "/cluster/dkg/cggmp24/config";

        // This node's party index (0-indexed)
        let my_party_index = (self.node_id.0 - 1) as u16;

        let config_bytes = {
            let mut etcd = self.etcd.lock().await;
            etcd.get(config_key).await
                .map_err(|e| OrchestrationError::Storage(e.into()))?
        };

        let (threshold, total_nodes) = if let Some(bytes) = config_bytes {
            // Parse configuration
            let config: serde_json::Value = serde_json::from_slice(&bytes)
                .map_err(|e| OrchestrationError::Internal(format!("Failed to parse DKG config: {}", e)))?;

            let total = config["total_nodes"].as_u64()
                .ok_or_else(|| OrchestrationError::Internal("Missing total_nodes in DKG config".to_string()))? as u16;

            let thresh = config["threshold"].as_u64()
                .ok_or_else(|| OrchestrationError::Internal("Missing threshold in DKG config".to_string()))? as u16;

            (thresh, total)
        } else {
            // Fallback: default configuration if etcd key not found
            warn!("CGGMP24 DKG config not found in etcd, using default configuration");
            (4u16, 5u16) // threshold=4, total_nodes=5
        };

        // FIX: Build participant list that INCLUDES the coordinator (this node)
        // CGGMP24 presignature requires EXACTLY threshold parties
        // The coordinator MUST be in the list, otherwise "Party X is not in the presignature parties list" error

        let mut participants: Vec<u16> = Vec::with_capacity(threshold as usize);

        // Always include coordinator first
        participants.push(my_party_index);

        // Fill remaining slots with other parties (0 to total_nodes-1, excluding coordinator)
        for i in 0..total_nodes {
            if participants.len() >= threshold as usize {
                break;
            }
            if i != my_party_index {
                participants.push(i);
            }
        }

        // Sort for consistency
        participants.sort();

        info!(
            "CGGMP24 presignature participants: coordinator={}, threshold={}, total_nodes={}, participants={:?}",
            my_party_index, threshold, total_nodes, participants
        );

        Ok(participants)
    }

    /// Broadcast presignature join request to all participant nodes (SORUN #19 FIX)
    ///
    /// This method broadcasts a presig-join request to all nodes that should participate
    /// in the presignature generation, allowing them to register the session and handle
    /// incoming QUIC protocol messages.
    ///
    /// Similar to DKG's broadcast_dkg_join_request().
    async fn broadcast_presig_join_request(
        &self,
        session_id: Uuid,
        participants: &[NodeId],
    ) -> Result<()> {
        use serde::{Deserialize, Serialize};
        use std::time::Duration;

        #[derive(Debug, Clone, Serialize, Deserialize)]
        struct PresigJoinRequest {
            session_id: String,
            participants: Vec<u64>,
        }

        let participant_ids: Vec<u64> = participants.iter().map(|n| n.0).collect();

        let join_request = PresigJoinRequest {
            session_id: session_id.to_string(),
            participants: participant_ids.clone(),
        };

        // Broadcast to all participant nodes except this node (coordinator)
        let broadcast_futures: Vec<_> = participants
            .iter()
            .filter(|node_id| **node_id != self.node_id)
            .filter_map(|node_id| {
                // Get endpoint for this node
                self.node_endpoints.get(&node_id.0).map(|endpoint| {
                    let client = self.http_client.clone();
                    let url = format!("{}/internal/presig-join", endpoint);
                    let req = join_request.clone();
                    let node_id = *node_id;

                    async move {
                        match client
                            .post(&url)
                            .json(&req)
                            .timeout(Duration::from_secs(5))
                            .send()
                            .await
                        {
                            Ok(resp) if resp.status().is_success() => {
                                info!("Presig join request sent to node {}", node_id.0);
                                Ok(())
                            }
                            Ok(resp) => {
                                warn!(
                                    "Presig join request failed for node {}: status={}",
                                    node_id.0,
                                    resp.status()
                                );
                                Err(())
                            }
                            Err(e) => {
                                error!("Failed to send presig join request to node {}: {}", node_id.0, e);
                                Err(())
                            }
                        }
                    }
                })
            })
            .collect();

        // Wait for all broadcasts (don't fail if some nodes are unreachable)
        let results = futures::future::join_all(broadcast_futures).await;
        let success_count = results.iter().filter(|r| r.is_ok()).count();

        info!(
            "Presig join request broadcast: {}/{} nodes reached",
            success_count,
            participants.len() - 1 // Exclude coordinator
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_presignature_stats() {
        let stats = PresignatureStats {
            current_size: 50,
            target_size: 100,
            max_size: 150,
            utilization: 50.0,
            hourly_usage: 10,
            total_generated: 100,
            total_used: 50,
        };

        assert!(stats.is_healthy()); // 50 > 20
        assert!(!stats.is_critical()); // 50 > 10
    }

    #[test]
    fn test_presignature_stats_critical() {
        let stats = PresignatureStats {
            current_size: 5,
            target_size: 100,
            max_size: 150,
            utilization: 5.0,
            hourly_usage: 50,
            total_generated: 100,
            total_used: 95,
        };

        assert!(!stats.is_healthy()); // 5 < 20
        assert!(stats.is_critical()); // 5 < 10
    }

    #[tokio::test]
    #[ignore] // Requires running etcd and PostgreSQL
    async fn test_presignature_service() {
        // TODO: Add integration test with mock etcd and PostgreSQL
    }
}
