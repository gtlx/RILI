use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionAudit {
    pub id: i64,
    pub transaction_id: i64,
    pub action: String,
    pub old_data: Option<String>,
    pub new_data: Option<String>,
    pub created_at: String,
}
