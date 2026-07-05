export interface Transaction {
  id?: number;
  date: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  is_deleted?: boolean;
  checksum?: string;
}

export interface Category {
  id?: number;
  name: string;
  category_type: string;
  icon?: string;
  color?: string;
  is_default: boolean;
}

export interface Note {
  id?: number;
  date: string;
  file_path: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  is_deleted?: boolean;
  checksum?: string;
}

export interface WeeklyAnalysis {
  week_start: string;
  week_end: string;
  total_income: number;
  total_expense: number;
  income_by_category: { category: string; amount: number }[];
  expense_by_category: { category: string; amount: number }[];
  daily_expense: { date: string; amount: number }[];
  compare_to_last_week: number;
}

export interface MonthlyAnalysis {
  month: string;
  year: number;
  total_income: number;
  total_expense: number;
  income_by_category: { category: string; amount: number }[];
  expense_by_category: { category: string; amount: number }[];
  compare_to_last_month: number;
  top_categories: { category: string; amount: number }[];
}

export interface RecurringRule {
  id?: number;
  start_date: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category: string;
  note?: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval_value: number;
  end_date?: string;
  is_active: boolean;
  created_at?: string;
}

export interface SyncConfig {
  server_url: string;
  username: string;
  password: string;
}

export interface SyncMetadata {
  last_sync_version: number;
  last_sync_time: string;
  checksum: string;
}

export type ViewType = 'calendar' | 'accounting' | 'notes' | 'settings';
export type Theme = 'light' | 'dark' | 'system';

export interface TransactionAudit {
  id: number;
  transaction_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: string | null;
  new_data: string | null;
  created_at: string;
}

export interface BackendAdapter {
  // Transactions
  addTransaction(transaction: Transaction): Promise<number>;
  updateTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: number): Promise<void>;
  getTransactions(startDate: string, endDate: string): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsSinceVersion(version: number): Promise<Transaction[]>;

  // Categories
  getCategories(categoryType: string): Promise<Category[]>;
  addCategory(category: Category): Promise<number>;

  // Notes
  saveNote(date: string, content: string): Promise<void>;
  getNote(date: string): Promise<string | null>;
  getAllNotes(): Promise<Note[]>;
  getNotesSinceVersion(version: number): Promise<Note[]>;
  deleteNote(date: string): Promise<void>;

  // Analysis
  getWeeklyAnalysis(year: number, week: number): Promise<WeeklyAnalysis>;
  getMonthlyAnalysis(year: number, month: number): Promise<MonthlyAnalysis>;

  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Sync
  syncData(config: SyncConfig): Promise<string>;
  syncDataIncremental(config: SyncConfig): Promise<string>;
  testSyncConnection(config: SyncConfig): Promise<boolean>;
  getLastSyncTime(): Promise<string | null>;
  getSyncMetadata(): Promise<SyncMetadata>;

  // ── 系统数据: JSON（备份/迁移）──
  exportSystemJson(): Promise<string>;
  importSystemJson(jsonData: string, merge: boolean): Promise<void>;
  validateDataIntegrity(): Promise<boolean>;
  computeFullChecksum(): Promise<string>;

  // ── 记账: CSV（导入其他软件分析）──
  exportAccountingCsv(startDate: string, endDate: string): Promise<string>;
  importAccountingCsv(csvData: string): Promise<number>;

  // ── 笔记: ZIP──
  exportNotesZip(): Promise<string>;
  importNotesZip(base64Data: string): Promise<number>;

  // ── 周期交易 ──
  addRecurringRule(rule: RecurringRule): Promise<number>;
  updateRecurringRule(rule: RecurringRule): Promise<void>;
  deleteRecurringRule(id: number): Promise<void>;
  getRecurringRules(): Promise<RecurringRule[]>;
  generateRecurringTransactions(endDate: string): Promise<number>;

  // ── 笔记 Git 同步 ──
  gitInit(): Promise<void>;
  gitCommit(message: string): Promise<void>;
  gitLog(maxCount: number): Promise<string[]>;
  gitSetRemote(url: string): Promise<void>;
  gitRemoveRemote(): Promise<void>;
  gitGetRemoteUrl(): Promise<string | null>;
  gitPush(): Promise<string>;
  gitPull(): Promise<string>;

  // ── 交易审计 ──
  getTransactionAudit(limit: number): Promise<TransactionAudit[]>;

  // 文件保存（跨平台：Tauri 用对话框，浏览器用下载）
  saveFileDialog(content: string, filename: string, mimeType: string): Promise<void>;
}
