//! Timeout monitoring service for transactions.
//!
//! Detects and handles:
//! - Voting timeouts (>60s without reaching threshold)
//! - Signing timeouts (>120s without completion)
//! - Broadcasting timeouts (>300s without confirmation)

use crate::config::OrchestrationConfig;
use crate::error::{OrchestrationError, Result};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time::interval;
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

use threshold_storage::PostgresStorage;
use threshold_types::{TxId, TransactionState};

/// Track when transactions entered each state.
#[derive(Debug, Clone)]
struct TransactionTimer {
    tx_id: TxId,
    state: String,
    entered_at: Instant,
}

/// Timeout monitoring service.
pub struct TimeoutMonitor {
    config: OrchestrationConfig,
    postgres: Arc<PostgresStorage>,
    timers: Arc<RwLock<HashMap<String, TransactionTimer>>>,
    shutdown: Arc<RwLock<bool>>,
}

impl TimeoutMonitor {
    /// Start the timeout monitor in the background
    pub fn start(self: Arc<Self>) -> JoinHandle<Result<()>> {
        tokio::spawn(async move {
            info!("Timeout monitor started");

            match self.run().await {
                Ok(()) => {
                    info!("Timeout monitor stopped normally");
                    Ok(())
                }
                Err(e) => {
                    error!("Timeout monitor error: {}", e);
                    Err(e)
                }
            }
        })
    }

    /// Main monitoring loop
    async fn run(&self) -> Result<()> {
        // Check timeouts every 10 seconds
        let mut interval = interval(Duration::from_secs(10));

        loop {
            // Check shutdown signal
            if *self.shutdown.read().await {
                info!("Shutdown signal received, stopping timeout monitor");
                return Ok(());
            }

            interval.tick().await;

            // Check for timeouts in different phases
            if let Err(e) = self.check_voting_timeouts().await {
                error!("Error checking voting timeouts: {}", e);
            }

            if let Err(e) = self.check_signing_timeouts().await {
                error!("Error checking signing timeouts: {}", e);
            }

            if let Err(e) = self.check_broadcasting_timeouts().await {
                error!("Error checking broadcasting timeouts: {}", e);
            }
        }
    }

    /// Check for voting timeouts.
    async fn check_voting_timeouts(&self) -> Result<()> {
        let voting_txs = self.postgres.get_transactions_by_state("voting").await
            .map_err(|e| OrchestrationError::Storage(e.into()))?;

        for tx in voting_txs {
            let elapsed = self.get_time_in_state(&tx.txid, "voting").await;

            if elapsed > self.config.voting_timeout {
                warn!(
                    "Transaction {:?} voting timeout after {:?}",
                    tx.txid, elapsed
                );

                // Abort transaction
                self.postgres.update_transaction_state(&tx.txid, TransactionState::Failed).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;

                // Record audit event
                self.postgres.record_audit_event(
                    &tx.txid,
                    "voting_timeout",
                    &format!("Voting timeout after {} seconds", elapsed.as_secs()),
                ).await
                .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
        }

        Ok(())
    }

    /// Check for signing timeouts.
    async fn check_signing_timeouts(&self) -> Result<()> {
        let signing_txs = self.postgres.get_transactions_by_state("signing").await
            .map_err(|e| OrchestrationError::Storage(e.into()))?;

        for tx in signing_txs {
            let elapsed = self.get_time_in_state(&tx.txid, "signing").await;

            if elapsed > self.config.signing_timeout {
                warn!(
                    "Transaction {:?} signing timeout after {:?}",
                    tx.txid, elapsed
                );

                self.postgres.update_transaction_state(&tx.txid, TransactionState::Failed).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;

                // Record audit event
                self.postgres.record_audit_event(
                    &tx.txid,
                    "signing_timeout",
                    &format!("Signing timeout after {} seconds", elapsed.as_secs()),
                ).await
                .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
        }

        Ok(())
    }

    /// Check for broadcasting timeouts.
    async fn check_broadcasting_timeouts(&self) -> Result<()> {
        let broadcasting_txs = self.postgres.get_transactions_by_state("broadcasting").await
            .map_err(|e| OrchestrationError::Storage(e.into()))?;

        for tx in broadcasting_txs {
            let elapsed = self.get_time_in_state(&tx.txid, "broadcasting").await;

            if elapsed > self.config.broadcast_timeout {
                warn!(
                    "Transaction {:?} broadcasting timeout after {:?}",
                    tx.txid, elapsed
                );

                // Mark as failed, may need manual investigation
                self.postgres.update_transaction_state(&tx.txid, TransactionState::Failed).await
                    .map_err(|e| OrchestrationError::Storage(e.into()))?;

                // Record audit event
                self.postgres.record_audit_event(
                    &tx.txid,
                    "broadcasting_timeout",
                    &format!("Broadcasting timeout after {} seconds", elapsed.as_secs()),
                ).await
                .map_err(|e| OrchestrationError::Storage(e.into()))?;
            }
        }

        Ok(())
    }

    /// Get time elapsed in current state.
    async fn get_time_in_state(&self, tx_id: &TxId, state: &str) -> Duration {
        let timers = self.timers.read().await;

        if let Some(timer) = timers.get(&tx_id.0) {
            if timer.state == state {
                return timer.entered_at.elapsed();
            }
        }

        // If not tracked, query database for updated_at timestamp
        // and calculate elapsed time from there
        // For now, return 0 duration
        Duration::from_secs(0)
    }

    /// Record state transition.
    pub async fn record_state_transition(&self, tx_id: TxId, new_state: String) {
        let mut timers = self.timers.write().await;
        timers.insert(
            tx_id.0.clone(),
            TransactionTimer {
                tx_id,
                state: new_state,
                entered_at: Instant::now(),
            },
        );
    }

    /// Initiate graceful shutdown
    pub async fn shutdown(&self) {
        info!("Initiating timeout monitor shutdown");
        *self.shutdown.write().await = true;
    }
}

/// Builder for TimeoutMonitor
pub struct TimeoutMonitorBuilder {
    config: Option<OrchestrationConfig>,
    postgres: Option<Arc<PostgresStorage>>,
}

impl TimeoutMonitorBuilder {
    pub fn new() -> Self {
        Self {
            config: None,
            postgres: None,
        }
    }

    pub fn with_config(mut self, config: OrchestrationConfig) -> Self {
        self.config = Some(config);
        self
    }

    pub fn with_postgres(mut self, postgres: Arc<PostgresStorage>) -> Self {
        self.postgres = Some(postgres);
        self
    }

    pub fn build(self) -> Result<Arc<TimeoutMonitor>> {
        let config = self.config.unwrap_or_default();
        let postgres = self.postgres
            .ok_or_else(|| OrchestrationError::Config("PostgresStorage is required".to_string()))?;

        Ok(Arc::new(TimeoutMonitor {
            config,
            postgres,
            timers: Arc::new(RwLock::new(HashMap::new())),
            shutdown: Arc::new(RwLock::new(false)),
        }))
    }
}

impl Default for TimeoutMonitorBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder() {
        // Test builder pattern (requires mock PostgresStorage for actual build)
        let builder = TimeoutMonitorBuilder::new();
        assert!(builder.config.is_none());
        assert!(builder.postgres.is_none());
    }
}
