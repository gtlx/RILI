-- RILI 数据库 schema
-- 与原项目完全兼容

CREATE TABLE IF NOT EXISTS transactions (
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
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category_type TEXT NOT NULL CHECK(category_type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    checksum TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_time TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    operation TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    processed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_version ON transactions(version);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
CREATE INDEX IF NOT EXISTS idx_notes_version ON notes(version);
CREATE INDEX IF NOT EXISTS idx_sync_queue_processed ON sync_queue(processed);

-- 默认分类
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('餐饮', 'expense', 'restaurant', '#EF4444', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('交通', 'expense', 'car', '#F59E0B', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('购物', 'expense', 'shopping', '#8B5CF6', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('教育', 'expense', 'book', '#3B82F6', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('医疗', 'expense', 'hospital', '#EC4899', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('娱乐', 'expense', 'game', '#14B8A6', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('其他', 'expense', 'more', '#6B7280', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('工资', 'income', 'wallet', '#10B981', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('投资', 'income', 'trending_up', '#6366F1', 1);
INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES ('其他收入', 'income', 'plus_circle', '#6B7280', 1);

INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('last_sync_version', '0');
INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('last_sync_time', '');
INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('checksum', '');
