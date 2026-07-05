use rili_core::services::git_sync::GitSync;

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

// ── 笔记: Git 同步 ──
#[tauri::command]
pub fn git_init(state: State<AppState>) -> Result<(), String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::init(notes_dir).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_commit(state: State<AppState>, message: String) -> Result<(), String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::commit(notes_dir, &message).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_log(state: State<AppState>, max_count: u32) -> Result<Vec<String>, String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::log(notes_dir, max_count).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_set_remote(state: State<AppState>, url: String) -> Result<(), String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::add_remote(notes_dir, &url).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_remove_remote(state: State<AppState>) -> Result<(), String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::remove_remote(notes_dir).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_get_remote_url(state: State<AppState>) -> Result<Option<String>, String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::get_remote_url(notes_dir).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_push(state: State<AppState>) -> Result<String, String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::push(notes_dir).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn git_pull(state: State<AppState>) -> Result<String, String> {
    let notes_dir = &state.core.lock().map_err(|e| e.to_string())?.db.notes_dir();
    GitSync::pull(notes_dir).map_err(|e| e.to_string())
}
