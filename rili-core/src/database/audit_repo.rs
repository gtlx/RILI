use crate::models::TransactionAudit;
use crate::utils::Error;

impl super::Database {
    pub fn log_transaction_audit(
        &self,
        transaction_id: i64,
        action: &str,
        old_data: Option<&str>,
        new_data: Option<&str>,
    ) -> Result<(), Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO transaction_audit (transaction_id, action, old_data, new_data) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![transaction_id, action, old_data, new_data],
        )?;
        Ok(())
    }

    pub fn get_transaction_audit(&self, limit: i64) -> Result<Vec<TransactionAudit>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, transaction_id, action, old_data, new_data, created_at
             FROM transaction_audit ORDER BY id DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(rusqlite::params![limit], |row| {
            Ok(TransactionAudit {
                id: row.get(0)?,
                transaction_id: row.get(1)?,
                action: row.get(2)?,
                old_data: row.get(3)?,
                new_data: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }
}
