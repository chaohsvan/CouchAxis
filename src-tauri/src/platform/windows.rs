use crate::models::RootEntry;
use std::{io, path::Path, process::Command};
use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
use windows_sys::Win32::System::WindowsProgramming::{DRIVE_FIXED, DRIVE_REMOVABLE};

pub fn system_roots() -> Vec<RootEntry> {
    let drive_mask = unsafe { GetLogicalDrives() };
    (b'A'..=b'Z')
        .filter_map(|letter| {
            let bit = 1_u32 << (letter - b'A');
            if drive_mask & bit == 0 {
                return None;
            }
            let path = format!("{}:\\", letter as char);
            let mut wide: Vec<u16> = path.encode_utf16().collect();
            wide.push(0);
            let drive_type = unsafe { GetDriveTypeW(wide.as_ptr()) };
            if drive_type != DRIVE_FIXED && drive_type != DRIVE_REMOVABLE {
                return None;
            }

            Some(RootEntry {
                name: format!("本地磁盘 ({})", letter as char),
                path,
                root_type: if drive_type == DRIVE_REMOVABLE {
                    "removable".into()
                } else {
                    "fixed".into()
                },
            })
        })
        .collect()
}

fn shutdown_command() -> Command {
    let mut command = Command::new("shutdown.exe");
    command.args(["/s", "/t", "0"]);
    command
}

pub fn shutdown_system() -> io::Result<()> {
    let status = shutdown_command().status()?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::new(
            io::ErrorKind::Other,
            format!("shutdown.exe exited with status {status}"),
        ))
    }
}

pub fn launch_application(path: &Path) -> io::Result<()> {
    Command::new(path).spawn().map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    #[test]
    fn shutdown_command_requests_a_normal_immediate_shutdown() {
        let command = shutdown_command();
        assert_eq!(command.get_program(), OsStr::new("shutdown.exe"));
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            vec![OsStr::new("/s"), OsStr::new("/t"), OsStr::new("0")]
        );
    }
}
