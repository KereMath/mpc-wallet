//! Transaction Orchestration Service
//!
//! This module provides the main orchestration service that coordinates
//! the complete transaction lifecycle from creation to confirmation.
//!
//! # Security Principles
//!
//! 1. **Defense in Depth**: Multiple validation layers
//! 2. **Least Privilege**: Minimal permissions per component
//! 3. **Fail-Safe Defaults**: System defaults to safe state on errors
//! 4. **Complete Mediation**: Every access checked
//! 5. **Open Design**: Security through cryptography
//! 6. **Separation of Duties**: No single control point
//! 7. **Psychological Acceptability**: Type-safe APIs

pub mod config;
pub mod service;
pub mod timeout_monitor;
pub mod health_checker;
pub mod error;

pub use config::{OrchestrationConfig, OrchestrationConfigBuilder};
pub use service::{OrchestrationService, OrchestrationServiceBuilder};
pub use timeout_monitor::{TimeoutMonitor, TimeoutMonitorBuilder};
pub use health_checker::{HealthChecker, HealthCheckerBuilder};
pub use error::{OrchestrationError, Result};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::config::OrchestrationConfig;
    pub use crate::service::OrchestrationService;
    pub use crate::timeout_monitor::TimeoutMonitor;
    pub use crate::health_checker::HealthChecker;
    pub use crate::error::{OrchestrationError, Result};
}
