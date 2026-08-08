#[cfg(not(windows))]
mod unix;
#[cfg(windows)]
mod windows;

#[cfg(not(windows))]
pub use unix::{launch_application, shutdown_system, system_roots};
#[cfg(windows)]
pub use windows::{launch_application, shutdown_system, system_roots};
