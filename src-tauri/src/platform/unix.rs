use crate::models::RootEntry;

pub fn system_roots() -> Vec<RootEntry> {
    vec![RootEntry {
        name: "文件系统".into(),
        path: "/".into(),
        root_type: "fixed".into(),
    }]
}
