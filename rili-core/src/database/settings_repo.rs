use crate::database::Database;
use crate::utils::Error;

impl Database {
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, Error> {
        let conn = self.conn();
        match conn.query_row(
            "SELECT value FROM settings WHERE key=?1",
            rusqlite::params![key],
            |row| row.get(0),
        ) {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        )?;
        Ok(())
    }
}
