use crate::{with_db, AppState};
use tauri::State;

// ── 系统数据: JSON ──
#[tauri::command]
pub fn export_system_json(state: State<AppState>) -> Result<String, String> {
    with_db(&state, |db| db.export_system_json())
}
#[tauri::command]
pub fn import_system_json(
    state: State<AppState>,
    json_data: String,
    merge: bool,
) -> Result<(), String> {
    with_db(&state, |db| db.import_system_json(&json_data, merge))
}
#[tauri::command]
pub fn validate_data_integrity(state: State<AppState>) -> Result<bool, String> {
    with_db(&state, |db| db.validate_data_integrity())
}
#[tauri::command]
pub fn compute_full_checksum(state: State<AppState>) -> Result<String, String> {
    with_db(&state, |db| db.compute_full_checksum())
}

// ── 记账: CSV ──
#[tauri::command]
pub fn export_accounting_csv(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<String, String> {
    with_db(&state, |db| db.export_accounting_csv(&start_date, &end_date))
}
#[tauri::command]
pub fn import_accounting_csv(state: State<AppState>, csv_data: String) -> Result<i64, String> {
    with_db(&state, |db| db.import_accounting_csv(&csv_data))
}

// ── 笔记: ZIP ──
#[tauri::command]
pub fn export_notes_zip(state: State<AppState>) -> Result<String, String> {
    with_db(&state, |db| db.export_notes_zip())
}
#[tauri::command]
pub fn import_notes_zip(state: State<AppState>, base64_data: String) -> Result<i64, String> {
    with_db(&state, |db| db.import_notes_zip(&base64_data))
}
