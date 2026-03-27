use crate::db::{AppError, Database, Note, SyncMetadata, Transaction};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio_stream::StreamExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncConfig {
    pub server_url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct IncrementalSyncData {
    version: i64,
    transactions: Vec<Transaction>,
    notes: Vec<Note>,
    checksum: String,
}

pub struct SyncService {
    client: Client,
    db: Arc<Database>,
}

impl SyncService {
    pub fn new(db: Arc<Database>) -> Self {
        SyncService {
            client: Client::new(),
            db,
        }
    }
    
    pub async fn sync(&self, config: &SyncConfig) -> Result<String, String> {
        let data = self.db.export_all_data().map_err(|e| e.to_string())?;
        
        let url = format!("{}/rili-data.json", config.server_url.trim_end_matches('/'));
        
        let response = self.client
            .put(&url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Content-Type", "application/json")
            .body(data.clone())
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Upload failed: {}", response.status()));
        }
        
        let download_url = format!("{}/rili-data.json", config.server_url.trim_end_matches('/'));
        
        if let Ok(response) = self.client
            .get(&download_url)
            .basic_auth(&config.username, Some(&config.password))
            .send()
            .await
        {
            if response.status().is_success() {
                if let Ok(remote_data) = response.text().await {
                    let _ = self.db.import_data(&remote_data, true);
                }
            }
        }
        
        self.sync_notes(config).await?;
        
        let checksum = self.db.compute_full_checksum().map_err(|e| e.to_string())?;
        let metadata = self.db.get_sync_metadata().map_err(|e| e.to_string())?;
        self.db.update_sync_metadata(metadata.last_sync_version + 1, &checksum).map_err(|e| e.to_string())?;
        
        self.db.add_sync_log("success", "Full sync completed successfully").ok();
        
        Ok("Sync completed".to_string())
    }
    
    pub async fn sync_incremental(&self, config: &SyncConfig) -> Result<String, String> {
        let metadata = self.db.get_sync_metadata().map_err(|e| e.to_string())?;
        
        let transactions = self.db.get_transactions_since_version(metadata.last_sync_version)
            .map_err(|e| e.to_string())?;
        
        let notes = self.db.get_notes_since_version(metadata.last_sync_version)
            .map_err(|e| e.to_string())?;
        
        if transactions.is_empty() && notes.is_empty() {
            self.db.add_sync_log("success", "No changes to sync").ok();
            return Ok("No changes to sync".to_string());
        }
        
        let sync_data = IncrementalSyncData {
            version: metadata.last_sync_version + 1,
            transactions: transactions.clone(),
            notes: notes.clone(),
            checksum: String::new(),
        };
        
        let json_data = serde_json::to_string(&sync_data).map_err(|e| e.to_string())?;
        
        let url = format!("{}/rili-incremental/{}.json", 
            config.server_url.trim_end_matches('/'), 
            metadata.last_sync_version + 1
        );
        
        let response = self.client
            .put(&url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Content-Type", "application/json")
            .body(json_data)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Incremental sync upload failed: {}", response.status()));
        }
        
        for note in &notes {
            if !note.is_deleted {
                self.sync_single_note(config, &note).await?;
            }
        }
        
        let full_checksum = self.db.compute_full_checksum().map_err(|e| e.to_string())?;
        self.db.update_sync_metadata(metadata.last_sync_version + 1, &full_checksum)
            .map_err(|e| e.to_string())?;
        
        self.db.add_sync_log("success", &format!("Incremental sync: {} transactions, {} notes", transactions.len(), notes.len())).ok();
        
        Ok(format!("Incremental sync completed: {} transactions, {} notes", transactions.len(), notes.len()))
    }
    
    async fn sync_single_note(&self, config: &SyncConfig, note: &Note) -> Result<(), String> {
        let file_path = std::path::Path::new(&note.file_path);
        if !file_path.exists() {
            return Ok(());
        }
        
        let content = tokio::fs::read_to_string(file_path).await
            .map_err(|e| e.to_string())?;
        
        let url = format!("{}/notes/{}", config.server_url.trim_end_matches('/'), format!("{}.md", note.date));
        
        self.client
            .put(&url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Content-Type", "text/markdown")
            .body(content)
            .send()
            .await
            .map_err(|e| format!("Failed to sync note: {}", e))?;
        
        Ok(())
    }
    
    async fn sync_notes(&self, config: &SyncConfig) -> Result<(), String> {
        let notes_dir = self.db.get_notes_dir();
        
        if let Ok(entries) = tokio::fs::read_dir(&notes_dir).await {
            let mut dir_entries = Vec::new();
            let mut stream = tokio_stream::wrappers::ReadDirStream::new(entries);
            while let Some(entry_result) = stream.next().await {
                if let Ok(entry) = entry_result {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.ends_with(".md") {
                            dir_entries.push(name.to_string());
                        }
                    }
                }
            }
            
            for note_name in dir_entries {
                let note_path = notes_dir.join(&note_name);
                if let Ok(content) = tokio::fs::read_to_string(&note_path).await {
                    let url = format!("{}/notes/{}", config.server_url.trim_end_matches('/'), note_name);
                    
                    let response = self.client
                        .put(&url)
                        .basic_auth(&config.username, Some(&config.password))
                        .header("Content-Type", "text/markdown")
                        .body(content)
                        .send()
                        .await;
                    
                    if let Err(e) = response {
                        log::warn!("Failed to sync note {}: {}", note_name, e);
                    }
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn test_connection(&self, config: &SyncConfig) -> Result<bool, String> {
        let url = config.server_url.trim_end_matches('/');
        
        let response = self.client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Depth", "0")
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;
        
        Ok(response.status().is_success() || response.status().as_u16() == 207)
    }
}
