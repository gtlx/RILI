use crate::{with_db, AppState};
use rili_core::models::SyncConfig;
use rili_core::models::SyncMetadata;
use rili_core::services::SyncService;
use tauri::State;

#[tauri::command]
pub fn sync_data(state: State<AppState>, config: SyncConfig) -> Result<String, String> {
    let app = state.core.lock().map_err(|e| e.to_string())?;
    app.sync.sync(&config).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn sync_data_incremental(state: State<AppState>, config: SyncConfig) -> Result<String, String> {
    let app = state.core.lock().map_err(|e| e.to_string())?;
    app.sync
        .sync_incremental(&config)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn test_sync_connection(config: SyncConfig) -> Result<bool, String> {
    let tmp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let db = std::sync::Arc::new(
        rili_core::database::Database::open(tmp.path()).map_err(|e| e.to_string())?,
    );
    let svc = SyncService::new(db);
    svc.test_connection(&config).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_last_sync_time(state: State<AppState>) -> Result<Option<String>, String> {
    with_db(&state, |db| db.get_last_sync())
}
#[tauri::command]
pub fn get_sync_metadata(state: State<AppState>) -> Result<SyncMetadata, String> {
    with_db(&state, |db| db.get_sync_metadata())
}
