use rili_core::database::Database;
use rili_core::models::*;
use rili_core::utils::Error;
use std::path::Path;
use std::sync::Arc;

/// 测试辅助：创建临时数据库
fn test_db() -> (tempfile::TempDir, Arc<Database>) {
    let dir = tempfile::tempdir().unwrap();
    let db = Arc::new(Database::open(dir.path()).unwrap());
    (dir, db)
}

mod transaction_tests {
    use super::*;

    #[test]
    fn test_add_transaction() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 100.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: Some("午餐".into()),
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        let id = db.add_transaction(&tx).unwrap();
        assert!(id > 0);

        let txs = db.get_transactions("2026-06-01", "2026-06-30").unwrap();
        assert_eq!(txs.len(), 1);
        assert_eq!(txs[0].amount, 100.0);
        assert_eq!(txs[0].category, "餐饮");
    }

    #[test]
    fn test_update_transaction() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 100.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        let id = db.add_transaction(&tx).unwrap();

        let updated = Transaction {
            id: Some(id),
            date: "2026-06-29".into(),
            amount: 150.0,
            transaction_type: "expense".into(),
            category: "交通".into(),
            note: Some("出租车".into()),
            created_at: None,
            updated_at: None,
            version: 2,
            is_deleted: false,
            checksum: None,
        };
        db.update_transaction(&updated).unwrap();

        let txs = db.get_transactions("2026-06-01", "2026-06-30").unwrap();
        assert_eq!(txs[0].amount, 150.0);
        assert_eq!(txs[0].category, "交通");
    }

    #[test]
    fn test_delete_transaction() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 50.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        let id = db.add_transaction(&tx).unwrap();
        db.delete_transaction(id).unwrap();

        let txs = db.get_transactions("2026-06-01", "2026-06-30").unwrap();
        assert_eq!(txs.len(), 0);
    }

    #[test]
    fn test_transactions_since_version() {
        let (_dir, db) = test_db();
        let tx1 = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 50.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        let id = db.add_transaction(&tx1).unwrap();

        let txs = db.get_transactions_since_version(0).unwrap();
        assert_eq!(txs.len(), 1);

        // 更新后版本号增加
        let updated = Transaction {
            id: Some(id),
            date: "2026-06-29".into(),
            amount: 80.0,
            transaction_type: "expense".into(),
            category: "交通".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 2,
            is_deleted: false,
            checksum: None,
        };
        db.update_transaction(&updated).unwrap();

        let txs = db.get_transactions_since_version(1).unwrap();
        assert_eq!(txs.len(), 1);
        assert!(txs[0].version > 1);
    }
}

mod category_tests {
    use super::*;

    #[test]
    fn test_get_default_categories() {
        let (_dir, db) = test_db();
        let expense = db.get_categories("expense").unwrap();
        assert!(expense.len() >= 7, "应有至少7个默认支出分类");
        let income = db.get_categories("income").unwrap();
        assert!(income.len() >= 3, "应有至少3个默认收入分类");
    }

    #[test]
    fn test_add_custom_category() {
        let (_dir, db) = test_db();
        let cat = Category {
            id: None,
            name: "宠物".into(),
            category_type: "expense".into(),
            icon: Some("pets".into()),
            color: Some("#FF6B6B".into()),
            is_default: false,
        };
        let id = db.add_category(&cat).unwrap();
        assert!(id > 0);

        let cats = db.get_categories("expense").unwrap();
        assert!(cats.iter().any(|c| c.name == "宠物"));
    }
}

mod note_tests {
    use super::*;

    #[test]
    fn test_save_and_get_note() {
        let (_dir, db) = test_db();
        db.save_note("2026-06-29", "# 测试笔记\n\n这是内容")
            .unwrap();

        let content = db.get_note("2026-06-29").unwrap();
        assert!(content.is_some());
        assert!(content.unwrap().contains("测试笔记"));

        let notes = db.get_all_notes().unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].date, "2026-06-29");
    }

    #[test]
    fn test_delete_note() {
        let (_dir, db) = test_db();
        db.save_note("2026-06-29", "内容").unwrap();
        db.delete_note("2026-06-29").unwrap();

        let content = db.get_note("2026-06-29").unwrap();
        assert!(content.is_none());
    }
}

mod analysis_tests {
    use super::*;

    #[test]
    fn test_weekly_analysis() {
        let (_dir, db) = test_db();
        // 添加一些交易
        for i in 1..=5 {
            let tx = Transaction {
                id: None,
                date: format!("2026-06-{:02}", 22 + i),
                amount: 50.0,
                transaction_type: "expense".into(),
                category: "餐饮".into(),
                note: None,
                created_at: None,
                updated_at: None,
                version: 1,
                is_deleted: false,
                checksum: None,
            };
            db.add_transaction(&tx).unwrap();
        }
        let analysis = db.get_weekly_analysis(2026, 26).unwrap();
        assert!(analysis.total_expense > 0.0);
        assert_eq!(analysis.expense_by_category.len(), 1);
    }

    #[test]
    fn test_monthly_analysis() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-15".into(),
            amount: 1000.0,
            transaction_type: "income".into(),
            category: "工资".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        db.add_transaction(&tx).unwrap();

        let analysis = db.get_monthly_analysis(2026, 6).unwrap();
        assert!(analysis.total_income > 0.0);
        assert_eq!(analysis.income_by_category[0].category, "工资");
    }
}

mod export_tests {
    use super::*;

    #[test]
    fn test_export_and_import() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 50.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: Some("午餐".into()),
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        db.add_transaction(&tx).unwrap();

        // 导出
        let json = db.export_system_json().unwrap();
        assert!(json.contains("餐饮"));

        // 导入到新数据库
        let (_dir2, db2) = test_db();
        db2.import_system_json(&json, false).unwrap();

        let txs = db2.get_all_transactions().unwrap();
        assert_eq!(txs.len(), 1);
        assert_eq!(txs[0].amount, 50.0);
    }

    #[test]
    fn test_csv_export() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 50.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        db.add_transaction(&tx).unwrap();

        let csv = db
            .export_accounting_csv("2026-06-01", "2026-06-30")
            .unwrap();
        assert!(csv.contains("餐饮"));
        assert!(csv.contains("50"));
    }

    #[test]
    fn test_data_integrity() {
        let (_dir, db) = test_db();
        let tx = Transaction {
            id: None,
            date: "2026-06-29".into(),
            amount: 50.0,
            transaction_type: "expense".into(),
            category: "餐饮".into(),
            note: None,
            created_at: None,
            updated_at: None,
            version: 1,
            is_deleted: false,
            checksum: None,
        };
        db.add_transaction(&tx).unwrap();

        assert!(db.validate_data_integrity().unwrap());
    }
}

mod settings_tests {
    use super::*;

    #[test]
    fn test_set_and_get() {
        let (_dir, db) = test_db();
        db.set_setting("theme", "dark").unwrap();
        let val = db.get_setting("theme").unwrap();
        assert_eq!(val, Some("dark".into()));
    }

    #[test]
    fn test_get_nonexistent() {
        let (_dir, db) = test_db();
        let val = db.get_setting("nonexistent").unwrap();
        assert_eq!(val, None);
    }
}
