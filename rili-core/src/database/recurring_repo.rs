use chrono::Datelike;

use crate::database::Database;
use crate::models::RecurringRule;
use crate::utils::Error;

impl Database {
    pub fn add_recurring_rule(&self, r: &RecurringRule) -> Result<i64, Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO recurring_rules (start_date, amount, transaction_type, category, note, interval, interval_value, end_date, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![r.start_date, r.amount, r.transaction_type, r.category, r.note,
                r.interval, r.interval_value, r.end_date, r.is_active as i32],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_recurring_rule(&self, r: &RecurringRule) -> Result<(), Error> {
        let conn = self.conn();
        conn.execute(
            "UPDATE recurring_rules SET start_date=?1, amount=?2, transaction_type=?3, category=?4, note=?5, interval=?6, interval_value=?7, end_date=?8, is_active=?9 WHERE id=?10",
            rusqlite::params![r.start_date, r.amount, r.transaction_type, r.category, r.note,
                r.interval, r.interval_value, r.end_date, r.is_active as i32, r.id],
        )?;
        Ok(())
    }

    pub fn delete_recurring_rule(&self, id: i64) -> Result<(), Error> {
        let conn = self.conn();
        conn.execute("DELETE FROM recurring_rules WHERE id=?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn get_recurring_rules(&self) -> Result<Vec<RecurringRule>, Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, start_date, amount, transaction_type, category, note, interval, interval_value, end_date, is_active, created_at
             FROM recurring_rules WHERE is_active=1 ORDER BY start_date"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(RecurringRule {
                id: Some(row.get(0)?),
                start_date: row.get(1)?,
                amount: row.get(2)?,
                transaction_type: row.get(3)?,
                category: row.get(4)?,
                note: row.get(5)?,
                interval: row.get(6)?,
                interval_value: row.get(7)?,
                end_date: row.get(8)?,
                is_active: row.get::<_, i32>(9)? == 1,
                created_at: row.get(10)?,
            })
        })?;
        let mut v = Vec::new();
        for r in rows { v.push(r?); }
        Ok(v)
    }

    pub fn generate_recurring_transactions(&self, end_date: &str) -> Result<i64, Error> {
        use chrono::NaiveDate;
        let rules = self.get_recurring_rules()?;
        let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
            .map_err(|e| Error::General(e.to_string()))?;
        let conn = self.conn();
        let mut count = 0i64;

        for rule in rules {
            let start = NaiveDate::parse_from_str(&rule.start_date, "%Y-%m-%d")
                .map_err(|e| Error::General(e.to_string()))?;
            let mut current = start;
            let rule_end = rule.end_date.as_ref().and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

            while current <= end {
                if let Some(re) = rule_end { if current > re { break; } }
                // skip start date itself (original rule)
                if current != start {
                    let date_str = current.format("%Y-%m-%d").to_string();
                    // check if already generated
                    let exists: bool = conn.query_row(
                        "SELECT COUNT(*) FROM transactions WHERE date=?1 AND amount=?2 AND category=?3 AND transaction_type=?4 AND note IS ?5 AND is_deleted=0",
                        rusqlite::params![date_str, rule.amount, rule.category, rule.transaction_type, rule.note],
                        |row| row.get::<_, i64>(0),
                    ).map(|c| c > 0).unwrap_or(false);

                    if !exists {
                        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        conn.execute(
                            "INSERT INTO transactions (date, amount, transaction_type, category, note, version, is_deleted, checksum, created_at, updated_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, '', ?6, ?6)",
                            rusqlite::params![date_str, rule.amount, rule.transaction_type, rule.category, rule.note, now],
                        )?;
                        count += 1;
                    }
                }
                // advance date based on interval
                match rule.interval.as_str() {
                    "daily" => { current = current + chrono::Duration::days(rule.interval_value); }
                    "weekly" => { current = current + chrono::Duration::weeks(rule.interval_value as i64); }
                    "monthly" => {
                        let m = current.month() as i64 + rule.interval_value;
                        let y = current.year() + (m.div_euclid(12) - if m % 12 == 0 { 1 } else { 0 }) as i32;
                        let m = ((m - 1) % 12 + 1) as u32;
                        let d = current.day().min(num_days_in_month(y, m));
                        current = NaiveDate::from_ymd_opt(y, m, d).unwrap_or(current);
                    }
                    "yearly" => {
                        current = NaiveDate::from_ymd_opt(current.year() + rule.interval_value as i32, current.month(), current.day())
                            .unwrap_or(current);
                    }
                    _ => {}
                }
            }
        }
        Ok(count)
    }
}

fn num_days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 29 } else { 28 },
        _ => 30,
    }
}
