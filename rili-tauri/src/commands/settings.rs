use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_setting(&key)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .set_setting(&key, &value)
        .map_err(|e| e.to_string())
}
