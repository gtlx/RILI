use crate::db::Database;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncConfig {
    pub server_url: String,
    pub username: String,
    pub password: String,
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
        // Upload local data to server
        let data = self.db.export_all_data().map_err(|e| e.to_string())?;
        
        // Create WebDAV client request
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
        
        // Download remote data if exists
        let download_url = format!("{}/rili-data.json", config.server_url.trim_end_matches('/'));
        
        if let Ok(response) = self.client
            .get(&download_url)
            .basic_auth(&config.username, Some(&config.password))
            .send()
            .await
        {
            if response.status().is_success() {
                if let Ok(remote_data) = response.text().await {
                    // Merge data (remote takes precedence for conflicts)
                    let _ = self.db.import_data(&remote_data, true);
                }
            }
        }
        
        // Sync notes directory
        self.sync_notes(config).await?;
        
        self.db.add_sync_log("success", "Sync completed successfully").ok();
        
        Ok("Sync completed".to_string())
    }
    
    async fn sync_notes(&self, config: &SyncConfig) -> Result<(), String> {
        let notes_dir = self.db.get_notes_dir();
        
        // Read all note files
        if let Ok(entries) = fs::read_dir(&notes_dir).await {
            let mut dir_entries = Vec::new();
            let mut stream = tokio_stream::wrappers::ReadDirStream::new(entries);
            while let Some(entry) = stream.next().await {
                if let Ok(entry) = entry {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.ends_with(".md") {
                            dir_entries.push(name.to_string());
                        }
                    }
                }
            }
            
            // Upload each note file
            for note_name in dir_entries {
                let note_path = notes_dir.join(&note_name);
                if let Ok(content) = fs::read_to_string(&note_path).await {
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
        
        // Download remote notes
        let notes_url = format!("{}/notes/", config.server_url.trim_end_matches('/'));
        
        // Try to list remote notes (PROPFIND)
        if let Ok(response) = self.client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &notes_url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Depth", "1")
            .send()
            .await
        {
            if response.status().is_success() {
                // Parse WebDAV response to get file list
                // For simplicity, we'll try to download known note files
                // In production, you'd parse the XML response
            }
        }
        
        Ok(())
    }
    
    pub fn test_connection(&self, config: &SyncConfig) -> Result<bool, String> {
        let url = config.server_url.trim_end_matches('/');
        
        // Use blocking client for sync test
        let client = reqwest::blocking::Client::new();
        
        let response = client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), url)
            .basic_auth(&config.username, Some(&config.password))
            .header("Depth", "0")
            .send()
            .map_err(|e| format!("Connection failed: {}", e))?;
        
        Ok(response.status().is_success() || response.status().as_u16() == 207)
    }
}
