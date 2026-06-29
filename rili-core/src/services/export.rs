use crate::database::Database;
use crate::models::{Category, Note, Transaction};
use crate::utils::{checksum, Error};
use std::io::Write;

impl Database {
    pub fn export_all_data(&self) -> Result<String, Error> {
        #[derive(serde::Serialize)]
        struct ExportData {
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
        let data = ExportData {
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

    pub fn import_data(&self, json_data: &str, merge: bool) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct ImportData {
            transactions: Vec<Transaction>,
            categories: Vec<Category>,
        }
        let data: ImportData = serde_json::from_str(json_data)?;
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
        Ok(())
    }

    pub fn export_transactions_csv(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<String, Error> {
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

    pub fn import_transactions_csv(&self, csv_data: &str) -> Result<i64, Error> {
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
                    let filename = format!("{}.md", note.date);
                    zip.start_file(&filename, opts)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                    zip.write_all(content.as_bytes())?;
                }
            }
            zip.finish()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        }
        Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
    }

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
