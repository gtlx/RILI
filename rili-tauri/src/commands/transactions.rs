use crate::AppState;
use rili_core::models::Transaction;
use tauri::State;

#[tauri::command]
pub fn add_transaction(state: State<AppState>, transaction: Transaction) -> Result<i64, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .add_transaction(&transaction)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn update_transaction(state: State<AppState>, transaction: Transaction) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .update_transaction(&transaction)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_transaction(state: State<AppState>, id: i64) -> Result<(), String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .delete_transaction(id)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_transactions(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<Transaction>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_transactions(&start_date, &end_date)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_all_transactions(state: State<AppState>) -> Result<Vec<Transaction>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_all_transactions()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_transactions_since_version(
    state: State<AppState>,
    version: i64,
) -> Result<Vec<Transaction>, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_transactions_since_version(version)
        .map_err(|e| e.to_string())
}
