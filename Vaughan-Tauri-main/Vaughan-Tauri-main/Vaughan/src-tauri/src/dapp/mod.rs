///! dApp Integration Module
///!
///! Provides EIP-1193 compatible provider for dApps

pub mod rate_limiter;
pub mod rpc_handler;
pub mod session;
pub mod approval;
pub mod window_registry;
pub mod health;
pub mod logging;
pub mod profiling;
pub mod cert;

pub use rate_limiter::RateLimiter;
pub use session::{SessionManager, DappConnection, DappOrigin};
pub use approval::{ApprovalQueue, ApprovalRequest, ApprovalResponse, ApprovalRequestType};
pub use window_registry::{WindowRegistry, WindowInfo};
pub use health::{HealthMonitor, HealthMetrics};
pub use profiling::{Profiler, MethodStats};
