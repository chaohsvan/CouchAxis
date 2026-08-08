#[cfg(not(windows))]
mod unix;
#[cfg(windows)]
mod windows;

#[cfg(not(windows))]
pub use unix::{
    configure_elevated_application, launch_application, remove_elevated_application,
    shutdown_system, system_roots,
};
#[cfg(windows)]
pub use windows::{
    configure_elevated_application, launch_application, remove_elevated_application,
    shutdown_system, system_roots,
};
