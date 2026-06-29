use crate::database::Database;
use crate::models::SyncConfig;
use crate::utils::Error;
use std::sync::Arc;

pub struct SyncService {
    pub db: Arc<Database>,
    client: reqwest::blocking::Client,
}

impl SyncService {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            client: reqwest::blocking::Client::new(),
        }
    }

    pub fn sync(&self, config: &SyncConfig) -> Result<String, Error> {
        // 全量同步
        let data = self.db.export_all_data()?;
        let url = format!("{}/rili-data.json", config.server_url.trim_end_matches('/'));
        let resp = self
            .client
            .put(&url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Content-Type", "application/json")
            .body(data)
            .send()?;
        if !resp.status().is_success() {
            return Err(Error::Sync(format!("Upload failed: {}", resp.status())));
        }
        // 下载
        let dl_url = format!("{}/rili-data.json", config.server_url.trim_end_matches('/'));
        if let Ok(resp) = self
            .client
            .get(&dl_url)
            .basic_auth(&config.username, Some(&config.password))
            .send()
        {
            if let Ok(text) = resp.text() {
                let _ = self.db.import_data(&text, true);
            }
        }
        let checksum = self.db.compute_full_checksum()?;
        let meta = self.db.get_sync_metadata()?;
        self.db
            .update_sync_metadata(meta.last_sync_version + 1, &checksum)?;
        self.db.add_sync_log("success", "Full sync completed")?;
        Ok("Sync completed".to_string())
    }

    pub fn sync_incremental(&self, config: &SyncConfig) -> Result<String, Error> {
        let meta = self.db.get_sync_metadata()?;
        let transactions = self
            .db
            .get_transactions_since_version(meta.last_sync_version)?;
        let notes = self.db.get_notes_since_version(meta.last_sync_version)?;
        if transactions.is_empty() && notes.is_empty() {
            self.db.add_sync_log("success", "No changes")?;
            return Ok("No changes".to_string());
        }
        let sync_data = serde_json::json!({
            "version": meta.last_sync_version + 1,
            "transactions": transactions,
            "notes": notes,
            "checksum": "",
        });
        let url = format!(
            "{}/rili-incremental/{}.json",
            config.server_url.trim_end_matches('/'),
            meta.last_sync_version + 1
        );
        self.client
            .put(&url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&sync_data)?)
            .send()?;
        let checksum = self.db.compute_full_checksum()?;
        self.db
            .update_sync_metadata(meta.last_sync_version + 1, &checksum)?;
        self.db.add_sync_log(
            "success",
            &format!(
                "Incremental sync: {} tx, {} notes",
                transactions.len(),
                notes.len()
            ),
        )?;
        Ok(format!(
            "Synced: {} transactions, {} notes",
            transactions.len(),
            notes.len()
        ))
    }

    pub fn test_connection(&self, config: &SyncConfig) -> Result<bool, Error> {
        let url = config.server_url.trim_end_matches('/');
        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Depth", "0")
            .send()?;
        Ok(resp.status().is_success() || resp.status().as_u16() == 207)
    }
}
