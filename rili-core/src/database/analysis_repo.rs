use crate::database::Database;
use crate::models::{CategoryAmount, DailyAmount, MonthlyAnalysis, WeeklyAnalysis};
use crate::utils::Error;
use chrono::NaiveDate;

impl Database {
    pub fn get_weekly_analysis(&self, year: i32, week: u32) -> Result<WeeklyAnalysis, Error> {
        let conn = self.conn();
        let start = NaiveDate::from_isoywd_opt(year, week, chrono::Weekday::Mon)
            .ok_or_else(|| Error::NotFound("Invalid week".into()))?;
        let end = start + chrono::Duration::days(6);
        let last_start = start - chrono::Duration::days(7);
        let last_end = start - chrono::Duration::days(1);

        let s = |d: NaiveDate| d.format("%Y-%m-%d").to_string();
        let (ss, es, ls, le) = (s(start), s(end), s(last_start), s(last_end));

        // 一次查询本周收入/支出 + 上周支出
        let (total_income, total_expense, last_expense): (f64, f64, f64) = conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END), 0),
                (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date>=?3 AND date<=?4 AND is_deleted=0)
             FROM transactions WHERE date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![ss, es, ls, le],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

        let daily_expense: Vec<DailyAmount> = {
            let mut stmt = conn.prepare(
                "SELECT date, COALESCE(SUM(amount),0) FROM transactions
                 WHERE transaction_type='expense' AND date>=?1 AND date<=?2 AND is_deleted=0
                 GROUP BY date ORDER BY date ASC"
            )?;
            let rows = stmt.query_map(rusqlite::params![ss, es], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
            })?;
            let mut map: std::collections::HashMap<String, f64> = rows.filter_map(|r| r.ok()).collect();
            let mut daily = Vec::new();
            for i in 0..7 {
                let day = s(start + chrono::Duration::days(i));
                let amt = map.remove(&day).unwrap_or(0.0);
                daily.push(DailyAmount { date: day, amount: amt });
            }
            daily
        };

        Ok(WeeklyAnalysis {
            week_start: ss.clone(), week_end: es.clone(),
            total_income, total_expense,
            income_by_category: Self::sum_by_category(&conn, "income", &ss, &es),
            expense_by_category: Self::sum_by_category(&conn, "expense", &ss, &es),
            daily_expense,
            compare_to_last_week: if last_expense > 0.0 { ((total_expense - last_expense) / last_expense) * 100.0 } else { 0.0 },
        })
    }

    pub fn get_monthly_analysis(&self, year: i32, month: u32) -> Result<MonthlyAnalysis, Error> {
        let conn = self.conn();
        let start = NaiveDate::from_ymd_opt(year, month, 1)
            .ok_or_else(|| Error::NotFound("Invalid date".into()))?;
        let end = if month == 12 {
            NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap() - chrono::Duration::days(1)
        } else {
            NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap() - chrono::Duration::days(1)
        };
        let (lm, ly) = if month == 1 { (12, year - 1) } else { (month - 1, year) };
        let ls = NaiveDate::from_ymd_opt(ly, lm, 1).unwrap();
        let le = if lm == 12 {
            NaiveDate::from_ymd_opt(ly + 1, 1, 1).unwrap() - chrono::Duration::days(1)
        } else {
            NaiveDate::from_ymd_opt(ly, lm + 1, 1).unwrap() - chrono::Duration::days(1)
        };

        let s = |d: NaiveDate| d.format("%Y-%m-%d").to_string();
        let (ss, es, lss, les) = (s(start), s(end), s(ls), s(le));

        // 一次查询本月收入/支出 + 上月支出
        let (total_income, total_expense, last_expense): (f64, f64, f64) = conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END), 0),
                (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date>=?3 AND date<=?4 AND is_deleted=0)
             FROM transactions WHERE date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![ss, es, lss, les],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

        let mut top = Self::sum_by_category(&conn, "expense", &ss, &es);
        top.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap_or(std::cmp::Ordering::Equal));
        top.truncate(5);

        Ok(MonthlyAnalysis {
            month: format!("{:02}", month), year,
            total_income, total_expense,
            income_by_category: Self::sum_by_category(&conn, "income", &ss, &es),
            expense_by_category: Self::sum_by_category(&conn, "expense", &ss, &es),
            compare_to_last_month: if last_expense > 0.0 { ((total_expense - last_expense) / last_expense) * 100.0 } else { 0.0 },
            top_categories: top,
        })
    }

    fn sum_by_category(conn: &rusqlite::Connection, tx_type: &str, start: &str, end: &str) -> Vec<CategoryAmount> {
        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions
             WHERE transaction_type=?1 AND date>=?2 AND date<=?3 AND is_deleted=0
             GROUP BY category ORDER BY SUM(amount) DESC"
        ).unwrap();
        stmt.query_map(rusqlite::params![tx_type, start, end], |row| {
            Ok(CategoryAmount { category: row.get(0)?, amount: row.get(1)? })
        }).unwrap().filter_map(|r| r.ok()).collect()
    }
}
