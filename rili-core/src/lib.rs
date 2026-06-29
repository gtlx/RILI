pub mod database;
pub mod models;
pub mod services;
pub mod utils;

use std::path::Path;
use std::sync::Arc;

/// RILI 应用核心 — 统一入口
pub struct App {
    pub db: Arc<database::Database>,
    pub sync: services::SyncService,
}

impl App {
    pub fn init(data_dir: &Path) -> Result<Self, utils::Error> {
        let db = Arc::new(database::Database::open(data_dir)?);
        let sync = services::SyncService::new(db.clone());
        Ok(Self { db, sync })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        let dir = tempfile::tempdir().unwrap();
        let app = App::init(dir.path());
        assert!(app.is_ok());
    }

    #[test]
    fn test_add_and_get_transaction() {
        let dir = tempfile::tempdir().unwrap();
        let app = App::init(dir.path()).unwrap();
        let tx = models::Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 100.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: Some("午餐".into()),
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        let id = app.db.add_transaction(&tx).unwrap();
        assert!(id > 0);
        let txs = app.db.get_transactions("2026-06-01", "2026-06-30").unwrap();
        assert_eq!(txs.len(), 1);
    }
}
