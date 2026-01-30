//! Internal API handlers for node-to-node communication

use crate::error::ApiError;
use crate::state::AppState;
use axum::{extract::State, Json};
use threshold_types::VoteRequest;
use tracing::info;
use serde::{Deserialize, Serialize};

/// DKG join request from coordinator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DkgJoinRequest {
    pub session_id: String,
    pub protocol: String,
    pub threshold: u32,
    pub total_nodes: u32,
}

/// Receive a vote request from orchestrator
///
/// POST /internal/vote-request
pub async fn receive_vote_request(
    State(state): State<AppState>,
    Json(req): Json<VoteRequest>,
) -> Result<Json<&'static str>, ApiError> {
    info!("Received vote request for tx_id={}", req.tx_id);

    // Trigger automatic voting mechanism
    state
        .vote_trigger
        .send(req)
        .await
        .map_err(|_| ApiError::InternalError("Vote trigger channel closed".into()))?;

    Ok(Json("Vote request received"))
}

/// Receive a DKG join request from coordinator
///
/// POST /internal/dkg-join
pub async fn receive_dkg_join_request(
    State(state): State<AppState>,
    Json(req): Json<DkgJoinRequest>,
) -> Result<Json<&'static str>, ApiError> {
    info!(
        "Received DKG join request for session_id={} protocol={}",
        req.session_id, req.protocol
    );

    // Parse session ID
    let session_uuid = uuid::Uuid::parse_str(&req.session_id)
        .map_err(|_| ApiError::BadRequest("Invalid session ID format".into()))?;

    // Join the DKG ceremony automatically
    tokio::spawn(async move {
        match state.dkg_service.join_dkg_ceremony(session_uuid).await {
            Ok(result) => {
                info!(
                    "Successfully joined DKG ceremony: session_id={} address={}",
                    result.session_id, result.address
                );
            }
            Err(e) => {
                tracing::error!("Failed to join DKG ceremony: {}", e);
            }
        }
    });

    Ok(Json("DKG join request received"))
}

/// Aux_info join request from coordinator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuxInfoJoinRequest {
    pub session_id: String,
    pub num_parties: u16,
}

/// Receive an aux_info join request from coordinator
///
/// POST /internal/aux-info-join
///
/// This fixes SORUN #15 by allowing participant nodes to join aux_info ceremonies.
pub async fn receive_aux_info_join_request(
    State(state): State<AppState>,
    Json(req): Json<AuxInfoJoinRequest>,
) -> Result<Json<&'static str>, ApiError> {
    info!(
        "Received aux_info join request for session_id={} num_parties={}",
        req.session_id, req.num_parties
    );

    // Parse session ID
    let session_uuid = uuid::Uuid::parse_str(&req.session_id)
        .map_err(|_| ApiError::BadRequest("Invalid session ID format".into()))?;

    // Join the aux_info ceremony automatically
    tokio::spawn(async move {
        match state.aux_info_service.join_aux_info_ceremony(session_uuid).await {
            Ok(result) => {
                info!(
                    "Successfully joined aux_info ceremony: session_id={} success={}",
                    result.session_id, result.success
                );
            }
            Err(e) => {
                tracing::error!("Failed to join aux_info ceremony: {}", e);
            }
        }
    });

    Ok(Json("Aux_info join request received"))
}

/// Presignature join request from coordinator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresigJoinRequest {
    pub session_id: String,
    pub participants: Vec<u64>, // Node IDs
}

/// Receive a presignature join request from coordinator
///
/// POST /internal/presig-join
///
/// SORUN #19 FIX #4: Allow participant nodes to join presignature sessions.
/// This endpoint spawns a task to join the presignature protocol, similar to
/// DKG and Aux-Info ceremonies.
///
/// FIX SORUN #14: Check for duplicate sessions before joining to prevent
/// AttemptToOverwriteReceivedMsg errors from concurrent session handling.
pub async fn receive_presig_join_request(
    State(state): State<AppState>,
    Json(req): Json<PresigJoinRequest>,
) -> Result<Json<&'static str>, ApiError> {
    info!(
        "Received presig join request for session_id={} participants={:?}",
        req.session_id, req.participants
    );

    // Parse session ID
    let session_uuid = uuid::Uuid::parse_str(&req.session_id)
        .map_err(|_| ApiError::BadRequest("Invalid session ID format".into()))?;

    // FIX: Check if session is already registered to prevent duplicate handling
    if state.message_router.is_session_registered(session_uuid).await {
        info!(
            "Presig session {} already registered, ignoring duplicate request",
            session_uuid
        );
        return Ok(Json("Presig session already in progress"));
    }

    // Convert participants to NodeId
    let participants: Vec<threshold_types::NodeId> = req
        .participants
        .iter()
        .map(|&id| threshold_types::NodeId(id))
        .collect();

    // Join the presignature session automatically (similar to DKG/Aux-Info)
    // SORUN #19 FIX #4: Spawn a task to run the presignature protocol
    tokio::spawn(async move {
        match state
            .presig_service
            .join_presignature_session(session_uuid, participants)
            .await
        {
            Ok(_) => {
                info!(
                    "Successfully joined presignature session: session_id={}",
                    session_uuid
                );
            }
            Err(e) => {
                // FIX: Don't log SessionAlreadyExists as error - it's expected behavior
                let error_msg = e.to_string();
                if error_msg.contains("already exists") || error_msg.contains("already registered") {
                    info!(
                        "Presig session {} skipped (already in progress): {}",
                        session_uuid, error_msg
                    );
                } else {
                    tracing::error!("Failed to join presignature session: {}", e);
                }
            }
        }
    });

    Ok(Json("Presig join request received"))
}

/// Signing join request from coordinator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigningJoinRequest {
    pub session_id: String,
    pub tx_id: String,
    pub protocol: String,
    pub unsigned_tx: Vec<u8>,
    pub message_hash: Vec<u8>,
}

/// Receive a signing join request from coordinator
///
/// POST /internal/signing-join
///
/// This fixes SORUN #17 by allowing participant nodes to join signing ceremonies.
pub async fn receive_signing_join_request(
    State(_state): State<AppState>,
    Json(req): Json<SigningJoinRequest>,
) -> Result<Json<&'static str>, ApiError> {
    info!(
        "Received signing join request for session_id={} tx_id={} protocol={}",
        req.session_id, req.tx_id, req.protocol
    );

    // For signing, we don't need to spawn a join task like DKG/aux_info
    // The signing coordinator will handle the protocol via QUIC messages
    // This HTTP request just ensures all nodes are "aware" of the signing session
    // and ready to receive QUIC protocol messages

    info!(
        "Acknowledged signing session: session_id={} tx_id={}",
        req.session_id, req.tx_id
    );

    Ok(Json("Signing join request received"))
}

/// Response for aux-ready check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuxReadyResponse {
    pub ready: bool,
    pub node_id: u64,
}

/// Check if this node has aux_info ready for presignature generation
///
/// GET /internal/aux-ready
///
/// Used by coordinator to verify all participants have aux_info before starting presig
pub async fn check_aux_ready(
    State(state): State<AppState>,
) -> Result<Json<AuxReadyResponse>, ApiError> {
    let has_aux_info = state.aux_info_service.get_latest_aux_info().await.is_some();

    Ok(Json(AuxReadyResponse {
        ready: has_aux_info,
        node_id: state.node_id.0,
    }))
}
