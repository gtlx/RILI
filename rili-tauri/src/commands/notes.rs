use crate::{with_db, AppState};
use rili_core::models::Note;
use tauri::State;

#[tauri::command]
pub fn save_note(state: State<AppState>, date: String, content: String) -> Result<(), String> {
    with_db(&state, |db| db.save_note(&date, &content))
}
#[tauri::command]
pub fn get_note(state: State<AppState>, date: String) -> Result<Option<String>, String> {
    with_db(&state, |db| db.get_note(&date))
}
#[tauri::command]
pub fn get_all_notes(state: State<AppState>) -> Result<Vec<Note>, String> {
    with_db(&state, |db| db.get_all_notes())
}
#[tauri::command]
pub fn get_notes_since_version(state: State<AppState>, version: i64) -> Result<Vec<Note>, String> {
    with_db(&state, |db| db.get_notes_since_version(version))
}
#[tauri::command]
pub fn delete_note(state: State<AppState>, date: String) -> Result<(), String> {
    with_db(&state, |db| db.delete_note(&date))
}
