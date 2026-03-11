use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::{NaiveDate, Local, Datelike};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Not found")]
    NotFound,
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
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
            "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)",
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
    
    pub fn get_notes_dir(&self) -> PathBuf {
        self.data_dir.join("notes")
    }
    
    // Transaction methods
    pub fn add_transaction(&self, t: Transaction) -> Result<i64, AppError> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO transactions (date, amount, transaction_type, category, note) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![t.date, t.amount, t.transaction_type, t.category, t.note],
        )?;
        
        Ok(conn.last_insert_rowid())
    }
    
    pub fn update_transaction(&self, t: Transaction) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "UPDATE transactions SET date = ?1, amount = ?2, transaction_type = ?3, category = ?4, note = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = ?6",
            params![t.date, t.amount, t.transaction_type, t.category, t.note, t.id],
        )?;
        
        Ok(())
    }
    
    pub fn delete_transaction(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
        
        Ok(())
    }
    
    pub fn get_transactions(&self, start_date: &str, end_date: &str) -> Result<Vec<Transaction>, AppError> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at 
             FROM transactions WHERE date >= ?1 AND date <= ?2 ORDER BY date DESC"
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
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at 
             FROM transactions ORDER BY date DESC"
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
        
        conn.execute(
            "INSERT OR REPLACE INTO notes (date, file_path, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
            params![date, file_path.to_string_lossy().to_string()],
        )?;
        
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
            "SELECT id, date, file_path, created_at, updated_at FROM notes ORDER BY date DESC"
        )?;
        
        let rows = stmt.query_map([], |row| {
            Ok(Note {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                file_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
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
        
        conn.execute("DELETE FROM notes WHERE date = ?1", params![date])?;
        
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
        
        // Total income/expense this week
        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2",
            params![start_str, end_str],
            |row| row.get(0),
        )?;
        
        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2",
            params![start_str, end_str],
            |row| row.get(0),
        )?;
        
        // Last week totals
        let last_week_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2",
            params![last_start_str, last_end_str],
            |row| row.get(0),
        )?;
        
        let compare_to_last_week = if last_week_expense > 0.0 {
            ((total_expense - last_week_expense) / last_week_expense) * 100.0
        } else {
            0.0
        };
        
        // Income by category
        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2 GROUP BY category"
        )?;
        let income_by_category: Vec<CategoryAmount> = stmt.query_map(params![start_str, end_str], |row| {
            Ok(CategoryAmount {
                category: row.get(0)?,
                amount: row.get(1)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        // Expense by category
        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 GROUP BY category"
        )?;
        let expense_by_category: Vec<CategoryAmount> = stmt.query_map(params![start_str, end_str], |row| {
            Ok(CategoryAmount {
                category: row.get(0)?,
                amount: row.get(1)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        // Daily expense
        let mut daily_expense = Vec::new();
        for i in 0..7 {
            let day = start_date + chrono::Duration::days(i);
            let day_str = day.format("%Y-%m-%d").to_string();
            
            let amount: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date = ?1",
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
        let last_month_start = NaiveDate::from_ymd_opt(last_year, last_month, 1).ok_or(AppError::NotFound)?;
        let last_month_end = if last_month == 12 {
            NaiveDate::from_ymd_opt(last_year + 1, 1, 1).unwrap() - chrono::Duration::days(1)
        } else {
            NaiveDate::from_ymd_opt(last_year, last_month + 1, 1).unwrap() - chrono::Duration::days(1)
        };
        
        let start_str = start_date.format("%Y-%m-%d").to_string();
        let end_str = end_date.format("%Y-%m-%d").to_string();
        let last_start_str = last_month_start.format("%Y-%m-%d").to_string();
        let last_end_str = last_month_end.format("%Y-%m-%d").to_string();
        
        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2",
            params![start_str, end_str],
            |row| row.get(0),
        )?;
        
        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2",
            params![start_str, end_str],
            |row| row.get(0),
        )?;
        
        let last_month_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2",
            params![last_start_str, last_end_str],
            |row| row.get(0),
        )?;
        
        let compare_to_last_month = if last_month_expense > 0.0 {
            ((total_expense - last_month_expense) / last_month_expense) * 100.0
        } else {
            0.0
        };
        
        // Income by category
        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'income' AND date >= ?1 AND date <= ?2 GROUP BY category"
        )?;
        let income_by_category: Vec<CategoryAmount> = stmt.query_map(params![start_str, end_str], |row| {
            Ok(CategoryAmount {
                category: row.get(0)?,
                amount: row.get(1)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        // Expense by category
        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type = 'expense' AND date >= ?1 AND date <= ?2 GROUP BY category"
        )?;
        let expense_by_category: Vec<CategoryAmount> = stmt.query_map(params![start_str, end_str], |row| {
            Ok(CategoryAmount {
                category: row.get(0)?,
                amount: row.get(1)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        // Top categories
        let mut top_categories = expense_by_category.clone();
        top_categories.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap_or(std::cmp::Ordering::Equal));
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
        }
        
        let export_data = ExportData {
            transactions,
            categories: {
                let mut cats = expense_categories;
                cats.extend(income_categories);
                cats
            },
            notes,
            exported_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
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
            conn.execute(
                "INSERT INTO transactions (date, amount, transaction_type, category, note) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![t.date, t.amount, t.transaction_type, t.category, t.note],
            )?;
        }
        
        for c in data.categories {
            conn.execute(
                "INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![c.name, c.category_type, c.icon, c.color, c.is_default as i32],
            )?;
        }
        
        Ok(())
    }
    
    pub fn export_transactions_csv(&self, start_date: &str, end_date: &str) -> Result<String, AppError> {
        let transactions = self.get_transactions(start_date, end_date)?;
        
        let mut csv = String::from("日期,类型,金额,分类,备注\n");
        
        for t in transactions {
            let note = t.note.unwrap_or_default().replace(",", ";").replace("\n", " ");
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
                let note = if parts.len() > 4 { Some(parts[4].trim().to_string()) } else { None };
                
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
