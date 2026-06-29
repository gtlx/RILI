use crate::database::Database;
use crate::models::Category;
use crate::utils::Error;

impl Database {
    pub fn get_categories(&self, category_type: &str) -> Result<Vec<Category>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, category_type, icon, color, is_default FROM categories WHERE category_type=?1"
        )?;
        let rows = stmt.query_map(rusqlite::params![category_type], |row| {
            Ok(Category {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                category_type: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
                is_default: row.get::<_, i32>(5)? == 1,
            })
        })?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        Ok(v)
    }

    pub fn add_category(&self, c: &Category) -> Result<i64, Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO categories (name, category_type, icon, color, is_default) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![c.name, c.category_type, c.icon, c.color, c.is_default as i32],
        )?;
        Ok(conn.last_insert_rowid())
    }
}
