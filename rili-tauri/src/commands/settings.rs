use crate::{with_db, AppState};
use tauri::State;

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    with_db(&state, |db| db.get_setting(&key))
}
#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    with_db(&state, |db| db.set_setting(&key, &value))
}
