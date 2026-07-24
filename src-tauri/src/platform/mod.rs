#[cfg(not(windows))]
mod unix;
#[cfg(windows)]
mod windows;

#[cfg(not(windows))]
pub use unix::system_roots;
#[cfg(windows)]
pub use windows::system_roots;
