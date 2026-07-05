CREATE TABLE IF NOT EXISTS transaction_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data TEXT,
    new_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
