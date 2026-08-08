use crate::models::RootEntry;
use sha2::{Digest, Sha256};
use std::{
    ffi::{OsStr, OsString},
    io,
    os::windows::{ffi::OsStrExt, process::CommandExt},
    path::{Component, Path, PathBuf, Prefix},
    process::{Command, Stdio},
    ptr,
};
use windows_sys::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
use windows_sys::Win32::System::Threading::{
    GetExitCodeProcess, WaitForSingleObject, CREATE_NO_WINDOW, INFINITE,
};
use windows_sys::Win32::System::WindowsProgramming::{DRIVE_FIXED, DRIVE_REMOVABLE};
use windows_sys::Win32::UI::{
    Shell::{ShellExecuteExW, ShellExecuteW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW},
    WindowsAndMessaging::{SW_HIDE, SW_SHOWNORMAL},
};

const ELEVATED_TASK_PREFIX: &str = "CouchAxis-Elevated-";

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
    if run_as_administrator {
        if !elevated_task_exists(path)? {
            configure_elevated_application(path)?;
        }
        return run_schtasks(&[
            OsString::from("/Run"),
            OsString::from("/TN"),
            OsString::from(elevated_task_name(path)),
        ]);
    }

    let shell_path = shell_compatible_path(path);
    let operation: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
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

pub fn configure_elevated_application(path: &Path) -> io::Result<()> {
    let shell_path = shell_compatible_path(path);
    let task_run = format!("\"{}\"", shell_path.to_string_lossy());
    if task_run.encode_utf16().count() > 262 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "application path is too long for Windows Task Scheduler",
        ));
    }
    let args = vec![
        OsString::from("/Create"),
        OsString::from("/TN"),
        OsString::from(elevated_task_name(&shell_path)),
        OsString::from("/TR"),
        OsString::from(task_run),
        OsString::from("/SC"),
        OsString::from("ONCE"),
        OsString::from("/ST"),
        OsString::from("00:00"),
        OsString::from("/RL"),
        OsString::from("HIGHEST"),
        OsString::from("/IT"),
        OsString::from("/F"),
    ];
    if run_schtasks(&args).is_ok() {
        return Ok(());
    }
    run_schtasks_elevated(&args)
}

pub fn remove_elevated_application(path: &Path) -> io::Result<()> {
    if !elevated_task_exists(path)? {
        return Ok(());
    }
    let args = vec![
        OsString::from("/Delete"),
        OsString::from("/TN"),
        OsString::from(elevated_task_name(path)),
        OsString::from("/F"),
    ];
    if run_schtasks(&args).is_ok() {
        return Ok(());
    }
    run_schtasks_elevated(&args)
}

fn elevated_task_exists(path: &Path) -> io::Result<bool> {
    let status = schtasks_command(&[
        OsString::from("/Query"),
        OsString::from("/TN"),
        OsString::from(elevated_task_name(path)),
    ])
    .status()?;
    Ok(status.success())
}

fn elevated_task_name(path: &Path) -> String {
    let normalized = shell_compatible_path(path).to_string_lossy().to_lowercase();
    let digest = Sha256::digest(normalized.as_bytes());
    let suffix: String = digest[..16]
        .iter()
        .map(|value| format!("{value:02x}"))
        .collect();
    format!("{ELEVATED_TASK_PREFIX}{suffix}")
}

fn run_schtasks(args: &[OsString]) -> io::Result<()> {
    let status = schtasks_command(args).status()?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other(format!(
            "Windows Task Scheduler exited with status {status}"
        )))
    }
}

fn schtasks_command(args: &[OsString]) -> Command {
    let mut command = Command::new("schtasks.exe");
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW);
    command
}

fn run_schtasks_elevated(args: &[OsString]) -> io::Result<()> {
    let operation = wide_null(OsStr::new("runas"));
    let executable = wide_null(OsStr::new("schtasks.exe"));
    let parameters = windows_command_line(args);
    let mut execute_info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS | windows_sys::Win32::UI::Shell::SEE_MASK_FLAG_NO_UI,
        lpVerb: operation.as_ptr(),
        lpFile: executable.as_ptr(),
        lpParameters: parameters.as_ptr(),
        nShow: SW_HIDE,
        ..Default::default()
    };
    if unsafe { ShellExecuteExW(&mut execute_info) } == 0 {
        return Err(io::Error::last_os_error());
    }
    if execute_info.hProcess.is_null() {
        return Err(io::Error::other(
            "Windows did not return a process handle for elevated task setup",
        ));
    }

    let result = (|| {
        if unsafe { WaitForSingleObject(execute_info.hProcess, INFINITE) } != WAIT_OBJECT_0 {
            return Err(io::Error::last_os_error());
        }
        let mut exit_code = 0_u32;
        if unsafe { GetExitCodeProcess(execute_info.hProcess, &mut exit_code) } == 0 {
            return Err(io::Error::last_os_error());
        }
        if exit_code == 0 {
            Ok(())
        } else {
            Err(io::Error::other(format!(
                "elevated Windows Task Scheduler exited with code {exit_code}"
            )))
        }
    })();
    unsafe { CloseHandle(execute_info.hProcess) };
    result
}

fn windows_command_line(args: &[OsString]) -> Vec<u16> {
    let mut command_line = Vec::new();
    for (index, argument) in args.iter().enumerate() {
        if index > 0 {
            command_line.push(b' ' as u16);
        }
        push_quoted_windows_argument(
            &mut command_line,
            &argument.encode_wide().collect::<Vec<_>>(),
        );
    }
    command_line.push(0);
    command_line
}

fn push_quoted_windows_argument(target: &mut Vec<u16>, argument: &[u16]) {
    target.push(b'"' as u16);
    let mut backslashes = 0;
    for &character in argument {
        if character == b'\\' as u16 {
            backslashes += 1;
        } else if character == b'"' as u16 {
            target.extend(std::iter::repeat_n(b'\\' as u16, backslashes * 2 + 1));
            target.push(character);
            backslashes = 0;
        } else {
            target.extend(std::iter::repeat_n(b'\\' as u16, backslashes));
            target.push(character);
            backslashes = 0;
        }
    }
    target.extend(std::iter::repeat_n(b'\\' as u16, backslashes * 2));
    target.push(b'"' as u16);
}

fn wide_null(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
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
    fn builds_stable_case_insensitive_elevated_task_names() {
        let first = elevated_task_name(Path::new(r"D:\Program Files\Player.exe"));
        let second = elevated_task_name(Path::new(r"d:\program files\PLAYER.EXE"));

        assert_eq!(first, second);
        assert!(first.starts_with(ELEVATED_TASK_PREFIX));
        assert_eq!(first.len(), ELEVATED_TASK_PREFIX.len() + 32);
    }

    #[test]
    fn quotes_task_scheduler_arguments_for_shell_execute() {
        let args = vec![
            OsString::from("/TR"),
            OsString::from(r#""D:\Program Files\Player.exe""#),
        ];
        let encoded = windows_command_line(&args);
        let decoded = String::from_utf16_lossy(&encoded[..encoded.len() - 1]);

        assert_eq!(decoded, r#""/TR" "\"D:\Program Files\Player.exe\"""#);
    }
}
