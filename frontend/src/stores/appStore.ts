import { create } from 'zustand';
import { backend, getAccountingBackend } from '../api';
import type { Transaction, Category, Note, WeeklyAnalysis, MonthlyAnalysis, SyncMetadata, ViewType, Theme, AccountInfo } from '../api/backend';
export type { WeeklyAnalysis, MonthlyAnalysis, Theme };

/**
 * 记账后端:bill 云端(默认)或本地。
 * 记账相关操作(交易/分类/分析)统一走 getAccountingBackend(),
 * 日历/笔记/设置等非记账功能仍走本地 backend,互不干扰。
 */
const accountingBackend = () => getAccountingBackend();

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  loadTheme: () => Promise<void>;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  detailDate: string | null;
  setDetailDate: (date: string | null) => void;
  transactions: Transaction[];
  loadTransactions: (startDate: string, endDate: string) => Promise<void>;
  /** 记账后端错误提示(bill 不可达时置中文信息,界面显示友好提示,避免白屏) */
  accountingError: string | null;
  clearAccountingError: () => void;
  addTransaction: (transaction: Transaction) => Promise<void>;
  addTransactionWithReload: (transaction: Transaction, startDate: string, endDate: string) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  categories: { income: Category[]; expense: Category[] };
  loadCategories: () => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  /** 记账账户列表(记账界面「账户」下拉;bill 云端返回真实账户,本地后端默认/空) */
  accounts: AccountInfo[];
  loadAccounts: () => Promise<void>;
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
  syncConfig: { server_url: string; username: string; password: string };
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
  importSystemJson: (jsonData: string, merge: boolean) => Promise<void>;
  exportAccountingCsv: (startDate: string, endDate: string) => Promise<string>;
  importAccountingCsv: (csvData: string) => Promise<number>;
  exportNotesZip: () => Promise<string>;
  importNotesZip: (base64Data: string) => Promise<number>;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'calendar',
  setCurrentView: (view) => set({ currentView: view }),

  theme: 'system',
  setTheme: async (theme) => {
    await backend.setSetting('theme', theme);
    set({ theme });
    applyTheme(theme);
  },
  loadTheme: async () => {
    const saved = await backend.getSetting('theme');
    const theme = (saved as Theme) || 'system';
    set({ theme });
    applyTheme(theme);
  },

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  detailDate: null,
  setDetailDate: (date) => set({ detailDate: date }),

  transactions: [],
  loadTransactions: async (startDate, endDate) => {
    try {
      const transactions = await accountingBackend().getTransactions(startDate, endDate);
      set({ transactions, accountingError: null });
    } catch (e) {
      // bill 不可达:记录错误供界面提示,数据置空(日历/笔记功能不受影响)
      console.warn('[appStore] loadTransactions 失败:', e);
      set({ transactions: [], accountingError: String(e) });
    }
  },
  accountingError: null,
  clearAccountingError: () => set({ accountingError: null }),
  addTransaction: async (transaction) => { await accountingBackend().addTransaction(transaction); },
  addTransactionWithReload: async (transaction, startDate, endDate) => {
    try {
      await accountingBackend().addTransaction(transaction);
      const transactions = await accountingBackend().getTransactions(startDate, endDate);
      set({ transactions, accountingError: null });
    } catch (e) {
      // 写操作失败抛给调用方(DayAccounting 有 alert),同时记录提示
      set({ accountingError: String(e) });
      throw e;
    }
  },
  updateTransaction: async (transaction) => {
    await accountingBackend().updateTransaction(transaction);
    const sd = get().selectedDate;
    const start = new Date(sd.getFullYear(), sd.getMonth(), 1);
    const end = new Date(sd.getFullYear(), sd.getMonth() + 1, 0);
    await get().loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  },
  deleteTransaction: async (id) => {
    await accountingBackend().deleteTransaction(id);
    const sd = get().selectedDate;
    const start = new Date(sd.getFullYear(), sd.getMonth(), 1);
    const end = new Date(sd.getFullYear(), sd.getMonth() + 1, 0);
    await get().loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  },

  categories: { income: [], expense: [] },
  loadCategories: async () => {
    try {
      const [income, expense] = await Promise.all([
        accountingBackend().getCategories('income'), accountingBackend().getCategories('expense')
      ]);
      set({ categories: { income, expense }, accountingError: null });
    } catch (e) {
      console.warn('[appStore] loadCategories 失败:', e);
      set({ categories: { income: [], expense: [] }, accountingError: String(e) });
    }
  },
  addCategory: async (category) => {
    await accountingBackend().addCategory(category);
    await get().loadCategories();
  },

  accounts: [],
  loadAccounts: async () => {
    try {
      const accounts = await accountingBackend().getAccounts();
      set({ accounts, accountingError: null });
    } catch (e) {
      // bill 不可达:记录错误供界面提示,账户下拉留空(不阻断记账,保存时后端会走默认账户)
      console.warn('[appStore] loadAccounts 失败:', e);
      set({ accounts: [], accountingError: String(e) });
    }
  },

  notes: [],
  loadNotes: async () => {
    const notes = await backend.getAllNotes();
    set({ notes });
  },
  currentNoteContent: '',
  loadNote: async (date) => {
    const content = await backend.getNote(date);
    set({ currentNoteContent: content || '' });
  },
  saveNote: async (date, content) => {
    await backend.saveNote(date, content);
    await get().loadNotes();
  },
  deleteNote: async (date) => {
    await backend.deleteNote(date);
    await get().loadNotes();
  },

  weeklyAnalysis: null,
  monthlyAnalysis: null,
  loadWeeklyAnalysis: async (year, week) => {
    try {
      const a = await accountingBackend().getWeeklyAnalysis(year, week);
      set({ weeklyAnalysis: a, accountingError: null });
    } catch (e) {
      console.warn('[appStore] loadWeeklyAnalysis 失败:', e);
      set({ weeklyAnalysis: null, accountingError: String(e) });
    }
  },
  loadMonthlyAnalysis: async (year, month) => {
    try {
      const a = await accountingBackend().getMonthlyAnalysis(year, month);
      set({ monthlyAnalysis: a, accountingError: null });
    } catch (e) {
      console.warn('[appStore] loadMonthlyAnalysis 失败:', e);
      set({ monthlyAnalysis: null, accountingError: String(e) });
    }
  },

  syncConfig: { server_url: '', username: '', password: '' },
  setSyncConfig: (config) => set({ syncConfig: config }),

  syncData: async () => {
    const { syncConfig } = get();
    await backend.syncData(syncConfig);
    await get().loadLastSyncTime();
    await get().loadSyncMetadata();
  },
  syncDataIncremental: async () => {
    const { syncConfig } = get();
    await backend.syncDataIncremental(syncConfig);
    await get().loadLastSyncTime();
    await get().loadSyncMetadata();
  },
  testSyncConnection: async () => {
    const { syncConfig } = get();
    return backend.testSyncConnection(syncConfig);
  },

  lastSyncTime: null,
  loadLastSyncTime: async () => {
    const t = await backend.getLastSyncTime();
    set({ lastSyncTime: t });
  },

  syncMetadata: null,
  loadSyncMetadata: async () => {
    const m = await backend.getSyncMetadata();
    set({ syncMetadata: m });
  },

  validateDataIntegrity: async () => backend.validateDataIntegrity(),
  computeFullChecksum: async () => backend.computeFullChecksum(),
  exportData: async () => backend.exportSystemJson(),
  importSystemJson: async (jsonData, merge) => backend.importSystemJson(jsonData, merge),
  exportAccountingCsv: async (s, e) => backend.exportAccountingCsv(s, e),
  importAccountingCsv: async (c) => backend.importAccountingCsv(c),
  exportNotesZip: async () => backend.exportNotesZip(),
  importNotesZip: async (b) => backend.importNotesZip(b),

  getSetting: async (key) => backend.getSetting(key),
  setSetting: async (key, value) => backend.setSetting(key, value),
}));
