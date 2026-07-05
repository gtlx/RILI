pub mod commands;

use rili_core::App;
use std::sync::Mutex;

pub struct AppState {
    pub core: Mutex<App>,
}

pub fn with_db<T>(
    state: &AppState,
    f: impl FnOnce(&rili_core::database::Database) -> Result<T, rili_core::utils::Error>,
) -> Result<T, String> {
    let app = state.core.lock().map_err(|e| e.to_string())?;
    f(&app.db).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("rili-app");

    let app = App::init(&data_dir).expect("Failed to init RILI core");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            core: Mutex::new(app),
        })
        .invoke_handler(tauri::generate_handler![
            commands::transactions::add_transaction,
            commands::transactions::update_transaction,
            commands::transactions::delete_transaction,
            commands::transactions::get_transactions,
            commands::transactions::get_all_transactions,
            commands::transactions::get_transactions_since_version,
            commands::categories::get_categories,
            commands::categories::add_category,
            commands::notes::save_note,
            commands::notes::get_note,
            commands::notes::get_all_notes,
            commands::notes::get_notes_since_version,
            commands::notes::delete_note,
            commands::analysis::get_weekly_analysis,
            commands::analysis::get_monthly_analysis,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::sync::sync_data,
            commands::sync::sync_data_incremental,
            commands::sync::test_sync_connection,
            commands::sync::get_last_sync_time,
            commands::sync::get_sync_metadata,
            commands::io::export_system_json,
            commands::io::import_system_json,
            commands::io::export_accounting_csv,
            commands::io::import_accounting_csv,
            commands::io::export_notes_zip,
            commands::io::import_notes_zip,
            commands::io::validate_data_integrity,
            commands::io::compute_full_checksum,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
