use crate::{with_db, AppState};
use rili_core::models::RecurringRule;
use tauri::State;

#[tauri::command]
pub fn add_recurring_rule(state: State<AppState>, rule: RecurringRule) -> Result<i64, String> {
    with_db(&state, |db| db.add_recurring_rule(&rule))
}

#[tauri::command]
pub fn update_recurring_rule(state: State<AppState>, rule: RecurringRule) -> Result<(), String> {
    with_db(&state, |db| db.update_recurring_rule(&rule))
}

#[tauri::command]
pub fn delete_recurring_rule(state: State<AppState>, id: i64) -> Result<(), String> {
    with_db(&state, |db| db.delete_recurring_rule(id))
}

#[tauri::command]
pub fn get_recurring_rules(state: State<AppState>) -> Result<Vec<RecurringRule>, String> {
    with_db(&state, |db| db.get_recurring_rules())
}

#[tauri::command]
pub fn generate_recurring_transactions(state: State<AppState>, end_date: String) -> Result<i64, String> {
    with_db(&state, |db| db.generate_recurring_transactions(&end_date))
}
