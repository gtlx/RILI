import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

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

export interface SyncMetadata {
  last_sync_version: number;
  last_sync_time: string;
  checksum: string;
}

interface AppState {
  currentView: 'calendar' | 'accounting' | 'notes' | 'settings';
  setCurrentView: (view: AppState['currentView']) => void;
  
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  
  transactions: Transaction[];
  loadTransactions: (startDate: string, endDate: string) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  addTransactionWithReload: (transaction: Transaction, startDate: string, endDate: string) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  
  categories: { income: Category[]; expense: Category[] };
  loadCategories: () => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  
  notes: Note[];
  loadNotes: () => Promise<void>;
  currentNoteContent: string;
  loadNote: (date: string) => Promise<void>;
  saveNote: (date: string, content: string) => Promise<void>;
  deleteNote: (date: string) => Promise<void>;
  
  weeklyAnalysis: WeeklyAnalysis | null;
  monthlyAnalysis: MonthlyAnalysis | null;
  loadWeeklyAnalysis: (year: number, week: number) => Promise<void>;
  loadMonthlyAnalysis: (year: number, month: number) => Promise<void>;
  
  syncConfig: {
    server_url: string;
    username: string;
    password: string;
  };
  setSyncConfig: (config: AppState['syncConfig']) => void;
  syncData: () => Promise<void>;
  syncDataIncremental: () => Promise<void>;
  testSyncConnection: () => Promise<boolean>;
  lastSyncTime: string | null;
  loadLastSyncTime: () => Promise<void>;
  
  syncMetadata: SyncMetadata | null;
  loadSyncMetadata: () => Promise<void>;
  
  validateDataIntegrity: () => Promise<boolean>;
  computeFullChecksum: () => Promise<string>;
  
  exportData: () => Promise<string>;
  importData: (jsonData: string, merge: boolean) => Promise<void>;
  exportTransactionsCsv: (startDate: string, endDate: string) => Promise<string>;
  importTransactionsCsv: (csvData: string) => Promise<number>;
  
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'calendar',
  setCurrentView: (view) => set({ currentView: view }),
  
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  transactions: [],
  loadTransactions: async (startDate, endDate) => {
    const transactions = await invoke<Transaction[]>('get_transactions', { startDate, endDate });
    set({ transactions });
  },
  addTransaction: async (transaction) => {
    await invoke('add_transaction', { transaction });
  },
  addTransactionWithReload: async (transaction: Transaction, startDate: string, endDate: string) => {
    await invoke('add_transaction', { transaction });
    const transactions = await invoke<Transaction[]>('get_transactions', { startDate, endDate });
    set({ transactions });
  },
  updateTransaction: async (transaction) => {
    await invoke('update_transaction', { transaction });
    const { selectedDate } = get();
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    await get().loadTransactions(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  },
  deleteTransaction: async (id) => {
    await invoke('delete_transaction', { id });
    const { selectedDate } = get();
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    await get().loadTransactions(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  },
  
  categories: { income: [], expense: [] },
  loadCategories: async () => {
    const [income, expense] = await Promise.all([
      invoke<Category[]>('get_categories', { categoryType: 'income' }),
      invoke<Category[]>('get_categories', { categoryType: 'expense' })
    ]);
    set({ categories: { income, expense } });
  },
  addCategory: async (category) => {
    await invoke('add_category', { category });
    await get().loadCategories();
  },
  
  notes: [],
  loadNotes: async () => {
    const notes = await invoke<Note[]>('get_all_notes');
    set({ notes });
  },
  currentNoteContent: '',
  loadNote: async (date) => {
    const content = await invoke<string | null>('get_note', { date });
    set({ currentNoteContent: content || '' });
  },
  saveNote: async (date, content) => {
    await invoke('save_note', { date, content });
    await get().loadNotes();
  },
  deleteNote: async (date) => {
    await invoke('delete_note', { date });
    await get().loadNotes();
  },
  
  weeklyAnalysis: null,
  monthlyAnalysis: null,
  loadWeeklyAnalysis: async (year, week) => {
    const analysis = await invoke<WeeklyAnalysis>('get_weekly_analysis', { year, week });
    set({ weeklyAnalysis: analysis });
  },
  loadMonthlyAnalysis: async (year, month) => {
    const analysis = await invoke<MonthlyAnalysis>('get_monthly_analysis', { year, month });
    set({ monthlyAnalysis: analysis });
  },
  
  syncConfig: {
    server_url: '',
    username: '',
    password: '',
  },
  setSyncConfig: (config) => set({ syncConfig: config }),
  syncData: async () => {
    const { syncConfig } = get();
    await invoke('sync_data', { config: syncConfig });
    await get().loadLastSyncTime();
    await get().loadSyncMetadata();
  },
  syncDataIncremental: async () => {
    const { syncConfig } = get();
    await invoke('sync_data_incremental', { config: syncConfig });
    await get().loadLastSyncTime();
    await get().loadSyncMetadata();
  },
  testSyncConnection: async () => {
    const { syncConfig } = get();
    return await invoke<boolean>('test_sync_connection', { config: syncConfig });
  },
  lastSyncTime: null,
  loadLastSyncTime: async () => {
    const time = await invoke<string | null>('get_last_sync_time');
    set({ lastSyncTime: time });
  },
  
  syncMetadata: null,
  loadSyncMetadata: async () => {
    const metadata = await invoke<SyncMetadata>('get_sync_metadata');
    set({ syncMetadata: metadata });
  },
  
  validateDataIntegrity: async () => {
    return await invoke<boolean>('validate_data_integrity');
  },
  computeFullChecksum: async () => {
    return await invoke<string>('compute_full_checksum');
  },
  
  exportData: async () => {
    return await invoke<string>('export_all_data');
  },
  importData: async (jsonData, merge) => {
    await invoke('import_data', { jsonData, merge });
  },
  exportTransactionsCsv: async (startDate, endDate) => {
    return await invoke<string>('export_transactions_csv', { startDate, endDate });
  },
  importTransactionsCsv: async (csvData) => {
    return await invoke<number>('import_transactions_csv', { csvData });
  },
  
  getSetting: async (key) => {
    return await invoke<string | null>('get_setting', { key });
  },
  setSetting: async (key, value) => {
    await invoke('set_setting', { key, value });
  },
}));
