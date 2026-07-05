CREATE TABLE IF NOT EXISTS recurring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    amount REAL NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income', 'expense')),
    category TEXT NOT NULL,
    note TEXT,
    interval TEXT NOT NULL CHECK(interval IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_value INTEGER DEFAULT 1,
    end_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
