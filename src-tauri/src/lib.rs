mod commands;
mod error;
mod filesystem;
mod models;
mod platform;
mod preferences;

use commands::{
    find_matching_subtitle, get_last_path, get_preferences, list_audio_queue, list_directory,
    list_roots, list_subtitle_directory, read_audio_metadata, read_subtitle, save_last_path,
    save_preferences, save_screenshot,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_roots,
            list_directory,
            list_audio_queue,
            read_audio_metadata,
            list_subtitle_directory,
            get_last_path,
            get_preferences,
            save_last_path,
            save_preferences,
            read_subtitle,
            find_matching_subtitle,
            save_screenshot
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CouchAxis");
}
