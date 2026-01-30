//! Wallet management endpoints

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use threshold_orchestrator::ProtocolType;

use crate::{error::ApiError, state::AppState, ApiResult};

/// Wallet balance response
#[derive(Debug, Serialize, Deserialize)]
pub struct WalletBalanceResponse {
    /// Total confirmed balance in satoshis
    pub confirmed: u64,
    /// Total unconfirmed balance in satoshis
    pub unconfirmed: u64,
    /// Total balance (confirmed + unconfirmed)
    pub total: u64,
}

/// Wallet address response
#[derive(Debug, Serialize, Deserialize)]
pub struct WalletAddressResponse {
    /// Bitcoin address for receiving funds
    pub address: String,
    /// Address type (e.g., "p2wpkh", "p2tr")
    pub address_type: String,
}

/// GET /api/v1/wallet/balance - Get wallet balance
///
/// Returns the current balance of the MPC wallet including
/// confirmed and unconfirmed amounts
pub async fn get_balance(
    State(state): State<AppState>,
) -> ApiResult<Json<WalletBalanceResponse>> {
    // First get the wallet address from DKG
    let address = get_wallet_address_from_dkg(&state).await?;

    // Fetch balance from Bitcoin client using actual address
    match state.bitcoin.get_balance(&address).await {
        Ok(balance) => {
            Ok(Json(WalletBalanceResponse {
                confirmed: balance.confirmed,
                unconfirmed: balance.unconfirmed,
                total: balance.confirmed + balance.unconfirmed,
            }))
        }
        Err(e) => {
            tracing::warn!("Failed to fetch balance from blockchain: {}", e);
            // Return zero balance if blockchain query fails
            Ok(Json(WalletBalanceResponse {
                confirmed: 0,
                unconfirmed: 0,
                total: 0,
            }))
        }
    }
}

/// GET /api/v1/wallet/address - Get receiving address
///
/// Returns the current receiving address for the MPC wallet
pub async fn get_address(
    State(state): State<AppState>,
) -> ApiResult<Json<WalletAddressResponse>> {
    // Get address from completed DKG ceremony
    let ceremonies = state
        .dkg_service
        .list_ceremonies()
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to list DKG ceremonies: {}", e)))?;

    // Find the latest completed ceremony (prefer CGGMP24 for SegWit compatibility)
    let completed_ceremony = ceremonies
        .iter()
        .filter(|c| matches!(c.status, threshold_orchestrator::DkgStatus::Completed))
        .max_by_key(|c| c.completed_at);

    match completed_ceremony {
        Some(ceremony) => {
            let address_type = match ceremony.protocol {
                ProtocolType::CGGMP24 => "p2wpkh",
                ProtocolType::FROST => "p2tr",
            };

            Ok(Json(WalletAddressResponse {
                address: ceremony.address.clone().unwrap_or_else(|| "Address not available".to_string()),
                address_type: address_type.to_string(),
            }))
        }
        None => {
            Err(ApiError::NotFound("No wallet address available. Please complete DKG ceremony first.".to_string()))
        }
    }
}

/// Helper to get wallet address from DKG for balance queries
async fn get_wallet_address_from_dkg(state: &AppState) -> Result<String, ApiError> {
    let ceremonies = state
        .dkg_service
        .list_ceremonies()
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to list DKG ceremonies: {}", e)))?;

    let completed_ceremony = ceremonies
        .iter()
        .filter(|c| matches!(c.status, threshold_orchestrator::DkgStatus::Completed))
        .max_by_key(|c| c.completed_at);

    match completed_ceremony {
        Some(ceremony) => {
            ceremony.address.clone().ok_or_else(|| {
                ApiError::NotFound("DKG completed but no address available".to_string())
            })
        }
        None => {
            Err(ApiError::NotFound("No wallet address. Complete DKG first.".to_string()))
        }
    }
}
