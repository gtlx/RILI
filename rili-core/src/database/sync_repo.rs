use crate::database::Database;
use crate::models::{SyncMetadata, SyncQueueItem};
use crate::utils::Error;

impl Database {
    pub fn add_to_sync_queue(
        &self,
        table_name: &str,
        record_id: i64,
        operation: &str,
    ) -> Result<(), Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO sync_queue (table_name, record_id, operation) VALUES (?1, ?2, ?3)",
            rusqlite::params![table_name, record_id, operation],
        )?;
        Ok(())
    }

    pub fn get_sync_metadata(&self) -> Result<SyncMetadata, Error> {
        let conn = self.conn();
        let last_sync_version: i64 = conn
            .query_row(
                "SELECT value FROM sync_metadata WHERE key='last_sync_version'",
                [],
                |r| r.get::<_, String>(0),
            )
            .map(|v| v.parse().unwrap_or(0))
            .unwrap_or(0);
        let last_sync_time: String = conn
            .query_row(
                "SELECT value FROM sync_metadata WHERE key='last_sync_time'",
                [],
                |r| r.get(0),
            )
            .unwrap_or_default();
        let checksum: String = conn
            .query_row(
                "SELECT value FROM sync_metadata WHERE key='checksum'",
                [],
                |r| r.get(0),
            )
            .unwrap_or_default();
        Ok(SyncMetadata {
            last_sync_version,
            last_sync_time,
            checksum,
        })
    }

    pub fn update_sync_metadata(&self, version: i64, checksum: &str) -> Result<(), Error> {
        let conn = self.conn();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "UPDATE sync_metadata SET value=?1 WHERE key='last_sync_version'",
            rusqlite::params![version.to_string()],
        )?;
        conn.execute(
            "UPDATE sync_metadata SET value=?1 WHERE key='last_sync_time'",
            rusqlite::params![now],
        )?;
        conn.execute(
            "UPDATE sync_metadata SET value=?1 WHERE key='checksum'",
            rusqlite::params![checksum],
        )?;
        Ok(())
    }

    pub fn get_pending_sync_items(&self) -> Result<Vec<SyncQueueItem>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, table_name, record_id, operation, timestamp, processed FROM sync_queue WHERE processed=0 ORDER BY id ASC LIMIT 100"
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
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }

    pub fn mark_sync_items_processed(&self, ids: &[i64]) -> Result<(), Error> {
        let conn = self.conn();
        for id in ids {
            conn.execute(
                "UPDATE sync_queue SET processed=1 WHERE id=?1",
                rusqlite::params![id],
            )?;
        }
        Ok(())
    }

    pub fn add_sync_log(&self, status: &str, details: &str) -> Result<(), Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO sync_log (sync_time, status, details) VALUES (datetime('now'), ?1, ?2)",
            rusqlite::params![status, details],
        )?;
        Ok(())
    }

    pub fn get_last_sync(&self) -> Result<Option<String>, Error> {
        let conn = self.conn();
        match conn.query_row(
            "SELECT sync_time FROM sync_log WHERE status='success' ORDER BY sync_time DESC LIMIT 1",
            [],
            |r| r.get(0),
        ) {
            Ok(t) => Ok(Some(t)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}
