mod cli;
mod commands;
mod error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::vectorize::vectorize_image,
            commands::vectorize::vectorize_image_multi,
            commands::vectorize::read_image_file,
            commands::export::save_dialog_and_write,
            commands::export::save_bundle_to_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
