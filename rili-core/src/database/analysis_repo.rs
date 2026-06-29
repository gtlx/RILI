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

        let s = |date| date.format("%Y-%m-%d").to_string();
        let (start_str, end_str, last_s, last_e) = (s(start), s(end), s(last_start), s(last_end));

        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='income' AND date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![start_str, end_str], |r| r.get(0)
        )?;
        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![start_str, end_str], |r| r.get(0)
        )?;
        let last_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![last_s, last_e], |r| r.get(0)
        )?;

        Ok(WeeklyAnalysis {
            week_start: start_str.clone(),
            week_end: end_str.clone(),
            total_income,
            total_expense,
            income_by_category: Self::sum_by_category(&conn, "income", &start_str, &end_str),
            expense_by_category: Self::sum_by_category(&conn, "expense", &start_str, &end_str),
            daily_expense: {
                let mut d = Vec::new();
                for i in 0..7 {
                    let day = (start + chrono::Duration::days(i))
                        .format("%Y-%m-%d")
                        .to_string();
                    let amt: f64 = conn.query_row(
                        "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date=?1 AND is_deleted=0",
                        rusqlite::params![day], |r| r.get(0)
                    )?;
                    d.push(DailyAmount {
                        date: day,
                        amount: amt,
                    });
                }
                d
            },
            compare_to_last_week: if last_expense > 0.0 {
                ((total_expense - last_expense) / last_expense) * 100.0
            } else {
                0.0
            },
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
        let (lm, ly) = if month == 1 {
            (12, year - 1)
        } else {
            (month - 1, year)
        };
        let last_start = NaiveDate::from_ymd_opt(ly, lm, 1).unwrap();
        let last_end = if lm == 12 {
            NaiveDate::from_ymd_opt(ly + 1, 1, 1).unwrap() - chrono::Duration::days(1)
        } else {
            NaiveDate::from_ymd_opt(ly, lm + 1, 1).unwrap() - chrono::Duration::days(1)
        };

        let s = |d| d.format("%Y-%m-%d").to_string();
        let (ss, es, ls, le) = (s(start), s(end), s(last_start), s(last_end));

        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='income' AND date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![ss, es], |r| r.get(0)
        )?;
        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![ss, es], |r| r.get(0)
        )?;
        let last_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE transaction_type='expense' AND date>=?1 AND date<=?2 AND is_deleted=0",
            rusqlite::params![ls, le], |r| r.get(0)
        )?;

        let mut top = Self::sum_by_category(&conn, "expense", &ss, &es);
        top.sort_by(|a, b| {
            b.amount
                .partial_cmp(&a.amount)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        top.truncate(5);

        Ok(MonthlyAnalysis {
            month: format!("{:02}", month),
            year,
            total_income,
            total_expense,
            income_by_category: Self::sum_by_category(&conn, "income", &ss, &es),
            expense_by_category: Self::sum_by_category(&conn, "expense", &ss, &es),
            compare_to_last_month: if last_expense > 0.0 {
                ((total_expense - last_expense) / last_expense) * 100.0
            } else {
                0.0
            },
            top_categories: top,
        })
    }

    fn sum_by_category(
        conn: &rusqlite::Connection,
        tx_type: &str,
        start: &str,
        end: &str,
    ) -> Vec<CategoryAmount> {
        let mut stmt = conn.prepare(
            "SELECT category, SUM(amount) FROM transactions WHERE transaction_type=?1 AND date>=?2 AND date<=?3 AND is_deleted=0 GROUP BY category"
        ).unwrap();
        stmt.query_map(rusqlite::params![tx_type, start, end], |row| {
            Ok(CategoryAmount {
                category: row.get(0)?,
                amount: row.get(1)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }
}
