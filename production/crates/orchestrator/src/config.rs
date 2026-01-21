//! Configuration for the orchestration service

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Configuration for the orchestration service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationConfig {
    /// Interval for polling pending transactions
    pub poll_interval: Duration,

    /// Timeout for voting phase
    pub voting_timeout: Duration,

    /// Timeout for signing phase
    pub signing_timeout: Duration,

    /// Timeout for broadcasting phase
    pub broadcast_timeout: Duration,

    /// Maximum number of retries for failed operations
    pub max_retries: u32,

    /// Initial backoff duration for retries
    pub initial_backoff: Duration,

    /// Maximum backoff duration for retries
    pub max_backoff: Duration,

    /// Number of confirmations required for transaction finality
    pub required_confirmations: u32,

    /// Maximum number of concurrent operations
    pub max_concurrent_ops: usize,

    /// Grace period before considering a node failed
    pub node_failure_grace_period: Duration,

    /// Enable Byzantine fault detection
    pub enable_byzantine_detection: bool,
}

impl Default for OrchestrationConfig {
    fn default() -> Self {
        Self {
            poll_interval: Duration::from_secs(5),
            voting_timeout: Duration::from_secs(60),
            signing_timeout: Duration::from_secs(120),
            broadcast_timeout: Duration::from_secs(30),
            max_retries: 3,
            initial_backoff: Duration::from_millis(500),
            max_backoff: Duration::from_secs(30),
            required_confirmations: 6,
            max_concurrent_ops: 10,
            node_failure_grace_period: Duration::from_secs(30),
            enable_byzantine_detection: true,
        }
    }
}

/// Builder for OrchestrationConfig
pub struct OrchestrationConfigBuilder {
    config: OrchestrationConfig,
}

impl OrchestrationConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: OrchestrationConfig::default(),
        }
    }

    pub fn poll_interval(mut self, interval: Duration) -> Self {
        self.config.poll_interval = interval;
        self
    }

    pub fn voting_timeout(mut self, timeout: Duration) -> Self {
        self.config.voting_timeout = timeout;
        self
    }

    pub fn signing_timeout(mut self, timeout: Duration) -> Self {
        self.config.signing_timeout = timeout;
        self
    }

    pub fn broadcast_timeout(mut self, timeout: Duration) -> Self {
        self.config.broadcast_timeout = timeout;
        self
    }

    pub fn max_retries(mut self, retries: u32) -> Self {
        self.config.max_retries = retries;
        self
    }

    pub fn initial_backoff(mut self, backoff: Duration) -> Self {
        self.config.initial_backoff = backoff;
        self
    }

    pub fn max_backoff(mut self, backoff: Duration) -> Self {
        self.config.max_backoff = backoff;
        self
    }

    pub fn required_confirmations(mut self, confirmations: u32) -> Self {
        self.config.required_confirmations = confirmations;
        self
    }

    pub fn max_concurrent_ops(mut self, max_ops: usize) -> Self {
        self.config.max_concurrent_ops = max_ops;
        self
    }

    pub fn node_failure_grace_period(mut self, grace: Duration) -> Self {
        self.config.node_failure_grace_period = grace;
        self
    }

    pub fn enable_byzantine_detection(mut self, enable: bool) -> Self {
        self.config.enable_byzantine_detection = enable;
        self
    }

    pub fn build(self) -> OrchestrationConfig {
        self.config
    }
}

impl Default for OrchestrationConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = OrchestrationConfig::default();
        assert_eq!(config.poll_interval, Duration::from_secs(5));
        assert_eq!(config.voting_timeout, Duration::from_secs(60));
        assert_eq!(config.max_retries, 3);
        assert!(config.enable_byzantine_detection);
    }

    #[test]
    fn test_builder() {
        let config = OrchestrationConfigBuilder::new()
            .poll_interval(Duration::from_secs(10))
            .max_retries(5)
            .enable_byzantine_detection(false)
            .build();

        assert_eq!(config.poll_interval, Duration::from_secs(10));
        assert_eq!(config.max_retries, 5);
        assert!(!config.enable_byzantine_detection);
    }
}
