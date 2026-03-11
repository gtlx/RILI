use crate::db::{AppError, Category, Database, MonthlyAnalysis, Note, Transaction, WeeklyAnalysis};
use crate::sync::{SyncConfig, SyncService};
use std::sync::Arc;
use tauri::State;

pub struct AppState {
    pub db: Arc<Database>,
}

mod db;
mod sync;

// Transaction commands
#[tauri::command]
fn add_transaction(state: State<AppState>, transaction: Transaction) -> Result<i64, AppError> {
    state.db.add_transaction(transaction)
}

#[tauri::command]
fn update_transaction(state: State<AppState>, transaction: Transaction) -> Result<(), AppError> {
    state.db.update_transaction(transaction)
}

#[tauri::command]
fn delete_transaction(state: State<AppState>, id: i64) -> Result<(), AppError> {
    state.db.delete_transaction(id)
}

#[tauri::command]
fn get_transactions(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<Transaction>, AppError> {
    state.db.get_transactions(&start_date, &end_date)
}

#[tauri::command]
fn get_all_transactions(state: State<AppState>) -> Result<Vec<Transaction>, AppError> {
    state.db.get_all_transactions()
}

// Category commands
#[tauri::command]
fn get_categories(state: State<AppState>, category_type: String) -> Result<Vec<Category>, AppError> {
    state.db.get_categories(&category_type)
}

#[tauri::command]
fn add_category(state: State<AppState>, category: Category) -> Result<i64, AppError> {
    state.db.add_category(category)
}

// Note commands
#[tauri::command]
fn save_note(state: State<AppState>, date: String, content: String) -> Result<(), AppError> {
    state.db.save_note(&date, &content)
}

#[tauri::command]
fn get_note(state: State<AppState>, date: String) -> Result<Option<String>, AppError> {
    state.db.get_note(&date)
}

#[tauri::command]
fn get_all_notes(state: State<AppState>) -> Result<Vec<Note>, AppError> {
    state.db.get_all_notes()
}

#[tauri::command]
fn delete_note(state: State<AppState>, date: String) -> Result<(), AppError> {
    state.db.delete_note(&date)
}

// Analysis commands
#[tauri::command]
fn get_weekly_analysis(
    state: State<AppState>,
    year: i32,
    week: u32,
) -> Result<WeeklyAnalysis, AppError> {
    state.db.get_weekly_analysis(year, week)
}

#[tauri::command]
fn get_monthly_analysis(
    state: State<AppState>,
    year: i32,
    month: u32,
) -> Result<MonthlyAnalysis, AppError> {
    state.db.get_monthly_analysis(year, month)
}

// Settings commands
#[tauri::command]
fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, AppError> {
    state.db.get_setting(&key)
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), AppError> {
    state.db.set_setting(&key, &value)
}

// Export/Import commands
#[tauri::command]
fn export_all_data(state: State<AppState>) -> Result<String, AppError> {
    state.db.export_all_data()
}

#[tauri::command]
fn import_data(state: State<AppState>, json_data: String, merge: bool) -> Result<(), AppError> {
    state.db.import_data(&json_data, merge)
}

#[tauri::command]
fn export_transactions_csv(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<String, AppError> {
    state.db.export_transactions_csv(&start_date, &end_date)
}

#[tauri::command]
fn import_transactions_csv(state: State<AppState>, csv_data: String) -> Result<i64, AppError> {
    state.db.import_transactions_csv(&csv_data)
}

// Sync commands
#[tauri::command]
async fn sync_data(state: State<'_, AppState>, config: SyncConfig) -> Result<String, String> {
    let sync_service = SyncService::new(state.db.clone());
    sync_service.sync(&config).await
}

#[tauri::command]
fn test_sync_connection(config: SyncConfig) -> Result<bool, String> {
    let sync_service = SyncService::new(Arc::new(Database::new().unwrap()));
    sync_service.test_connection(&config)
}

#[tauri::command]
fn get_last_sync_time(state: State<AppState>) -> Result<Option<String>, AppError> {
    state.db.get_last_sync()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    
    let db = Database::new().expect("Failed to initialize database");
    let app_state = AppState { db: Arc::new(db) };
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            add_transaction,
            update_transaction,
            delete_transaction,
            get_transactions,
            get_all_transactions,
            get_categories,
            add_category,
            save_note,
            get_note,
            get_all_notes,
            delete_note,
            get_weekly_analysis,
            get_monthly_analysis,
            get_setting,
            set_setting,
            export_all_data,
            import_data,
            export_transactions_csv,
            import_transactions_csv,
            sync_data,
            test_sync_connection,
            get_last_sync_time,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
