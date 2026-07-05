use crate::{with_db, AppState};
use rili_core::models::Transaction;
use tauri::State;

#[tauri::command]
pub fn add_transaction(state: State<AppState>, transaction: Transaction) -> Result<i64, String> {
    with_db(&state, |db| db.add_transaction(&transaction))
}
#[tauri::command]
pub fn update_transaction(state: State<AppState>, transaction: Transaction) -> Result<(), String> {
    with_db(&state, |db| db.update_transaction(&transaction))
}
#[tauri::command]
pub fn delete_transaction(state: State<AppState>, id: i64) -> Result<(), String> {
    with_db(&state, |db| db.delete_transaction(id))
}
#[tauri::command]
pub fn get_transactions(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<Transaction>, String> {
    with_db(&state, |db| db.get_transactions(&start_date, &end_date))
}
#[tauri::command]
pub fn get_all_transactions(state: State<AppState>) -> Result<Vec<Transaction>, String> {
    with_db(&state, |db| db.get_all_transactions())
}
#[tauri::command]
pub fn get_transactions_since_version(
    state: State<AppState>,
    version: i64,
) -> Result<Vec<Transaction>, String> {
    with_db(&state, |db| db.get_transactions_since_version(version))
}
