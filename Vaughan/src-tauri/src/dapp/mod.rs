pub mod approval;
pub mod health;
pub mod logging;
pub mod profiling;
///! dApp Integration Module
///!
///! Provides EIP-1193 compatible provider for dApps
pub mod rate_limiter;
pub mod rpc;
pub mod session;
pub mod window_registry;

pub use approval::{ApprovalQueue, ApprovalRequest, ApprovalRequestType, ApprovalResponse};
pub use health::{HealthMetrics, HealthMonitor};
pub use profiling::{MethodStats, Profiler};
pub use rate_limiter::RateLimiter;
pub use rpc::handle_request;
pub use session::{DappConnection, DappOrigin, SessionManager};
pub use window_registry::{WindowInfo, WindowRegistry};
