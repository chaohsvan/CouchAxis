use serde::Serialize;
use std::{io, path::Path};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("无法访问 {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: io::Error,
    },
    #[error("路径不是目录: {0}")]
    NotDirectory(String),
    #[error("无法确定应用配置目录")]
    ConfigDirectoryUnavailable,
    #[error("配置文件格式无效: {0}")]
    InvalidPreferences(#[from] serde_json::Error),
}

impl AppError {
    pub fn io(path: &Path, source: io::Error) -> Self {
        Self::Io {
            path: path.to_string_lossy().into_owned(),
            source,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl From<AppError> for CommandError {
    fn from(value: AppError) -> Self {
        let code = match &value {
            AppError::Io { .. } => "io_error",
            AppError::NotDirectory(_) => "not_directory",
            AppError::ConfigDirectoryUnavailable => "config_directory_unavailable",
            AppError::InvalidPreferences(_) => "invalid_preferences",
        };
        Self {
            code,
            message: value.to_string(),
        }
    }
}
