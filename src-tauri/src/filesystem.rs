use crate::{
    error::AppError,
    models::{
        ApplicationDirectoryListing, ApplicationEntry, ApplicationEntryKind, DirectoryListing,
        EntryKind, FileEntry, SubtitleDirectoryListing, SubtitleEntry, SubtitleEntryKind,
    },
};
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;
#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_HIDDEN;

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "flv", "wmv", "m4v", "webm", "mpeg", "mpg", "mpv", "ts", "m2ts",
];
const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "aac", "m4a", "ogg", "opus", "wma", "aiff", "aif", "alac",
];
const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "tif", "tiff",
];

fn has_extension(path: &Path, extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| extensions.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn is_video_path(path: &Path) -> bool {
    has_extension(path, VIDEO_EXTENSIONS)
}

pub fn is_audio_path(path: &Path) -> bool {
    has_extension(path, AUDIO_EXTENSIONS)
}

pub fn is_image_path(path: &Path) -> bool {
    has_extension(path, IMAGE_EXTENSIONS)
}

pub fn is_subtitle_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| matches!(value.to_ascii_lowercase().as_str(), "srt" | "ass" | "ssa"))
        .unwrap_or(false)
}

pub fn is_executable_path(path: &Path) -> bool {
    has_extension(path, &["exe"])
}

pub fn matching_subtitle_path(video_path: &Path) -> Result<Option<PathBuf>, AppError> {
    let Some(directory) = video_path.parent() else {
        return Ok(None);
    };
    let Some(video_stem) = video_path.file_stem().and_then(|value| value.to_str()) else {
        return Ok(None);
    };
    let read_dir = fs::read_dir(directory).map_err(|source| AppError::io(directory, source))?;
    let mut matches: Vec<PathBuf> = read_dir
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && is_subtitle_path(path))
        .filter(|path| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .is_some_and(|stem| stem.eq_ignore_ascii_case(video_stem))
        })
        .collect();
    matches.sort_by_key(
        |path| match path.extension().and_then(|value| value.to_str()) {
            Some(value) if value.eq_ignore_ascii_case("srt") => 0,
            Some(value) if value.eq_ignore_ascii_case("ass") => 1,
            _ => 2,
        },
    );
    Ok(matches.into_iter().next())
}

fn is_hidden(name: &str, metadata: &fs::Metadata) -> bool {
    if name.starts_with('.') {
        return true;
    }
    #[cfg(windows)]
    {
        return metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0;
    }
    #[cfg(not(windows))]
    false
}

pub fn read_directory(path: &Path, show_hidden_files: bool) -> Result<DirectoryListing, AppError> {
    if !path.is_dir() {
        return Err(AppError::NotDirectory(path.to_string_lossy().into_owned()));
    }

    let read_dir = fs::read_dir(path).map_err(|source| AppError::io(path, source))?;
    let mut entries = Vec::new();

    for item in read_dir.flatten() {
        let item_path = item.path();
        let metadata = match item.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let name = item.file_name().to_string_lossy().into_owned();
        if !show_hidden_files && is_hidden(&name, &metadata) {
            continue;
        }
        let kind = if metadata.is_dir() {
            EntryKind::Folder
        } else if metadata.is_file() {
            if is_video_path(&item_path) {
                EntryKind::Video
            } else if is_audio_path(&item_path) {
                EntryKind::Audio
            } else if is_image_path(&item_path) {
                EntryKind::Image
            } else {
                continue;
            }
        } else {
            continue;
        };
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs());
        entries.push(FileEntry {
            name,
            path: item_path.to_string_lossy().into_owned(),
            size: (!matches!(&kind, EntryKind::Folder)).then_some(metadata.len()),
            modified_at,
            extension: item_path
                .extension()
                .and_then(|value| value.to_str())
                .map(str::to_ascii_uppercase),
            kind,
        });
    }

    entries.sort_by(|left, right| {
        let kind_order = match (&left.kind, &right.kind) {
            (EntryKind::Folder, EntryKind::Folder) => std::cmp::Ordering::Equal,
            (EntryKind::Folder, _) => std::cmp::Ordering::Less,
            (_, EntryKind::Folder) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        };
        kind_order.then_with(|| {
            left.name
                .to_ascii_lowercase()
                .cmp(&right.name.to_ascii_lowercase())
        })
    });

    Ok(DirectoryListing {
        path: path.to_string_lossy().into_owned(),
        parent: path
            .parent()
            .map(|value| value.to_string_lossy().into_owned()),
        entries,
    })
}

pub fn read_application_directory(
    path: &Path,
    show_hidden_files: bool,
) -> Result<ApplicationDirectoryListing, AppError> {
    if !path.is_dir() {
        return Err(AppError::NotDirectory(path.to_string_lossy().into_owned()));
    }

    let read_dir = fs::read_dir(path).map_err(|source| AppError::io(path, source))?;
    let mut entries = Vec::new();
    for item in read_dir.flatten() {
        let item_path = item.path();
        let metadata = match item.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let name = item.file_name().to_string_lossy().into_owned();
        if !show_hidden_files && is_hidden(&name, &metadata) {
            continue;
        }
        let file_type = match item.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        let kind = if file_type.is_dir() {
            ApplicationEntryKind::Folder
        } else if file_type.is_file() && is_executable_path(&item_path) {
            ApplicationEntryKind::Application
        } else {
            continue;
        };
        entries.push(ApplicationEntry {
            name,
            path: item_path.to_string_lossy().into_owned(),
            kind,
        });
    }
    entries.sort_by(|left, right| {
        let kind_order = match (&left.kind, &right.kind) {
            (ApplicationEntryKind::Folder, ApplicationEntryKind::Application) => {
                std::cmp::Ordering::Less
            }
            (ApplicationEntryKind::Application, ApplicationEntryKind::Folder) => {
                std::cmp::Ordering::Greater
            }
            _ => std::cmp::Ordering::Equal,
        };
        kind_order.then_with(|| {
            left.name
                .to_ascii_lowercase()
                .cmp(&right.name.to_ascii_lowercase())
        })
    });

    Ok(ApplicationDirectoryListing {
        path: path.to_string_lossy().into_owned(),
        parent: path
            .parent()
            .map(|value| value.to_string_lossy().into_owned()),
        entries,
    })
}

pub fn read_audio_queue(root: &Path, show_hidden_files: bool) -> Result<Vec<FileEntry>, AppError> {
    if !root.is_dir() {
        return Err(AppError::NotDirectory(root.to_string_lossy().into_owned()));
    }

    let mut pending: Vec<PathBuf> = vec![root.to_path_buf()];
    let mut tracks = Vec::new();

    while let Some(directory) = pending.pop() {
        let read_dir = match fs::read_dir(&directory) {
            Ok(read_dir) => read_dir,
            Err(source) if directory == root => return Err(AppError::io(&directory, source)),
            Err(_) => continue,
        };

        for item in read_dir.flatten() {
            let item_path = item.path();
            let metadata = match item.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            let name = item.file_name().to_string_lossy().into_owned();
            if !show_hidden_files && is_hidden(&name, &metadata) {
                continue;
            }
            let file_type = match item.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                pending.push(item_path);
                continue;
            }
            if !file_type.is_file() || !is_audio_path(&item_path) {
                continue;
            }
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs());
            tracks.push(FileEntry {
                name,
                path: item_path.to_string_lossy().into_owned(),
                kind: EntryKind::Audio,
                size: Some(metadata.len()),
                modified_at,
                extension: item_path
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(str::to_ascii_uppercase),
            });
        }
    }

    tracks.sort_by(|left, right| {
        left.path
            .to_ascii_lowercase()
            .cmp(&right.path.to_ascii_lowercase())
    });
    Ok(tracks)
}

pub fn read_subtitle_directory(
    path: &Path,
    show_hidden_files: bool,
) -> Result<SubtitleDirectoryListing, AppError> {
    if !path.is_dir() {
        return Err(AppError::NotDirectory(path.to_string_lossy().into_owned()));
    }

    let read_dir = fs::read_dir(path).map_err(|source| AppError::io(path, source))?;
    let mut entries = Vec::new();

    for item in read_dir.flatten() {
        let item_path = item.path();
        let metadata = match item.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let name = item.file_name().to_string_lossy().into_owned();
        if !show_hidden_files && is_hidden(&name, &metadata) {
            continue;
        }
        let file_type = match item.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        let kind = if file_type.is_dir() {
            SubtitleEntryKind::Folder
        } else if file_type.is_file() && is_subtitle_path(&item_path) {
            SubtitleEntryKind::Subtitle
        } else {
            continue;
        };
        entries.push(SubtitleEntry {
            name,
            path: item_path.to_string_lossy().into_owned(),
            extension: item_path
                .extension()
                .and_then(|value| value.to_str())
                .map(str::to_ascii_uppercase),
            kind,
        });
    }

    entries.sort_by(|left, right| {
        let kind_order = match (&left.kind, &right.kind) {
            (SubtitleEntryKind::Folder, SubtitleEntryKind::Subtitle) => std::cmp::Ordering::Less,
            (SubtitleEntryKind::Subtitle, SubtitleEntryKind::Folder) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        };
        kind_order.then_with(|| {
            left.name
                .to_ascii_lowercase()
                .cmp(&right.name.to_ascii_lowercase())
        })
    });

    Ok(SubtitleDirectoryListing {
        path: path.to_string_lossy().into_owned(),
        parent: path
            .parent()
            .map(|value| value.to_string_lossy().into_owned()),
        entries,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        is_audio_path, is_executable_path, is_image_path, is_subtitle_path, is_video_path,
        matching_subtitle_path, read_application_directory, read_audio_queue,
    };
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    struct TestDirectory(PathBuf);

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn recognizes_video_extensions_case_insensitively() {
        assert!(is_video_path(Path::new("movie.MKV")));
        assert!(is_video_path(Path::new("clip.mp4")));
        assert!(is_video_path(Path::new("mpeg-video.MPV")));
        assert!(!is_video_path(Path::new("subtitle.srt")));
        assert!(!is_video_path(Path::new("README")));
    }

    #[test]
    fn recognizes_supported_subtitle_extensions() {
        assert!(is_subtitle_path(Path::new("movie.SRT")));
        assert!(is_subtitle_path(Path::new("movie.ass")));
        assert!(is_subtitle_path(Path::new("movie.ssa")));
        assert!(!is_subtitle_path(Path::new("movie.vtt")));
        assert!(!is_subtitle_path(Path::new("movie.mkv")));
    }

    #[test]
    fn recognizes_audio_and_image_extensions() {
        assert!(is_audio_path(Path::new("album.FLAC")));
        assert!(is_audio_path(Path::new("song.mp3")));
        assert!(!is_audio_path(Path::new("cover.jpg")));
        assert!(is_image_path(Path::new("cover.JPG")));
        assert!(is_image_path(Path::new("frame.webp")));
        assert!(!is_image_path(Path::new("movie.mkv")));
    }

    #[test]
    fn recognizes_only_windows_executables_for_application_bindings() {
        assert!(is_executable_path(Path::new("CouchAxis.EXE")));
        assert!(!is_executable_path(Path::new("script.bat")));
        assert!(!is_executable_path(Path::new("shortcut.lnk")));
    }

    #[test]
    fn lists_folders_and_executables_for_application_picker() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "couchaxis-application-picker-{}-{unique}",
            std::process::id()
        ));
        let test_directory = TestDirectory(root.clone());
        fs::create_dir_all(root.join("Tools")).expect("create test directory");
        fs::write(root.join("Player.exe"), []).expect("write executable");
        fs::write(root.join("notes.txt"), []).expect("write ignored file");

        let listing = read_application_directory(&test_directory.0, false)
            .expect("read application directory");
        let names: Vec<&str> = listing
            .entries
            .iter()
            .map(|entry| entry.name.as_str())
            .collect();
        assert_eq!(names, vec!["Tools", "Player.exe"]);
    }

    #[test]
    fn finds_only_an_exact_same_stem_subtitle() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "couchaxis-subtitle-match-{}-{unique}",
            std::process::id()
        ));
        let test_directory = TestDirectory(root.clone());
        fs::create_dir_all(&root).expect("create test directory");
        let video = root.join("Movie.mkv");
        fs::write(&video, []).expect("write video");
        fs::write(root.join("Movie.zh-CN.srt"), []).expect("write language subtitle");
        fs::write(root.join("Movie.ASS"), []).expect("write exact subtitle");

        let matched = matching_subtitle_path(&video)
            .expect("find subtitle")
            .expect("matching subtitle");
        assert_eq!(
            matched.file_name().and_then(|value| value.to_str()),
            Some("Movie.ASS")
        );

        drop(test_directory);
    }

    #[test]
    fn builds_audio_queue_from_nested_directories() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "couchaxis-audio-queue-{}-{unique}",
            std::process::id()
        ));
        let test_directory = TestDirectory(root.clone());
        let nested = root.join("Album");
        fs::create_dir_all(&nested).expect("create test directories");
        fs::write(root.join("song.mp3"), []).expect("write root audio");
        fs::write(nested.join("track.FLAC"), []).expect("write nested audio");
        fs::write(nested.join("cover.jpg"), []).expect("write ignored image");

        fs::write(nested.join(".hidden.mp3"), []).expect("write hidden audio");

        let queue = read_audio_queue(&test_directory.0, false).expect("read audio queue");
        let names: Vec<&str> = queue.iter().map(|entry| entry.name.as_str()).collect();
        assert_eq!(names, vec!["track.FLAC", "song.mp3"]);

        let queue_with_hidden =
            read_audio_queue(&test_directory.0, true).expect("read audio queue with hidden");
        assert!(queue_with_hidden
            .iter()
            .any(|entry| entry.name == ".hidden.mp3"));
    }
}
