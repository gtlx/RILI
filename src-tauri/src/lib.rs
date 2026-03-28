use crate::db::{AppError, Category, Database, MonthlyAnalysis, Note, SyncMetadata, Transaction, WeeklyAnalysis};
use crate::sync::{SyncConfig, SyncService};
use std::sync::Arc;
use tauri::State;

#[cfg(target_os = "android")]
mod android_log {
    use std::ffi::CString;
    use std::os::raw::c_char;
    #[link(name = "log")]
    extern "C" {
        fn __android_log_write(prio: c_int, tag: *const c_char, msg: *const c_char) -> c_int;
    }
    type c_int = i32;
    pub fn log(msg: &str) {
        unsafe {
            let tag = CString::new("RILI").unwrap();
            let cmsg = CString::new(msg).unwrap();
            __android_log_write(3, tag.as_ptr(), cmsg.as_ptr());
        }
    }
}

#[allow(unused_variables)]
pub struct AppState {
    pub db: Arc<Database>,
}

mod db;
mod sync;

// 交易命令
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

#[tauri::command]
fn get_transactions_since_version(state: State<AppState>, version: i64) -> Result<Vec<Transaction>, AppError> {
    state.db.get_transactions_since_version(version)
}

// 分类命令
#[tauri::command]
fn get_categories(state: State<AppState>, category_type: String) -> Result<Vec<Category>, AppError> {
    state.db.get_categories(&category_type)
}

#[tauri::command]
fn add_category(state: State<AppState>, category: Category) -> Result<i64, AppError> {
    state.db.add_category(category)
}

// 记账备注命令
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
fn get_notes_since_version(state: State<AppState>, version: i64) -> Result<Vec<Note>, AppError> {
    state.db.get_notes_since_version(version)
}

#[tauri::command]
fn delete_note(state: State<AppState>, date: String) -> Result<(), AppError> {
    state.db.delete_note(&date)
}

// 分析命令
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

// 设置命令
#[tauri::command]
fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, AppError> {
    state.db.get_setting(&key)
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), AppError> {
    state.db.set_setting(&key, &value)
}

// 同步元数据命令
#[tauri::command]
fn get_sync_metadata(state: State<AppState>) -> Result<SyncMetadata, AppError> {
    state.db.get_sync_metadata()
}

// 数据验证命令
#[tauri::command]
fn validate_data_integrity(state: State<AppState>) -> Result<bool, AppError> {
    state.db.validate_data_integrity()
}

#[tauri::command]
fn compute_full_checksum(state: State<AppState>) -> Result<String, AppError> {
    state.db.compute_full_checksum()
}

// 导入/导出命令
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

#[tauri::command]
fn export_notes_zip(state: State<AppState>) -> Result<String, AppError> {
    state.db.export_notes_zip()
}

// 同步命令
#[tauri::command]
async fn sync_data(state: State<'_, AppState>, config: SyncConfig) -> Result<String, String> {
    let sync_service = SyncService::new(state.db.clone());
    sync_service.sync(&config).await
}

#[tauri::command]
async fn sync_data_incremental(state: State<'_, AppState>, config: SyncConfig) -> Result<String, String> {
    let sync_service = SyncService::new(state.db.clone());
    sync_service.sync_incremental(&config).await
}

#[tauri::command]
async fn test_sync_connection(config: SyncConfig) -> Result<bool, String> {
    let sync_service = SyncService::new(Arc::new(Database::new().unwrap()));
    sync_service.test_connection(&config).await
}

#[tauri::command]
fn get_last_sync_time(state: State<AppState>) -> Result<Option<String>, AppError> {
    state.db.get_last_sync()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    {
        android_log::log("=== RILI APP STARTING ===");
        android_log::log(&format!("Rust version: {}", env!("CARGO_PKG_VERSION")));
    }
    
    let db_result = Database::new();
    let db = match db_result {
        Ok(db) => {
            log::info!("Database initialized successfully");
            #[cfg(target_os = "android")]
            android_log::log("Database OK");
            db
        }
        Err(e) => {
            log::error!("Failed to initialize database: {}", e);
            #[cfg(target_os = "android")]
            android_log::log(&format!("Database FAILED: {}", e));
            panic!("Failed to initialize database: {}", e);
        }
    };
    
    #[cfg(target_os = "android")]
    android_log::log("Creating Tauri builder...");
    
    let app_state = AppState { db: Arc::new(db) };
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            add_transaction,
            update_transaction,
            delete_transaction,
            get_transactions,
            get_all_transactions,
            get_transactions_since_version,
            get_categories,
            add_category,
            save_note,
            get_note,
            get_all_notes,
            get_notes_since_version,
            delete_note,
            get_weekly_analysis,
            get_monthly_analysis,
            get_setting,
            set_setting,
            get_sync_metadata,
            validate_data_integrity,
            compute_full_checksum,
            export_all_data,
            import_data,
            export_transactions_csv,
            import_transactions_csv,
            export_notes_zip,
            sync_data,
            sync_data_incremental,
            test_sync_connection,
            get_last_sync_time,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
