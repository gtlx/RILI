pub mod analysis_repo;
pub mod category_repo;
pub mod connection;
pub mod note_repo;
pub mod settings_repo;
pub mod sync_repo;
pub mod transaction_repo;

pub use connection::*;

use crate::models::*;
use crate::utils::Error;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
    data_dir: String,
}

impl Database {
    pub fn open(data_dir: &Path) -> Result<Self, Error> {
        std::fs::create_dir_all(data_dir)?;
        std::fs::create_dir_all(data_dir.join("notes"))?;

        let db_path = data_dir.join("rili.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;

        let db = Self {
            conn: Mutex::new(conn),
            data_dir: data_dir.to_string_lossy().to_string(),
        };
        db.run_migrations()?;
        log::info!("Database opened: {:?}", db_path);
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), Error> {
        let conn = self.conn.lock().unwrap();
        let sql = include_str!("../../migrations/001_init.sql");
        conn.execute_batch(sql)?;
        Ok(())
    }

    pub fn data_dir(&self) -> &str {
        &self.data_dir
    }
    pub fn notes_dir(&self) -> std::path::PathBuf {
        std::path::Path::new(&self.data_dir).join("notes")
    }
    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }
}
