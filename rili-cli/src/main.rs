use clap::{Parser, Subcommand};
use rili_core::models::Transaction;
use rili_core::App;

#[derive(Parser)]
#[command(name = "rili", about = "RILI CLI — 日历记账笔记工具")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// 添加交易记录
    AddTx {
        date: String,
        amount: f64,
        tx_type: String,
        category: String,
        note: Option<String>,
    },
    /// 删除交易记录
    DeleteTx { id: i64 },
    /// 列出交易记录
    ListTx { start: String, end: String },
    /// 列出所有笔记
    ListNotes,
    /// 查看笔记
    ShowNote { date: String },
    /// 查看本周分析
    WeekAnalysis { year: i32, week: u32 },
    /// 查看本月分析
    MonthAnalysis { year: i32, month: u32 },
    /// 设置设置项
    Set { key: String, value: String },
    /// 获取设置项
    Get { key: String },
    /// 导出全部数据 (JSON)
    Export { path: String },
    /// 导入数据 (JSON)
    Import { path: String, merge: bool },
    /// 显示状态
    Status,
}

fn get_data_dir() -> std::path::PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("rili-app")
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    let cli = Cli::parse();
    let data_dir = get_data_dir();
    let app = match App::init(&data_dir) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    };

    let _result: Result<(), Box<dyn std::error::Error>> = match cli.command {
        Commands::AddTx {
            date,
            amount,
            tx_type,
            category,
            note,
        } => {
            let tx = Transaction {
                id: None,
                date,
                amount,
                transaction_type: tx_type,
                category,
                note,
                created_at: None,
                updated_at: None,
                version: 1,
                is_deleted: false,
                checksum: None,
            };
            let id = app.db.add_transaction(&tx)?;
            println!("Added transaction: id={}", id);
            Ok(())
        }
        Commands::DeleteTx { id } => {
            app.db.delete_transaction(id)?;
            println!("Deleted transaction: id={}", id);
            Ok(())
        }
        Commands::ListTx { start, end } => {
            let txs = app.db.get_transactions(&start, &end)?;
            if txs.is_empty() {
                println!("No transactions.");
            } else {
                for t in &txs {
                    println!(
                        "[{}] {} | {} | {:.2} | {}",
                        t.date,
                        t.transaction_type,
                        t.category,
                        t.amount,
                        t.note.as_deref().unwrap_or("")
                    );
                }
            }
            Ok(())
        }
        Commands::ListNotes => {
            let notes = app.db.get_all_notes()?;
            for n in &notes {
                println!("{} - {}", n.date, n.file_path);
            }
            Ok(())
        }
        Commands::ShowNote { date } => {
            match app.db.get_note(&date)? {
                Some(c) => println!("{}", c),
                None => println!("No note for {}", date),
            }
            Ok(())
        }
        Commands::WeekAnalysis { year, week } => {
            let a = app.db.get_weekly_analysis(year, week)?;
            println!(
                "Week {} ({}-{}): Income={:.2}, Expense={:.2}, vs last week={:.1}%",
                week,
                a.week_start,
                a.week_end,
                a.total_income,
                a.total_expense,
                a.compare_to_last_week
            );
            for c in &a.expense_by_category {
                println!("  {}: {:.2}", c.category, c.amount);
            }
            Ok(())
        }
        Commands::MonthAnalysis { year, month } => {
            let a = app.db.get_monthly_analysis(year, month)?;
            println!(
                "{}-{:02}: Income={:.2}, Expense={:.2}",
                a.year, a.month, a.total_income, a.total_expense
            );
            for c in &a.expense_by_category {
                println!("  {}: {:.2}", c.category, c.amount);
            }
            Ok(())
        }
        Commands::Set { key, value } => {
            app.db.set_setting(&key, &value)?;
            println!("Set {} = {}", key, value);
            Ok(())
        }
        Commands::Get { key } => {
            match app.db.get_setting(&key)? {
                Some(v) => println!("{}", v),
                None => println!("(not set)"),
            }
            Ok(())
        }
        Commands::Export { path } => {
            let data = app.db.export_system_json()?;
            std::fs::write(&path, &data)?;
            println!("Exported system data to {}", path);
            Ok(())
        }
        Commands::Import { path, merge } => {
            let data = std::fs::read_to_string(&path)?;
            app.db.import_system_json(&data, merge)?;
            println!("Imported system data from {}", path);
            Ok(())
        }
        Commands::Status => {
            let txs = app.db.get_all_transactions()?;
            let notes = app.db.get_all_notes()?;
            let valid = app.db.validate_data_integrity()?;
            println!("RILI Status");
            println!("===========");
            println!("Data dir: {:?}", data_dir);
            println!("Transactions: {}", txs.len());
            println!("Notes: {}", notes.len());
            println!("Integrity: {}", if valid { "OK" } else { "FAILED" });
            Ok(())
        }
    };

    if let Err(e) = _result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_add_tx_parsing() {
        let cli = Cli::try_parse_from(["rili", "add-tx", "2026-07-01", "50.0", "expense", "餐饮", "午餐"]);
        assert!(cli.is_ok());
        match cli.unwrap().command {
            Commands::AddTx { date, amount, tx_type, category, note } => {
                assert_eq!(date, "2026-07-01");
                assert!((amount - 50.0).abs() < 1e-10);
                assert_eq!(tx_type, "expense");
                assert_eq!(category, "餐饮");
                assert_eq!(note, Some("午餐".to_string()));
            }
            _ => panic!("expected AddTx"),
        }
    }

    #[test]
    fn test_cli_list_tx_parsing() {
        let cli = Cli::try_parse_from(["rili", "list-tx", "2026-01-01", "2026-12-31"]);
        assert!(cli.is_ok());
        match cli.unwrap().command {
            Commands::ListTx { start, end } => {
                assert_eq!(start, "2026-01-01");
                assert_eq!(end, "2026-12-31");
            }
            _ => panic!("expected ListTx"),
        }
    }

    #[test]
    fn test_cli_export_parsing() {
        let path = std::env::temp_dir().join("backup.json");
        let path_str = path.to_string_lossy().to_string();
        let cli = Cli::try_parse_from(["rili", "export", &path_str]);
        assert!(cli.is_ok());
        match cli.unwrap().command {
            Commands::Export { path: p } => assert_eq!(p, path_str),
            _ => panic!("expected Export"),
        }
    }
}
