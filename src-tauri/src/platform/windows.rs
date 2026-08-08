use crate::models::RootEntry;
use std::{
    io,
    os::windows::ffi::OsStrExt,
    path::{Component, Path, PathBuf, Prefix},
    process::Command,
    ptr,
};
use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
use windows_sys::Win32::System::WindowsProgramming::{DRIVE_FIXED, DRIVE_REMOVABLE};
use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};

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

pub fn launch_application(path: &Path, run_as_administrator: bool) -> io::Result<()> {
    let shell_path = shell_compatible_path(path);
    let operation: Vec<u16> = shell_operation(run_as_administrator)
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let file: Vec<u16> = shell_path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let directory: Vec<u16> = shell_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            ptr::null(),
            directory.as_ptr(),
            SW_SHOWNORMAL,
        )
    } as isize;
    if result > 32 {
        Ok(())
    } else {
        Err(io::Error::from_raw_os_error(result as i32))
    }
}

fn shell_operation(run_as_administrator: bool) -> &'static str {
    if run_as_administrator {
        "runas"
    } else {
        "open"
    }
}

fn shell_compatible_path(path: &Path) -> PathBuf {
    let mut components = path.components();
    let Some(Component::Prefix(prefix)) = components.next() else {
        return path.to_path_buf();
    };
    let mut normalized = match prefix.kind() {
        Prefix::VerbatimDisk(letter) => PathBuf::from(format!("{}:\\", letter as char)),
        Prefix::VerbatimUNC(server, share) => {
            let mut value = PathBuf::from(r"\\");
            value.push(server);
            value.push(share);
            value
        }
        _ => return path.to_path_buf(),
    };
    for component in components {
        if !matches!(component, Component::RootDir) {
            normalized.push(component.as_os_str());
        }
    }
    normalized
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

    #[test]
    fn removes_verbatim_prefix_before_shell_launch() {
        assert_eq!(
            shell_compatible_path(Path::new(r"\\?\D:\Program Files\Steam++\Steam++.exe")),
            PathBuf::from(r"D:\Program Files\Steam++\Steam++.exe")
        );
    }

    #[test]
    fn selects_shell_operation_from_elevation_preference() {
        assert_eq!(shell_operation(false), "open");
        assert_eq!(shell_operation(true), "runas");
    }
}
