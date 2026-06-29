use crate::AppState;
use tauri::State;

// ── 系统数据: JSON ──
#[tauri::command]
pub fn export_system_json(state: State<AppState>) -> Result<String, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .export_system_json()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn import_system_json(
    state: State<AppState>,
    json_data: String,
    merge: bool,
) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .import_system_json(&json_data, merge)
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

// ── 记账: CSV ──
#[tauri::command]
pub fn export_accounting_csv(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<String, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .export_accounting_csv(&start_date, &end_date)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn import_accounting_csv(state: State<AppState>, csv_data: String) -> Result<i64, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .import_accounting_csv(&csv_data)
        .map_err(|e| e.to_string())
}

// ── 笔记: ZIP ──
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
pub fn import_notes_zip(state: State<AppState>, base64_data: String) -> Result<i64, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .import_notes_zip(&base64_data)
        .map_err(|e| e.to_string())
}
