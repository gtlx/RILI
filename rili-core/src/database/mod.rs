pub mod analysis_repo;
pub mod category_repo;
pub mod note_repo;
pub mod recurring_repo;
pub mod settings_repo;
pub mod sync_repo;
pub mod transaction_repo;


use crate::utils::Error;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
    data_dir: std::path::PathBuf,
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
            data_dir: data_dir.to_path_buf(),
        };
        db.run_migrations()?;
        log::info!("Database opened: {:?}", db_path);
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), Error> {
        let conn = self.conn.lock().unwrap();
        let sql = include_str!("../../migrations/001_init.sql");
        conn.execute_batch(sql)?;
        let sql2 = include_str!("../../migrations/002_recurring.sql");
        conn.execute_batch(sql2)?;
        Ok(())
    }

    pub fn data_dir(&self) -> &std::path::Path {
        &self.data_dir
    }
    pub fn notes_dir(&self) -> std::path::PathBuf {
        self.data_dir.join("notes")
    }
    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }
}
