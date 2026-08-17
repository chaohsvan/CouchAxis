use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EntryKind {
    Folder,
    Video,
    Audio,
    Image,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootEntry {
    pub name: String,
    pub path: String,
    pub root_type: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StartupView {
    LastPath,
    Drives,
    Favorites,
}

impl Default for StartupView {
    fn default() -> Self {
        Self::LastPath
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub enum AppLanguage {
    #[serde(rename = "zh-CN")]
    Chinese,
    #[serde(rename = "en-US")]
    English,
}

impl Default for AppLanguage {
    fn default() -> Self {
        Self::Chinese
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteFolder {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationShortcut {
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub run_as_administrator: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentVideoProgress {
    pub path: String,
    pub position_seconds: u64,
    pub duration_seconds: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MangaStartSide {
    Left,
    Right,
}

impl Default for MangaStartSide {
    fn default() -> Self {
        Self::Left
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SubtitleFontSize {
    Small,
    Medium,
    Large,
}

impl Default for SubtitleFontSize {
    fn default() -> Self {
        Self::Medium
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserViewMode {
    List,
    Grid,
}

impl Default for BrowserViewMode {
    fn default() -> Self {
        Self::List
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct AppPreferences {
    pub startup_view: StartupView,
    pub language: AppLanguage,
    pub show_hidden_files: bool,
    pub favorite_folders: Vec<FavoriteFolder>,
    pub application_shortcuts: Vec<ApplicationShortcut>,
    pub recent_video_progress: Vec<RecentVideoProgress>,
    pub screenshot_directory: String,
    pub manga_start_side: MangaStartSide,
    pub subtitle_font_size: SubtitleFontSize,
    pub browser_view_mode: BrowserViewMode,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub lyrics: Option<String>,
    pub cover_art: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleFile {
    pub path: String,
    pub file_name: String,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SubtitleEntryKind {
    Folder,
    Subtitle,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleEntry {
    pub name: String,
    pub path: String,
    pub kind: SubtitleEntryKind,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleDirectoryListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<SubtitleEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApplicationEntryKind {
    Folder,
    Application,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationEntry {
    pub name: String,
    pub path: String,
    pub kind: ApplicationEntryKind,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationDirectoryListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<ApplicationEntry>,
}
