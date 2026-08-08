use crate::models::RootEntry;
use std::{io, path::Path};

pub fn system_roots() -> Vec<RootEntry> {
    vec![RootEntry {
        name: "文件系统".into(),
        path: "/".into(),
        root_type: "fixed".into(),
    }]
}

pub fn shutdown_system() -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "system shutdown is not implemented on this platform",
    ))
}

pub fn launch_application(_path: &Path, _run_as_administrator: bool) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "external application launch is not implemented on this platform",
    ))
}
