use chrono::{Datelike, Local, NaiveDate, Utc};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Mutex;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Not found")]
    NotFound,
    #[error("Sync error: {0}")]
    Sync(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub id: Option<i64>,
    pub date: String,
    pub amount: f64,
    pub transaction_type: String,
    pub category: String,
    pub note: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub version: i64,
    pub is_deleted: bool,
    pub checksum: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: Option<i64>,
    pub name: String,
    pub category_type: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: Option<i64>,
    pub date: String,
    pub file_path: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub version: i64,
    pub is_deleted: bool,
    pub checksum: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeeklyAnalysis {
    pub week_start: String,
    pub week_end: String,
    pub total_income: f64,
    pub total_expense: f64,
    pub income_by_category: Vec<CategoryAmount>,
    pub expense_by_category: Vec<CategoryAmount>,
    pub daily_expense: Vec<DailyAmount>,
    pub compare_to_last_week: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryAmount {
    pub category: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyAmount {
    pub date: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlyAnalysis {
    pub month: String,
    pub year: i32,
    pub total_income: f64,
    pub total_expense: f64,
    pub income_by_category: Vec<CategoryAmount>,
    pub expense_by_category: Vec<CategoryAmount>,
    pub compare_to_last_month: f64,
    pub top_categories: Vec<CategoryAmount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncQueueItem {
    pub id: i64,
    pub table_name: String,
    pub record_id: i64,
    pub operation: String,
    pub timestamp: String,
    pub processed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub last_sync_version: i64,
    pub last_sync_time: String,
    pub checksum: String,
}

fn compute_checksum(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub struct Database {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

impl Database {
    pub fn new() -> Result<Self, AppError> {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("rili-app");

        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("rili.db");
        let notes_dir = data_dir.join("notes");
        std::fs::create_dir_all(&notes_dir)?;

        let conn = Connection::open(&db_path)?;

        let db = Database {
            conn: Mutex::new(conn),
            data_dir,
        };

        db.init_tables()?;
        db.init_default_categories()?;
        db.init_sync_tracking()?;

        Ok(db)
    }

    fn init_tables(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income', 'expense')),
                category TEXT NOT NULL,
                note TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                is_deleted INTEGER DEFAULT 0,
                checksum TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category_type TEXT NOT NULL CHECK(category_type IN ('income', 'expense')),
                icon TEXT,
                color TEXT,
                is_default INTEGER DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                file_path TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                is_deleted INTEGER DEFAULT 0,
                checksum TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_time TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id INTEGER NOT NULL,
                operation TEXT NOT NULL,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                processed INTEGER DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_version ON transactions(version)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(is_deleted)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notes_version ON notes(version)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_queue_processed ON sync_queue(processed)",
            [],
        )?;

        Ok(())
    }

    fn init_sync_tracking(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('last_sync_version', '0')",
            [],
        )?;

        conn.execute(
            "INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('last_sync_time', '')",
            [],
        )?;

        conn.execute(
            "INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('checksum', '')",
            [],
        )?;

        Ok(())
    }

    fn init_default_categories(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        let expense_categories = vec![
            ("餐饮", "restaurant", "#EF4444"),
            ("交通", "car", "#F59E0B"),
            ("购物", "shopping", "#8B5CF6"),
            ("教育", "book", "#3B82F6"),
            ("医疗", "hospital", "#EC4899"),
            ("娱乐", "game", "#14B8A6"),
            ("其他", "more", "#6B7280"),
        ];

        let income_categories = vec![
            ("工资", "wallet", "#10B981"),
            ("投资", "trending_up", "#6366F1"),
            ("其他收入", "plus_circle", "#6B7280"),
        ];

        for (name, icon, color) in expense_categories {
            conn.execute(
                "INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES (?1, 'expense', ?2, ?3, 1)",
                params![name, icon, color],
            )?;
        }

        for (name, icon, color) in income_categories {
            conn.execute(
                "INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES (?1, 'income', ?2, ?3, 1)",
                params![name, icon, color],
            )?;
        }

        Ok(())
    }

    fn add_to_sync_queue(
        &self,
        table_name: &str,
        record_id: i64,
        operation: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation) VALUES (?1, ?2, ?3)",
            params![table_name, record_id, operation],
        )?;

        Ok(())
    }

    pub fn get_notes_dir(&self) -> PathBuf {
        self.data_dir.join("notes")
    }

    fn compute_record_checksum(&self, t: &Transaction) -> String {
        let data = format!(
            "{}|{}|{}|{}|{}|{}",
            t.date,
            t.amount,
            t.transaction_type,
            t.category,
            t.note.as_deref().unwrap_or(""),
            t.is_deleted
        );
        compute_checksum(&data)
    }

    // Transaction methods
    pub fn add_transaction(&self, t: Transaction) -> Result<i64, AppError> {
        let conn = self.conn.lock().unwrap();
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        conn.execute(
            "INSERT INTO transactions (date, amount, transaction_type, category, note, version, is_deleted, checksum, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, ?6, ?7, ?7)",
            params![t.date, t.amount, t.transaction_type, t.category, t.note, "", now],
        )?;

        let id = conn.last_insert_rowid();

        let new_t = Transaction {
            id: Some(id),
            date: t.date.clone(),
            amount: t.amount,
            transaction_type: t.transaction_type.clone(),
            category: t.category.clone(),
            note: t.note.clone(),
            version: 1,
            is_deleted: false,
            checksum: None,
            created_at: None,
            updated_at: None,
        };
        conn.execute(
            "UPDATE transactions SET checksum = ?1 WHERE id = ?2",
            params![self.compute_record_checksum(&new_t), id],
        )?;

        drop(conn);

        self.add_to_sync_queue("transactions", id, "INSERT")?;

        Ok(id)
    }

    pub fn update_transaction(&self, t: Transaction) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        let version: i64 = conn.query_row(
            "SELECT version FROM transactions WHERE id = ?1",
            params![t.id],
            |row| row.get(0),
        )?;

        conn.execute(
            "UPDATE transactions SET date = ?1, amount = ?2, transaction_type = ?3, category = ?4, note = ?5, version = ?6, updated_at = ?7, checksum = '' WHERE id = ?8",
            params![t.date, t.amount, t.transaction_type, t.category, t.note, version + 1, now, t.id],
        )?;

        let id = t.id.unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, is_deleted FROM transactions WHERE id = ?1"
        )?;

        let record = stmt.query_row(params![id], |row| {
            Ok(Transaction {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                amount: row.get(2)?,
                transaction_type: row.get(3)?,
                category: row.get(4)?,
                note: row.get(5)?,
                created_at: None,
                updated_at: None,
                version: version + 1,
                is_deleted: row.get::<_, i32>(6)? == 1,
                checksum: None,
            })
        })?;

        let checksum = self.compute_record_checksum(&record);

        drop(stmt);

        conn.execute(
            "UPDATE transactions SET checksum = ?1 WHERE id = ?2",
            params![checksum, id],
        )?;

        drop(conn);

        self.add_to_sync_queue("transactions", id, "UPDATE")?;

        Ok(())
    }

    pub fn delete_transaction(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        let version: i64 = conn.query_row(
            "SELECT version FROM transactions WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        conn.execute(
            "UPDATE transactions SET is_deleted = 1, version = ?1, updated_at = ?2, checksum = '' WHERE id = ?3",
            params![version + 1, now, id],
        )?;

        drop(conn);

        self.add_to_sync_queue("transactions", id, "DELETE")?;

        Ok(())
    }

    pub fn get_transactions(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<Transaction>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at, version, is_deleted, checksum 
             FROM transactions WHERE date >= ?1 AND date <= ?2 AND is_deleted = 0 ORDER BY date DESC"
        )?;

        let rows = stmt.query_map(params![start_date, end_date], |row| {
            Ok(Transaction {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                amount: row.get(2)?,
                transaction_type: row.get(3)?,
                category: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                version: row.get(8)?,
                is_deleted: row.get::<_, i32>(9)? == 1,
                checksum: row.get(10)?,
            })
        })?;

        let mut transactions = Vec::new();
        for row in rows {
            transactions.push(row?);
        }

        Ok(transactions)
    }

    pub fn get_all_transactions(&self) -> Result<Vec<Transaction>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at, version, is_deleted, checksum 
             FROM transactions WHERE is_deleted = 0 ORDER BY date DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Transaction {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                amount: row.get(2)?,
                transaction_type: row.get(3)?,
                category: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                version: row.get(8)?,
                is_deleted: row.get::<_, i32>(9)? == 1,
                checksum: row.get(10)?,
            })
        })?;

        let mut transactions = Vec::new();
        for row in rows {
            transactions.push(row?);
        }

        Ok(transactions)
    }

    pub fn get_transactions_since_version(
        &self,
        version: i64,
    ) -> Result<Vec<Transaction>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at, version, is_deleted, checksum 
             FROM transactions WHERE version > ?1 ORDER BY version ASC"
        )?;

        let rows = stmt.query_map(params![version], |row| {
            Ok(Transaction {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                amount: row.get(2)?,
                transaction_type: row.get(3)?,
                category: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                version: row.get(8)?,
                is_deleted: row.get::<_, i32>(9)? == 1,
                checksum: row.get(10)?,
            })
        })?;

        let mut transactions = Vec::new();
        for row in rows {
            transactions.push(row?);
        }

        Ok(transactions)
    }

    // Category methods
    pub fn get_categories(&self, category_type: &str) -> Result<Vec<Category>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, category_type, icon, color, is_default FROM categories WHERE category_type = ?1"
        )?;

        let rows = stmt.query_map(params![category_type], |row| {
            Ok(Category {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                category_type: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
                is_default: row.get::<_, i32>(5)? == 1,
            })
        })?;

        let mut categories = Vec::new();
        for row in rows {
            categories.push(row?);
        }

        Ok(categories)
    }

    pub fn add_category(&self, c: Category) -> Result<i64, AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO categories (name, category_type, icon, color, is_default) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![c.name, c.category_type, c.icon, c.color, c.is_default as i32],
        )?;

        Ok(conn.last_insert_rowid())
    }

    // Note methods
    pub fn save_note(&self, date: &str, content: &str) -> Result<(), AppError> {
        let file_path = self.get_notes_dir().join(format!("{}.md", date));
        std::fs::write(&file_path, content)?;

        let conn = self.conn.lock().unwrap();
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let checksum = compute_checksum(content);

        conn.execute(
            "INSERT OR REPLACE INTO notes (date, file_path, version, is_deleted, checksum, updated_at) 
             VALUES (?1, ?2, COALESCE((SELECT version + 1 FROM notes WHERE date = ?1), 1), 0, ?3, ?4)",
            params![date, file_path.to_string_lossy().to_string(), checksum, now],
        )?;

        let id = conn.last_insert_rowid();

        drop(conn);

        self.add_to_sync_queue("notes", id, "INSERT")?;

        Ok(())
    }

    pub fn get_note(&self, date: &str) -> Result<Option<String>, AppError> {
        let file_path = self.get_notes_dir().join(format!("{}.md", date));

        if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)?;
            Ok(Some(content))
        } else {
            Ok(None)
        }
    }

    pub fn get_all_notes(&self) -> Result<Vec<Note>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, file_path, created_at, updated_at, version, is_deleted, checksum 
             FROM notes WHERE is_deleted = 0 ORDER BY date DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Note {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                file_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                version: row.get(5)?,
                is_deleted: row.get::<_, i32>(6)? == 1,
                checksum: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for row in rows {
            notes.push(row?);
        }

        Ok(notes)
    }

    pub fn get_notes_since_version(&self, version: i64) -> Result<Vec<Note>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, file_path, created_at, updated_at, version, is_deleted, checksum 
             FROM notes WHERE version > ?1 ORDER BY version ASC",
        )?;

        let rows = stmt.query_map(params![version], |row| {
            Ok(Note {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                file_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                version: row.get(5)?,
                is_deleted: row.get::<_, i32>(6)? == 1,
                checksum: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for row in rows {
            notes.push(row?);
        }

        Ok(notes)
    }

    pub fn delete_note(&self, date: &str) -> Result<(), AppError> {
        let file_path = self.get_notes_dir().join(format!("{}.md", date));
        if file_path.exists() {
            std::fs::remove_file(&file_path)?;
        }

        let conn = self.conn.lock().unwrap();
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        let version: i64 = conn
            .query_row(
                "SELECT version FROM notes WHERE date = ?1",
                params![date],
                |row| row.get(0),
            )
            .unwrap_or(1);

        conn.execute(
            "UPDATE notes SET is_deleted = 1, version = ?1, updated_at = ?2 WHERE date = ?3",
            params![version + 1, now, date],
        )?;

        let id: i64 = conn
            .query_row(
                "SELECT id FROM notes WHERE date = ?1",
                params![date],
                |row| row.get(0),
            )
            .unwrap_or(0);

        drop(conn);

        if id > 0 {
            self.add_to_sync_queue("notes", id, "DELETE")?;
        }

        Ok(())
    }

    // Analysis methods
    pub fn get_weekly_analysis(&self, year: i32, week: u32) -> Result<WeeklyAnalysis, AppError> {
        let conn = self.conn.lock().unwrap();

        let start_date = NaiveDate::from_isoywd_opt(year, week, chrono::Weekday::Mon)
            .ok_or(AppError::NotFound)?;
        let end_date = start_date + chrono::Duration::days(6);

        let last_week_start = start_date - chrono::Duration::days(7);
        let last_week_end = start_date - chrono::Duration::days(1);

        let start_str = start_date.format("%Y-%m-%d").to_string();
        let end_str = end_date.format("%Y-%m-%d").to_string();
        let last_start_str = last_week_start.format("%Y-%m-%d").to_string();
        let last_end_str = last_week_end.format("%Y-%m-%d").to_string();

        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2 AND is_deleted = 0",
            params![start_str, end_str],
            |row| row.get(0),
        )?;

        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 AND is_deleted = 0",
            params![start_str, end_str],
            |row| row.get(0),
        )?;

        let last_week_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 AND is_deleted = 0",
            params![last_start_str, last_end_str],
            |row| row.get(0),
        )?;

        let compare_to_last_week = if last_week_expense > 0.0 {
            ((total_expense - last_week_expense) / last_week_expense) * 100.0
        } else {
            0.0
        };

        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2 AND is_deleted = 0 GROUP BY category"
        )?;
        let income_by_category: Vec<CategoryAmount> = stmt
            .query_map(params![start_str, end_str], |row| {
                Ok(CategoryAmount {
                    category: row.get(0)?,
                    amount: row.get(1)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 AND is_deleted = 0 GROUP BY category"
        )?;
        let expense_by_category: Vec<CategoryAmount> = stmt
            .query_map(params![start_str, end_str], |row| {
                Ok(CategoryAmount {
                    category: row.get(0)?,
                    amount: row.get(1)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut daily_expense = Vec::new();
        for i in 0..7 {
            let day = start_date + chrono::Duration::days(i);
            let day_str = day.format("%Y-%m-%d").to_string();

            let amount: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date = ?1 AND is_deleted = 0",
                params![day_str],
                |row| row.get(0),
            )?;

            daily_expense.push(DailyAmount {
                date: day_str,
                amount,
            });
        }

        Ok(WeeklyAnalysis {
            week_start: start_str,
            week_end: end_str,
            total_income,
            total_expense,
            income_by_category,
            expense_by_category,
            daily_expense,
            compare_to_last_week,
        })
    }

    pub fn get_monthly_analysis(&self, year: i32, month: u32) -> Result<MonthlyAnalysis, AppError> {
        let conn = self.conn.lock().unwrap();

        let start_date = NaiveDate::from_ymd_opt(year, month, 1).ok_or(AppError::NotFound)?;
        let end_date = if month == 12 {
            NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap() - chrono::Duration::days(1)
        } else {
            NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap() - chrono::Duration::days(1)
        };

        let last_month = if month == 1 { 12 } else { month - 1 };
        let last_year = if month == 1 { year - 1 } else { year };
        let last_month_start =
            NaiveDate::from_ymd_opt(last_year, last_month, 1).ok_or(AppError::NotFound)?;
        let last_month_end = if last_month == 12 {
            NaiveDate::from_ymd_opt(last_year + 1, 1, 1).unwrap() - chrono::Duration::days(1)
        } else {
            NaiveDate::from_ymd_opt(last_year, last_month + 1, 1).unwrap()
                - chrono::Duration::days(1)
        };

        let start_str = start_date.format("%Y-%m-%d").to_string();
        let end_str = end_date.format("%Y-%m-%d").to_string();
        let last_start_str = last_month_start.format("%Y-%m-%d").to_string();
        let last_end_str = last_month_end.format("%Y-%m-%d").to_string();

        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2 AND is_deleted = 0",
            params![start_str, end_str],
            |row| row.get(0),
        )?;

        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 AND is_deleted = 0",
            params![start_str, end_str],
            |row| row.get(0),
        )?;

        let last_month_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 AND is_deleted = 0",
            params![last_start_str, last_end_str],
            |row| row.get(0),
        )?;

        let compare_to_last_month = if last_month_expense > 0.0 {
            ((total_expense - last_month_expense) / last_month_expense) * 100.0
        } else {
            0.0
        };

        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2 AND is_deleted = 0 GROUP BY category"
        )?;
        let income_by_category: Vec<CategoryAmount> = stmt
            .query_map(params![start_str, end_str], |row| {
                Ok(CategoryAmount {
                    category: row.get(0)?,
                    amount: row.get(1)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 AND is_deleted = 0 GROUP BY category"
        )?;
        let expense_by_category: Vec<CategoryAmount> = stmt
            .query_map(params![start_str, end_str], |row| {
                Ok(CategoryAmount {
                    category: row.get(0)?,
                    amount: row.get(1)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut top_categories = expense_by_category.clone();
        top_categories.sort_by(|a, b| {
            b.amount
                .partial_cmp(&a.amount)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        top_categories.truncate(5);

        Ok(MonthlyAnalysis {
            month: format!("{:02}", month),
            year,
            total_income,
            total_expense,
            income_by_category,
            expense_by_category,
            compare_to_last_month,
            top_categories,
        })
    }

    // Settings methods
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.conn.lock().unwrap();

        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;

        Ok(())
    }

    // Sync metadata methods
    pub fn get_sync_metadata(&self) -> Result<SyncMetadata, AppError> {
        let conn = self.conn.lock().unwrap();

        let last_sync_version: i64 = conn
            .query_row(
                "SELECT value FROM sync_metadata WHERE key = 'last_sync_version'",
                [],
                |row| row.get::<_, String>(0),
            )
            .map(|v| v.parse().unwrap_or(0))
            .unwrap_or(0);

        let last_sync_time: String = conn
            .query_row(
                "SELECT value FROM sync_metadata WHERE key = 'last_sync_time'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_default();

        let checksum: String = conn
            .query_row(
                "SELECT value FROM sync_metadata WHERE key = 'checksum'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_default();

        Ok(SyncMetadata {
            last_sync_version,
            last_sync_time,
            checksum,
        })
    }

    pub fn update_sync_metadata(&self, version: i64, checksum: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        conn.execute(
            "UPDATE sync_metadata SET value = ?1 WHERE key = 'last_sync_version'",
            params![version.to_string()],
        )?;

        conn.execute(
            "UPDATE sync_metadata SET value = ?1 WHERE key = 'last_sync_time'",
            params![now],
        )?;

        conn.execute(
            "UPDATE sync_metadata SET value = ?1 WHERE key = 'checksum'",
            params![checksum],
        )?;

        Ok(())
    }

    pub fn get_pending_sync_items(&self) -> Result<Vec<SyncQueueItem>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, table_name, record_id, operation, timestamp, processed 
             FROM sync_queue WHERE processed = 0 ORDER BY id ASC LIMIT 100",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(SyncQueueItem {
                id: row.get(0)?,
                table_name: row.get(1)?,
                record_id: row.get(2)?,
                operation: row.get(3)?,
                timestamp: row.get(4)?,
                processed: row.get::<_, i32>(5)? == 1,
            })
        })?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }

        Ok(items)
    }

    pub fn mark_sync_items_processed(&self, ids: &[i64]) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        for id in ids {
            conn.execute(
                "UPDATE sync_queue SET processed = 1 WHERE id = ?1",
                params![id],
            )?;
        }

        Ok(())
    }

    // Data validation
    pub fn validate_data_integrity(&self) -> Result<bool, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, is_deleted FROM transactions WHERE is_deleted = 0"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Transaction {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                amount: row.get(2)?,
                transaction_type: row.get(3)?,
                category: row.get(4)?,
                note: row.get(5)?,
                created_at: None,
                updated_at: None,
                version: 0,
                is_deleted: row.get::<_, i32>(6)? == 1,
                checksum: None,
            })
        })?;

        for row in rows {
            let t = row?;
            let data = format!(
                "{}|{}|{}|{}|{}|{}",
                t.date,
                t.amount,
                t.transaction_type,
                t.category,
                t.note.as_deref().unwrap_or(""),
                t.is_deleted
            );
            let computed = compute_checksum(&data);

            let stored_checksum: String = conn.query_row(
                "SELECT checksum FROM transactions WHERE id = ?1",
                params![t.id],
                |row| row.get(0),
            )?;

            if !stored_checksum.is_empty() && stored_checksum != computed {
                log::warn!("Checksum mismatch for transaction {}", t.id.unwrap_or(0));
                return Ok(false);
            }
        }

        Ok(true)
    }

    pub fn compute_full_checksum(&self) -> Result<String, AppError> {
        let transactions = self.get_all_transactions()?;
        let notes = self.get_all_notes()?;

        let mut hasher = Sha256::new();

        for t in transactions {
            hasher.update(
                format!(
                    "{}|{}|{}|{}|{}|{}|{}",
                    t.id.unwrap_or(0),
                    t.date,
                    t.amount,
                    t.transaction_type,
                    t.category,
                    t.note.as_deref().unwrap_or(""),
                    t.is_deleted
                )
                .as_bytes(),
            );
        }

        for n in notes {
            hasher.update(format!("{}|{}|{}", n.id.unwrap_or(0), n.date, n.version).as_bytes());
        }

        Ok(format!("{:x}", hasher.finalize()))
    }

    // Export methods
    pub fn export_all_data(&self) -> Result<String, AppError> {
        let transactions = self.get_all_transactions()?;

        let expense_categories = self.get_categories("expense")?;
        let income_categories = self.get_categories("income")?;

        let notes = self.get_all_notes()?;

        #[derive(Serialize)]
        struct ExportData {
            transactions: Vec<Transaction>,
            categories: Vec<Category>,
            notes: Vec<Note>,
            exported_at: String,
            version: i64,
            checksum: String,
        }

        let checksum = self.compute_full_checksum()?;
        let metadata = self.get_sync_metadata()?;

        let export_data = ExportData {
            transactions,
            categories: {
                let mut cats = expense_categories;
                cats.extend(income_categories);
                cats
            },
            notes,
            exported_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            version: metadata.last_sync_version + 1,
            checksum,
        };

        Ok(serde_json::to_string_pretty(&export_data)?)
    }

    pub fn import_data(&self, json_data: &str, merge: bool) -> Result<(), AppError> {
        #[derive(Deserialize)]
        struct ImportData {
            transactions: Vec<Transaction>,
            categories: Vec<Category>,
        }

        let data: ImportData = serde_json::from_str(json_data)?;

        let conn = self.conn.lock().unwrap();

        if !merge {
            conn.execute("DELETE FROM transactions", [])?;
        }

        for t in data.transactions {
            if merge {
                conn.execute(
                    "INSERT OR REPLACE INTO transactions (date, amount, transaction_type, category, note, version, is_deleted, checksum) 
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![t.date, t.amount, t.transaction_type, t.category, t.note, t.version, t.is_deleted as i32, t.checksum],
                )?;
            } else {
                conn.execute(
                    "INSERT INTO transactions (date, amount, transaction_type, category, note) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![t.date, t.amount, t.transaction_type, t.category, t.note],
                )?;
            }
        }

        for c in data.categories {
            conn.execute(
                "INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![c.name, c.category_type, c.icon, c.color, c.is_default as i32],
            )?;
        }

        Ok(())
    }

    pub fn export_transactions_csv(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<String, AppError> {
        let transactions = self.get_transactions(start_date, end_date)?;

        let mut csv = String::from("日期,类型,金额,分类,备注\n");

        for t in transactions {
            let note = t
                .note
                .unwrap_or_default()
                .replace(",", ";")
                .replace("\n", " ");
            csv.push_str(&format!(
                "{},{},{},{},{}\n",
                t.date, t.transaction_type, t.amount, t.category, note
            ));
        }

        Ok(csv)
    }

    pub fn import_transactions_csv(&self, csv_data: &str) -> Result<i64, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut count = 0i64;

        for line in csv_data.lines().skip(1) {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 4 {
                let date = parts[0].trim();
                let transaction_type = parts[1].trim();
                let amount: f64 = parts[2].trim().parse().unwrap_or(0.0);
                let category = parts[3].trim();
                let note = if parts.len() > 4 {
                    Some(parts[4].trim().to_string())
                } else {
                    None
                };

                conn.execute(
                    "INSERT INTO transactions (date, amount, transaction_type, category, note) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![date, amount, transaction_type, category, note],
                )?;
                count += 1;
            }
        }

        Ok(count)
    }

    // Sync log
    pub fn add_sync_log(&self, status: &str, details: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO sync_log (sync_time, status, details) VALUES (datetime('now'), ?1, ?2)",
            params![status, details],
        )?;

        Ok(())
    }

    pub fn get_last_sync(&self) -> Result<Option<String>, AppError> {
        let conn = self.conn.lock().unwrap();

        let result = conn.query_row(
            "SELECT sync_time FROM sync_log WHERE status = 'success' ORDER BY sync_time DESC LIMIT 1",
            [],
            |row| row.get(0),
        );

        match result {
            Ok(time) => Ok(Some(time)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}
