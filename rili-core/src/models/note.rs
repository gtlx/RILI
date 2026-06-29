use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: Option<i64>,
    pub date: String,
    pub file_path: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub version: i64,
    pub is_deleted: bool,
    pub checksum: Option<String>,
}
