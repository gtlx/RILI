use crate::database::Database;
use crate::models::Transaction;
use crate::utils::{checksum, Error};

impl Database {
    pub fn add_transaction(&self, t: &Transaction) -> Result<i64, Error> {
        let conn = self.conn();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT INTO transactions (date, amount, transaction_type, category, note, version, is_deleted, checksum, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, '', ?6, ?6)",
            rusqlite::params![t.date, t.amount, t.transaction_type, t.category, t.note, now],
        )?;
        let id = conn.last_insert_rowid();
        let chk = checksum::transaction_checksum(
            t.date.as_str(),
            t.amount,
            t.transaction_type.as_str(),
            t.category.as_str(),
            t.note.as_deref(),
            false,
        );
        conn.execute(
            "UPDATE transactions SET checksum = ?1 WHERE id = ?2",
            rusqlite::params![chk, id],
        )?;
        drop(conn);
        self.add_to_sync_queue("transactions", id, "INSERT")?;
        Ok(id)
    }

    pub fn update_transaction(&self, t: &Transaction) -> Result<(), Error> {
        let conn = self.conn();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let version: i64 = conn.query_row(
            "SELECT version FROM transactions WHERE id = ?1",
            rusqlite::params![t.id],
            |row| row.get(0),
        )?;
        conn.execute(
            "UPDATE transactions SET date=?1, amount=?2, transaction_type=?3, category=?4, note=?5, version=?6, updated_at=?7, checksum='' WHERE id=?8",
            rusqlite::params![t.date, t.amount, t.transaction_type, t.category, t.note, version + 1, now, t.id],
        )?;
        let chk = checksum::transaction_checksum(
            t.date.as_str(),
            t.amount,
            t.transaction_type.as_str(),
            t.category.as_str(),
            t.note.as_deref(),
            false,
        );
        conn.execute(
            "UPDATE transactions SET checksum=?1 WHERE id=?2",
            rusqlite::params![chk, t.id],
        )?;
        drop(conn);
        self.add_to_sync_queue("transactions", t.id.unwrap(), "UPDATE")?;
        Ok(())
    }

    pub fn delete_transaction(&self, id: i64) -> Result<(), Error> {
        let conn = self.conn();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let version: i64 = conn.query_row(
            "SELECT version FROM transactions WHERE id=?1",
            rusqlite::params![id],
            |row| row.get(0),
        )?;
        conn.execute(
            "UPDATE transactions SET is_deleted=1, version=?1, updated_at=?2 WHERE id=?3",
            rusqlite::params![version + 1, now, id],
        )?;
        drop(conn);
        self.add_to_sync_queue("transactions", id, "DELETE")?;
        Ok(())
    }

    pub fn get_transactions(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<Transaction>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at, version, is_deleted, checksum
             FROM transactions WHERE date>=?1 AND date<=?2 AND is_deleted=0 ORDER BY date DESC"
        )?;
        let rows = stmt.query_map(rusqlite::params![start_date, end_date], row_to_tx)?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }

    pub fn get_all_transactions(&self) -> Result<Vec<Transaction>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at, version, is_deleted, checksum
             FROM transactions WHERE is_deleted=0 ORDER BY date DESC"
        )?;
        let rows = stmt.query_map([], row_to_tx)?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }

    pub fn get_transactions_since_version(&self, version: i64) -> Result<Vec<Transaction>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, date, amount, transaction_type, category, note, created_at, updated_at, version, is_deleted, checksum
             FROM transactions WHERE version>?1 ORDER BY version ASC"
        )?;
        let rows = stmt.query_map(rusqlite::params![version], row_to_tx)?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }
}

fn row_to_tx(row: &rusqlite::Row) -> rusqlite::Result<Transaction> {
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
}
