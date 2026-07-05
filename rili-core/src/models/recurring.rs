use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringRule {
    pub id: Option<i64>,
    pub start_date: String,
    pub amount: f64,
    pub transaction_type: String,
    pub category: String,
    pub note: Option<String>,
    pub interval: String,
    pub interval_value: i64,
    pub end_date: Option<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
}
