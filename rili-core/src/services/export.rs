use base64::Engine;
use crate::database::Database;
use crate::models::{Category, Note, Transaction};
use crate::utils::{checksum, Error};
use std::io::Write;

// ============================================================
// 三个层面的导入导出
// ============================================================

// ── 系统数据: JSON (完整备份/迁移) ──

impl Database {
    /// 导出系统数据（JSON 格式，含全部交易/分类/笔记元数据）
    pub fn export_system_json(&self) -> Result<String, Error> {
        #[derive(serde::Serialize)]
        struct SystemData {
            transactions: Vec<Transaction>,
            categories: Vec<Category>,
            notes: Vec<Note>,
            exported_at: String,
            version: i64,
            checksum: String,
        }
        let transactions = self.get_all_transactions()?;
        let expense = self.get_categories("expense")?;
        let income = self.get_categories("income")?;
        let notes = self.get_all_notes()?;
        let meta = self.get_sync_metadata()?;
        let data = SystemData {
            transactions,
            categories: {
                let mut c = expense;
                c.extend(income);
                c
            },
            notes,
            exported_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            version: meta.last_sync_version + 1,
            checksum: self.compute_full_checksum()?,
        };
        Ok(serde_json::to_string_pretty(&data)?)
    }

    /// 导入系统数据（JSON 格式），merge=true 合并，false 覆盖
    pub fn import_system_json(&self, json_data: &str, merge: bool) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct SystemData {
            transactions: Vec<Transaction>,
            categories: Vec<Category>,
            notes: Option<Vec<Note>>,
        }
        let data: SystemData = serde_json::from_str(json_data)?;
        let conn = self.conn();
        if !merge {
            conn.execute("DELETE FROM transactions", [])?;
        }
        for t in data.transactions {
            conn.execute(
                "INSERT OR REPLACE INTO transactions (date, amount, transaction_type, category, note, version, is_deleted, checksum) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                rusqlite::params![t.date, t.amount, t.transaction_type, t.category, t.note, t.version, t.is_deleted as i32, t.checksum],
            )?;
        }
        for c in data.categories {
            conn.execute("INSERT OR IGNORE INTO categories (name, category_type, icon, color, is_default) VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![c.name, c.category_type, c.icon, c.color, c.is_default as i32])?;
        }
        // 导入笔记元数据（如果有）
        if let Some(notes) = data.notes {
            for n in notes {
                conn.execute(
                    "INSERT OR REPLACE INTO notes (id, date, file_path, version, is_deleted, checksum, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                    rusqlite::params![n.id, n.date, n.file_path, n.version, n.is_deleted as i32, n.checksum, n.updated_at],
                )?;
            }
        }
        Ok(())
    }

    /// 校验数据完整性
    pub fn validate_data_integrity(&self) -> Result<bool, Error> {
        let txns = self.get_all_transactions()?;
        for t in txns {
            if let Some(ref stored) = t.checksum {
                if !stored.is_empty() {
                    let computed = checksum::transaction_checksum(
                        &t.date,
                        t.amount,
                        &t.transaction_type,
                        &t.category,
                        t.note.as_deref(),
                        t.is_deleted,
                    );
                    if *stored != computed {
                        return Ok(false);
                    }
                }
            }
        }
        Ok(true)
    }

    /// 计算全量校验和
    pub fn compute_full_checksum(&self) -> Result<String, Error> {
        use sha2::{Digest, Sha256};
        let txns = self.get_all_transactions()?;
        let notes = self.get_all_notes()?;
        let mut hasher = Sha256::new();
        for t in txns {
            hasher.update(
                format!(
                    "{}|{}|{}|{}|{}|{}|{}",
                    t.id.unwrap_or(0),
                    t.date,
                    t.amount,
                    t.transaction_type,
                    t.category,
                    t.note.as_deref().unwrap_or(""),
                    t.is_deleted
                )
                .as_bytes(),
            );
        }
        for n in notes {
            hasher.update(format!("{}|{}|{}", n.id.unwrap_or(0), n.date, n.version).as_bytes());
        }
        Ok(format!("{:x}", hasher.finalize()))
    }
}

// ── 记账: CSV (方便导入 Excel/其他软件) ──

impl Database {
    /// 导出记账为 CSV
    pub fn export_accounting_csv(&self, start_date: &str, end_date: &str) -> Result<String, Error> {
        let txns = self.get_transactions(start_date, end_date)?;
        let mut csv = String::from("日期,类型,金额,分类,备注\n");
        for t in txns {
            let note = t
                .note
                .unwrap_or_default()
                .replace(",", ";")
                .replace("\n", " ");
            csv.push_str(&format!(
                "{},{},{},{},{}\n",
                t.date, t.transaction_type, t.amount, t.category, note
            ));
        }
        Ok(csv)
    }

    /// 从 CSV 导入记账，返回导入条数
    pub fn import_accounting_csv(&self, csv_data: &str) -> Result<i64, Error> {
        let conn = self.conn();
        let mut count = 0i64;
        for line in csv_data.lines().skip(1) {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 4 {
                let date = parts[0].trim();
                let tx_type = parts[1].trim();
                let amount: f64 = parts[2].trim().parse().unwrap_or(0.0);
                let category = parts[3].trim();
                let note = if parts.len() > 4 {
                    Some(parts[4].trim().to_string())
                } else {
                    None
                };
                conn.execute("INSERT INTO transactions (date, amount, transaction_type, category, note) VALUES (?1,?2,?3,?4,?5)",
                    rusqlite::params![date, amount, tx_type, category, note])?;
                count += 1;
            }
        }
        Ok(count)
    }
}

// ── 笔记: ZIP (按日期打包为 .md 文件) ──

impl Database {
    /// 导出笔记为 ZIP（base64 编码）
    pub fn export_notes_zip(&self) -> Result<String, Error> {
        use zip::write::SimpleFileOptions;
        let notes = self.get_all_notes()?;
        let mut buffer = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buffer));
            let opts =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
            for note in notes {
                if let Ok(Some(content)) = self.get_note(&note.date) {
                    zip.start_file(&format!("{}.md", note.date), opts)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                    zip.write_all(content.as_bytes())?;
                }
            }
            zip.finish()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        }
        Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
    }

    /// 从 ZIP（base64）导入笔记
    pub fn import_notes_zip(&self, base64_data: &str) -> Result<i64, Error> {
        use std::io::Read;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|e| Error::General(format!("Base64 decode error: {}", e)))?;
        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| Error::General(format!("ZIP parse error: {}", e)))?;
        let mut count = 0i64;
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| Error::General(format!("ZIP entry error: {}", e)))?;
            let name = file.name().to_string();
            if !name.ends_with(".md") {
                continue;
            }
            let date = name.trim_end_matches(".md");
            let mut content = String::new();
            file.read_to_string(&mut content)?;
            self.save_note(date, &content)?;
            count += 1;
        }
        Ok(count)
    }
}
