use crate::database::Database;
use crate::models::Note;
use crate::utils::{checksum, Error};

impl Database {
    pub fn save_note(&self, date: &str, content: &str) -> Result<(), Error> {
        let file_path = self.notes_dir().join(format!("{}.md", date));
        std::fs::write(&file_path, content)?;

        let conn = self.conn();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let chk = checksum::compute(content);
        conn.execute(
            "INSERT OR REPLACE INTO notes (date, file_path, version, is_deleted, checksum, updated_at)
             VALUES (?1, ?2, COALESCE((SELECT version+1 FROM notes WHERE date=?1), 1), 0, ?3, ?4)",
            rusqlite::params![date, file_path.to_string_lossy().to_string(), chk, now],
        )?;
        let id = conn.last_insert_rowid();
        drop(conn);
        self.add_to_sync_queue("notes", id, "INSERT")?;
        Ok(())
    }

    pub fn get_note(&self, date: &str) -> Result<Option<String>, Error> {
        let file_path = self.notes_dir().join(format!("{}.md", date));
        if file_path.exists() {
            Ok(Some(std::fs::read_to_string(&file_path)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_all_notes(&self) -> Result<Vec<Note>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, date, file_path, created_at, updated_at, version, is_deleted, checksum
             FROM notes WHERE is_deleted=0 ORDER BY date DESC",
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
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }

    pub fn get_notes_since_version(&self, version: i64) -> Result<Vec<Note>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, date, file_path, created_at, updated_at, version, is_deleted, checksum
             FROM notes WHERE version>?1 ORDER BY version ASC",
        )?;
        let rows = stmt.query_map(rusqlite::params![version], |row| {
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
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }

    pub fn delete_note(&self, date: &str) -> Result<(), Error> {
        let file_path = self.notes_dir().join(format!("{}.md", date));
        if file_path.exists() {
            std::fs::remove_file(&file_path)?;
        }
        let conn = self.conn();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let version: i64 = conn
            .query_row(
                "SELECT version FROM notes WHERE date=?1",
                rusqlite::params![date],
                |row| row.get(0),
            )
            .unwrap_or(1);
        conn.execute(
            "UPDATE notes SET is_deleted=1, version=?1, updated_at=?2 WHERE date=?3",
            rusqlite::params![version + 1, now, date],
        )?;
        drop(conn);
        self.add_to_sync_queue("notes", 0, "DELETE")?;
        Ok(())
    }
}
