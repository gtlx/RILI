use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyAnalysis {
    pub week_start: String,
    pub week_end: String,
    pub total_income: f64,
    pub total_expense: f64,
    pub income_by_category: Vec<CategoryAmount>,
    pub expense_by_category: Vec<CategoryAmount>,
    pub daily_expense: Vec<DailyAmount>,
    pub compare_to_last_week: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyAnalysis {
    pub month: String,
    pub year: i32,
    pub total_income: f64,
    pub total_expense: f64,
    pub income_by_category: Vec<CategoryAmount>,
    pub expense_by_category: Vec<CategoryAmount>,
    pub compare_to_last_month: f64,
    pub top_categories: Vec<CategoryAmount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryAmount {
    pub category: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyAmount {
    pub date: String,
    pub amount: f64,
}
