use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: Option<i64>,
    pub name: String,
    pub category_type: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_default: bool,
}
