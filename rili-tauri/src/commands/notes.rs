use crate::AppState;
use rili_core::models::Note;
use tauri::State;

#[tauri::command]
pub fn save_note(state: State<AppState>, date: String, content: String) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .save_note(&date, &content)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_note(state: State<AppState>, date: String) -> Result<Option<String>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_note(&date)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_all_notes(state: State<AppState>) -> Result<Vec<Note>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_all_notes()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_notes_since_version(state: State<AppState>, version: i64) -> Result<Vec<Note>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_notes_since_version(version)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_note(state: State<AppState>, date: String) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .delete_note(&date)
        .map_err(|e| e.to_string())
}
