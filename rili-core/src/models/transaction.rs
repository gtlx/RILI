use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: Option<i64>,
    pub date: String,
    pub amount: f64,
    pub transaction_type: String,
    pub category: String,
    pub note: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub version: i64,
    pub is_deleted: bool,
    pub checksum: Option<String>,
}
