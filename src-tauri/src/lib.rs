mod commands;
mod error;
mod filesystem;
mod models;
mod platform;
mod preferences;

use commands::{
    configure_elevated_application, exit_application, find_matching_subtitle, get_last_path,
    get_preferences, launch_application, list_application_directory, list_audio_queue,
    list_directory, list_roots, list_subtitle_directory, read_audio_metadata, read_subtitle,
    remove_elevated_application, save_last_path, save_preferences, save_screenshot,
    shutdown_system,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            exit_application,
            shutdown_system,
            list_roots,
            list_application_directory,
            configure_elevated_application,
            remove_elevated_application,
            launch_application,
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
