use crate::AppState;
use rili_core::models::Category;
use tauri::State;

#[tauri::command]
pub fn get_categories(
    state: State<AppState>,
    category_type: String,
) -> Result<Vec<Category>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_categories(&category_type)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn add_category(state: State<AppState>, category: Category) -> Result<i64, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .add_category(&category)
        .map_err(|e| e.to_string())
}
