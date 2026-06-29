use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn export_all_data(state: State<AppState>) -> Result<String, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .export_all_data()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn import_data(state: State<AppState>, json_data: String, merge: bool) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .import_data(&json_data, merge)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn export_transactions_csv(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<String, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .export_transactions_csv(&start_date, &end_date)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn import_transactions_csv(state: State<AppState>, csv_data: String) -> Result<i64, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .import_transactions_csv(&csv_data)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn export_notes_zip(state: State<AppState>) -> Result<String, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .export_notes_zip()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn validate_data_integrity(state: State<AppState>) -> Result<bool, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .validate_data_integrity()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn compute_full_checksum(state: State<AppState>) -> Result<String, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .compute_full_checksum()
        .map_err(|e| e.to_string())
}
