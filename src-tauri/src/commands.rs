use crate::{
    error::CommandError,
    filesystem,
    models::{
        AppPreferences, ApplicationDirectoryListing, AudioMetadata, DirectoryListing, FileEntry,
        RootEntry, SubtitleDirectoryListing, SubtitleFile,
    },
    platform, preferences,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use lofty::{
    config::ParseOptions,
    file::AudioFile,
    id3::v2::{Frame, SyncTextContentType, SynchronizedTextFrame, TimestampFormat},
    mpeg::MpegFile,
    picture::{Picture, PictureType},
    prelude::{Accessor, ItemKey, TaggedFileExt},
    read_from_path,
};
use std::{
    fs::File,
    path::{Path, PathBuf},
};
use tauri::AppHandle;

const MAX_SUBTITLE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_COVER_ART_BYTES: usize = 16 * 1024 * 1024;
const PNG_SIGNATURE: &[u8] = &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];

#[tauri::command]
pub fn exit_application(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub async fn shutdown_system() -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(platform::shutdown_system)
        .await
        .map_err(task_error)?
        .map_err(|source| CommandError {
            code: "shutdown_failed",
            message: format!("无法关闭系统: {source}"),
        })
}

#[tauri::command]
pub fn list_roots() -> Vec<RootEntry> {
    platform::system_roots()
}

#[tauri::command]
pub async fn list_application_directory(
    path: String,
    show_hidden_files: bool,
) -> Result<ApplicationDirectoryListing, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        filesystem::read_application_directory(Path::new(&path), show_hidden_files)
            .map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn launch_application(
    path: String,
    run_as_administrator: bool,
) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        let canonical = canonical_application_path(path)?;
        platform::launch_application(&canonical, run_as_administrator)
            .map_err(|source| application_operation_error(&canonical, source, "launch_application"))
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn configure_elevated_application(path: String) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        let canonical = canonical_application_path(path)?;
        platform::configure_elevated_application(&canonical).map_err(|source| {
            application_operation_error(&canonical, source, "configure_elevated_application")
        })
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn remove_elevated_application(path: String) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        let requested = executable_path(path)?;
        let task_path = std::fs::canonicalize(&requested).unwrap_or(requested);
        platform::remove_elevated_application(&task_path).map_err(|source| {
            application_operation_error(&task_path, source, "remove_elevated_application")
        })
    })
    .await
    .map_err(task_error)?
}

fn canonical_application_path(path: String) -> Result<PathBuf, CommandError> {
    let requested = executable_path(path)?;
    let canonical = std::fs::canonicalize(&requested)
        .map_err(|source| crate::error::AppError::io(&requested, source))?;
    if !canonical.is_file() {
        return Err(CommandError {
            code: "application_not_found",
            message: "应用程序文件不存在".into(),
        });
    }
    Ok(canonical)
}

fn executable_path(path: String) -> Result<PathBuf, CommandError> {
    let requested = PathBuf::from(path);
    if !filesystem::is_executable_path(&requested) {
        return Err(CommandError {
            code: "unsupported_application",
            message: "只能绑定 Windows .exe 应用程序".into(),
        });
    }
    Ok(requested)
}

fn application_operation_error(
    path: &Path,
    source: std::io::Error,
    fallback_code: &'static str,
) -> CommandError {
    let cancelled = matches!(source.raw_os_error(), Some(5 | 1223));
    CommandError {
        code: if cancelled {
            "elevation_cancelled"
        } else {
            fallback_code
        },
        message: if cancelled {
            "已取消 Windows 管理员授权".into()
        } else {
            crate::error::AppError::io(path, source).to_string()
        },
    }
}

#[tauri::command]
pub async fn list_directory(
    path: String,
    show_hidden_files: bool,
) -> Result<DirectoryListing, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        filesystem::read_directory(Path::new(&path), show_hidden_files).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn list_audio_queue(
    path: String,
    show_hidden_files: bool,
) -> Result<Vec<FileEntry>, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        filesystem::read_audio_queue(Path::new(&path), show_hidden_files).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn read_audio_metadata(path: String) -> Result<AudioMetadata, CommandError> {
    tauri::async_runtime::spawn_blocking(move || read_audio_metadata_file(path))
        .await
        .map_err(task_error)?
}

fn read_audio_metadata_file(path: String) -> Result<AudioMetadata, CommandError> {
    let path = Path::new(&path);
    if !filesystem::is_audio_path(path) {
        return Err(CommandError {
            code: "unsupported_audio",
            message: "不支持此音频文件格式".into(),
        });
    }

    let Ok(tagged_file) = read_from_path(path) else {
        return Ok(AudioMetadata::default());
    };
    let mut metadata = AudioMetadata::default();

    for tag in tagged_file.tags() {
        if metadata.title.is_none() {
            metadata.title = tag.title().map(|value| value.into_owned());
        }
        if metadata.artist.is_none() {
            metadata.artist = tag.artist().map(|value| value.into_owned());
        }
        if metadata.album.is_none() {
            metadata.album = tag.album().map(|value| value.into_owned());
        }
        if metadata.lyrics.is_none() {
            metadata.lyrics = tag
                .get_string(ItemKey::Lyrics)
                .or_else(|| tag.get_string(ItemKey::UnsyncLyrics))
                .filter(|value| !value.trim().is_empty())
                .map(str::to_owned);
        }
        if metadata.cover_art.is_none() {
            metadata.cover_art = tag
                .get_picture_type(PictureType::CoverFront)
                .and_then(picture_data_url);
        }
    }
    if metadata.lyrics.is_none() {
        metadata.lyrics = read_special_id3_lyrics(path);
    }

    Ok(metadata)
}

fn picture_data_url(picture: &Picture) -> Option<String> {
    let data = picture.data();
    if data.is_empty() || data.len() > MAX_COVER_ART_BYTES {
        return None;
    }
    let mime_type = picture.mime_type()?.as_str();
    if !mime_type.starts_with("image/") {
        return None;
    }
    Some(format!("data:{mime_type};base64,{}", STANDARD.encode(data)))
}

fn read_special_id3_lyrics(path: &Path) -> Option<String> {
    if !path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("mp3"))
    {
        return None;
    }

    let mut source = File::open(path).ok()?;
    let mpeg = MpegFile::read_from(&mut source, ParseOptions::new()).ok()?;
    let tag = mpeg.id3v2()?;

    for frame in tag {
        if let Frame::Binary(binary) = frame {
            if binary.id().as_str() != "SYLT" {
                continue;
            }
            let Ok(synchronized) =
                SynchronizedTextFrame::parse(binary.data.as_ref(), binary.flags())
            else {
                continue;
            };
            if !matches!(
                synchronized.content_type,
                SyncTextContentType::Lyrics | SyncTextContentType::TextTranscription
            ) {
                continue;
            }
            let lines: Vec<String> = synchronized
                .content
                .iter()
                .filter(|(_, text)| !text.trim().is_empty())
                .map(|(timestamp, text)| match synchronized.timestamp_format {
                    TimestampFormat::MS => format!(
                        "[{:02}:{:02}.{:03}]{}",
                        timestamp / 60_000,
                        (timestamp % 60_000) / 1_000,
                        timestamp % 1_000,
                        text.trim()
                    ),
                    TimestampFormat::MPEG => text.trim().to_owned(),
                })
                .collect();
            if !lines.is_empty() {
                return Some(lines.join("\n"));
            }
        }
    }

    tag.into_iter().find_map(|frame| {
        let Frame::UserText(text) = frame else {
            return None;
        };
        let description = text
            .description
            .to_ascii_uppercase()
            .replace([' ', '_'], "");
        matches!(
            description.as_str(),
            "LYRICS" | "UNSYNCEDLYRICS" | "SYNCEDLYRICS"
        )
        .then(|| text.content.trim().to_owned())
        .filter(|value| !value.is_empty())
    })
}

#[tauri::command]
pub async fn list_subtitle_directory(
    path: String,
    show_hidden_files: bool,
) -> Result<SubtitleDirectoryListing, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        filesystem::read_subtitle_directory(Path::new(&path), show_hidden_files).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn get_last_path(app: AppHandle) -> Result<Option<String>, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        preferences::load_last_path(&app).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn save_last_path(app: AppHandle, path: String) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        preferences::store_last_path(&app, path).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> Result<AppPreferences, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        preferences::load_app_preferences(&app).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn save_preferences(
    app: AppHandle,
    preferences: AppPreferences,
) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        preferences::store_app_preferences(&app, preferences).map_err(Into::into)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn read_subtitle(path: String) -> Result<SubtitleFile, CommandError> {
    tauri::async_runtime::spawn_blocking(move || read_subtitle_file(path))
        .await
        .map_err(task_error)?
}

#[tauri::command]
pub async fn find_matching_subtitle(
    video_path: String,
) -> Result<Option<SubtitleFile>, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = filesystem::matching_subtitle_path(Path::new(&video_path))? else {
            return Ok(None);
        };
        read_subtitle_file(path.to_string_lossy().into_owned()).map(Some)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn save_screenshot(
    app: AppHandle,
    directory: String,
    file_name: String,
    png_data: Vec<u8>,
) -> Result<String, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        save_screenshot_file(&app, directory, file_name, png_data)
    })
    .await
    .map_err(task_error)?
}

fn save_screenshot_file(
    app: &AppHandle,
    directory: String,
    file_name: String,
    png_data: Vec<u8>,
) -> Result<String, CommandError> {
    let directory = if directory.trim().is_empty() {
        preferences::default_screenshot_directory(app)
    } else {
        PathBuf::from(directory)
    };
    write_screenshot(&directory, &file_name, &png_data)
        .map(|target| target.to_string_lossy().into_owned())
}

fn write_screenshot(
    directory: &Path,
    file_name: &str,
    png_data: &[u8],
) -> Result<PathBuf, CommandError> {
    if !png_data.starts_with(PNG_SIGNATURE) {
        return Err(CommandError {
            code: "invalid_screenshot",
            message: "截图数据不是有效的 PNG 图片".into(),
        });
    }
    std::fs::create_dir_all(directory)
        .map_err(|source| crate::error::AppError::io(directory, source))?;
    let safe_name: String = file_name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            value if value.is_control() => '_',
            value => value,
        })
        .collect();
    let safe_name = if safe_name.to_ascii_lowercase().ends_with(".png") {
        safe_name
    } else {
        format!("{safe_name}.png")
    };
    let stem = safe_name.strip_suffix(".png").unwrap_or(&safe_name);
    let mut target = directory.join(&safe_name);
    let mut duplicate = 2;
    while target.exists() {
        target = directory.join(format!("{stem}_{duplicate}.png"));
        duplicate += 1;
    }
    std::fs::write(&target, png_data)
        .map_err(|source| crate::error::AppError::io(&target, source))?;
    Ok(target)
}

fn read_subtitle_file(path: String) -> Result<SubtitleFile, CommandError> {
    let path = Path::new(&path);
    if !filesystem::is_subtitle_path(path) {
        return Err(CommandError {
            code: "unsupported_subtitle",
            message: "仅支持 SRT、ASS 和 SSA 字幕".into(),
        });
    }
    let metadata =
        std::fs::metadata(path).map_err(|source| crate::error::AppError::io(path, source))?;
    if metadata.len() > MAX_SUBTITLE_BYTES {
        return Err(CommandError {
            code: "subtitle_too_large",
            message: "字幕文件超过 10 MB".into(),
        });
    }
    let bytes = std::fs::read(path).map_err(|source| crate::error::AppError::io(path, source))?;
    let contents = decode_text(&bytes);
    Ok(SubtitleFile {
        file_name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| "字幕".into()),
        contents,
    })
}

fn decode_text(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xff, 0xfe]) {
        let values: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        return String::from_utf16_lossy(&values);
    }
    if bytes.starts_with(&[0xfe, 0xff]) {
        let values: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect();
        return String::from_utf16_lossy(&values);
    }
    let without_bom = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes);
    String::from_utf8_lossy(without_bom).into_owned()
}

fn task_error(error: impl std::fmt::Display) -> CommandError {
    CommandError {
        code: "background_task_failed",
        message: format!("后台任务失败: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lofty::picture::MimeType;

    #[test]
    fn encodes_embedded_picture_as_data_url() {
        let picture = Picture::unchecked(vec![1, 2, 3, 4])
            .mime_type(MimeType::Png)
            .build();

        assert_eq!(
            picture_data_url(&picture).as_deref(),
            Some("data:image/png;base64,AQIDBA==")
        );
    }

    #[test]
    fn writes_png_with_a_sanitized_file_name() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "couchaxis-screenshot-{}-{unique}",
            std::process::id()
        ));
        let target = write_screenshot(&directory, "Movie: 01?.png", PNG_SIGNATURE)
            .expect("write screenshot");

        assert_eq!(
            target.file_name().and_then(|value| value.to_str()),
            Some("Movie_ 01_.png")
        );
        assert_eq!(
            std::fs::read(&target).expect("read screenshot"),
            PNG_SIGNATURE
        );
        std::fs::remove_dir_all(directory).expect("remove screenshot directory");
    }

    #[test]
    fn reports_uac_cancellation_as_an_expected_operation_result() {
        for error_code in [5, 1223] {
            let error = application_operation_error(
                Path::new(r"C:\Tools\Player.exe"),
                std::io::Error::from_raw_os_error(error_code),
                "configure_elevated_application",
            );

            assert_eq!(error.code, "elevation_cancelled");
            assert_eq!(error.message, "已取消 Windows 管理员授权");
        }
    }

    #[test]
    fn accepts_missing_executable_path_for_elevated_task_cleanup() {
        let path = executable_path(r"C:\Tools\Removed Player.exe".into()).unwrap();

        assert_eq!(path, PathBuf::from(r"C:\Tools\Removed Player.exe"));
    }
}
