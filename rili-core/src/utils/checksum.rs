use sha2::{Digest, Sha256};

pub fn compute(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn transaction_checksum(
    date: &str,
    amount: f64,
    tx_type: &str,
    category: &str,
    note: Option<&str>,
    is_deleted: bool,
) -> String {
    compute(&format!(
        "{}|{}|{}|{}|{}|{}",
        date,
        amount,
        tx_type,
        category,
        note.unwrap_or(""),
        is_deleted
    ))
}
