use crate::models::RootEntry;
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
