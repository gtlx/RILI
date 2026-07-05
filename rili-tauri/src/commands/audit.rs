use crate::{with_db, AppState};
use rili_core::models::TransactionAudit;
use tauri::State;

#[tauri::command]
pub fn get_transaction_audit(
    state: State<AppState>,
    limit: i64,
) -> Result<Vec<TransactionAudit>, String> {
    with_db(&state, |db| db.get_transaction_audit(limit))
}
