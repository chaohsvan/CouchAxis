use crate::error::AppError;
use crate::models::AppPreferences;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct Preferences {
    last_path: Option<String>,
    #[serde(flatten)]
    app: AppPreferences,
}

static PREFERENCES_LOCK: Mutex<()> = Mutex::new(());

fn preferences_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_config_dir()
        .map(|path| path.join("preferences.json"))
        .map_err(|_| AppError::ConfigDirectoryUnavailable)
}

pub fn load_last_path(app: &AppHandle) -> Result<Option<String>, AppError> {
    let _guard = PREFERENCES_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let preferences = load_unlocked(app)?;
    Ok(preferences
        .last_path
        .filter(|value| PathBuf::from(value).is_dir()))
}

pub fn store_last_path(app: &AppHandle, last_path: String) -> Result<(), AppError> {
    let _guard = PREFERENCES_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut preferences = load_unlocked(app)?;
    preferences.last_path = Some(last_path);
    store_unlocked(app, &preferences)
}

pub fn load_app_preferences(app: &AppHandle) -> Result<AppPreferences, AppError> {
    let _guard = PREFERENCES_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut preferences = load_unlocked(app)?.app;
    if preferences.screenshot_directory.trim().is_empty() {
        let directory = default_screenshot_directory(app);
        let _ = fs::create_dir_all(&directory);
        preferences.screenshot_directory = directory.to_string_lossy().into_owned();
    }
    Ok(preferences)
}

pub fn default_screenshot_directory(app: &AppHandle) -> PathBuf {
    app.path()
        .picture_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("CouchAxis Screenshots")
}

pub fn store_app_preferences(
    app: &AppHandle,
    app_preferences: AppPreferences,
) -> Result<(), AppError> {
    let _guard = PREFERENCES_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut preferences = load_unlocked(app)?;
    preferences.app = app_preferences;
    store_unlocked(app, &preferences)
}

fn load_unlocked(app: &AppHandle) -> Result<Preferences, AppError> {
    let path = preferences_path(app)?;
    if !path.exists() {
        return Ok(Preferences::default());
    }
    let contents = fs::read_to_string(&path).map_err(|source| AppError::io(&path, source))?;
    serde_json::from_str(&contents).map_err(Into::into)
}

fn store_unlocked(app: &AppHandle, preferences: &Preferences) -> Result<(), AppError> {
    let path = preferences_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| AppError::io(parent, source))?;
    }
    let contents = serde_json::to_string_pretty(preferences)?;
    fs::write(&path, contents).map_err(|source| AppError::io(&path, source))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upgrades_legacy_last_path_preferences_with_defaults() {
        let preferences: Preferences =
            serde_json::from_str(r#"{"lastPath":"D:\\Movies"}"#).expect("legacy preferences");

        assert_eq!(preferences.last_path.as_deref(), Some("D:\\Movies"));
        assert_eq!(preferences.app, AppPreferences::default());
        assert_eq!(
            preferences.app.browser_view_mode,
            crate::models::BrowserViewMode::List
        );
        assert!(preferences.app.application_shortcuts.is_empty());
        assert!(preferences.app.recent_video_progress.is_empty());
    }
}
