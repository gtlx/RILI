use crate::{with_db, AppState};
use rili_core::models::Category;
use tauri::State;

#[tauri::command]
pub fn get_categories(
    state: State<AppState>,
    category_type: String,
) -> Result<Vec<Category>, String> {
    with_db(&state, |db| db.get_categories(&category_type))
}
#[tauri::command]
pub fn add_category(state: State<AppState>, category: Category) -> Result<i64, String> {
    with_db(&state, |db| db.add_category(&category))
}
