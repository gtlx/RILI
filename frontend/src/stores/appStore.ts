import { create } from 'zustand';
import { backend } from '../api';
import type { Transaction, Category, Note, WeeklyAnalysis, MonthlyAnalysis, SyncMetadata, SyncConfig, ViewType, Theme } from '../api/backend';

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

  transactions: [],
  loadTransactions: async (startDate, endDate) => {
    const transactions = await backend.getTransactions(startDate, endDate);
    set({ transactions });
  },
  addTransaction: async (transaction) => { await backend.addTransaction(transaction); },
  addTransactionWithReload: async (transaction, startDate, endDate) => {
    await backend.addTransaction(transaction);
    const transactions = await backend.getTransactions(startDate, endDate);
    set({ transactions });
  },
  updateTransaction: async (transaction) => {
    await backend.updateTransaction(transaction);
    const sd = get().selectedDate;
    const start = new Date(sd.getFullYear(), sd.getMonth(), 1);
    const end = new Date(sd.getFullYear(), sd.getMonth() + 1, 0);
    await get().loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  },
  deleteTransaction: async (id) => {
    await backend.deleteTransaction(id);
    const sd = get().selectedDate;
    const start = new Date(sd.getFullYear(), sd.getMonth(), 1);
    const end = new Date(sd.getFullYear(), sd.getMonth() + 1, 0);
    await get().loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  },

  categories: { income: [], expense: [] },
  loadCategories: async () => {
    const [income, expense] = await Promise.all([
      backend.getCategories('income'), backend.getCategories('expense')
    ]);
    set({ categories: { income, expense } });
  },
  addCategory: async (category) => {
    await backend.addCategory(category);
    await get().loadCategories();
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
    const a = await backend.getWeeklyAnalysis(year, week);
    set({ weeklyAnalysis: a });
  },
  loadMonthlyAnalysis: async (year, month) => {
    const a = await backend.getMonthlyAnalysis(year, month);
    set({ monthlyAnalysis: a });
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
