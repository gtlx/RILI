import { BackendAdapter, Transaction, Category, Note, WeeklyAnalysis, MonthlyAnalysis, SyncConfig, SyncMetadata } from './backend';

export class MockBackend implements BackendAdapter {
  private txns: Transaction[] = [];
  private notes: Map<string, string> = new Map();
  private noteMeta: Note[] = [];
  private categories: Category[] = [
    { name: '餐饮', category_type: 'expense', icon: 'restaurant', color: '#EF4444', is_default: true },
    { name: '交通', category_type: 'expense', icon: 'car', color: '#F59E0B', is_default: true },
    { name: '购物', category_type: 'expense', icon: 'shopping', color: '#8B5CF6', is_default: true },
    { name: '娱乐', category_type: 'expense', icon: 'game', color: '#14B8A6', is_default: true },
    { name: '工资', category_type: 'income', icon: 'wallet', color: '#10B981', is_default: true },
  ];
  private settings: Map<string, string> = new Map();

  async addTransaction(t: Transaction): Promise<number> {
    const id = this.txns.length + 1;
    this.txns.push({ ...t, id, version: 1, is_deleted: false });
    return id;
  }
  async updateTransaction(t: Transaction): Promise<void> {
    const idx = this.txns.findIndex(x => x.id === t.id);
    if (idx >= 0) this.txns[idx] = { ...this.txns[idx], ...t, version: (this.txns[idx].version || 0) + 1 };
  }
  async deleteTransaction(id: number): Promise<void> {
    const t = this.txns.find(x => x.id === id);
    if (t) t.is_deleted = true;
  }
  async getTransactions(startDate: string, endDate: string): Promise<Transaction[]> {
    return this.txns.filter(t => !t.is_deleted && t.date >= startDate && t.date <= endDate);
  }
  async getAllTransactions(): Promise<Transaction[]> { return this.txns.filter(t => !t.is_deleted); }
  async getTransactionsSinceVersion(v: number): Promise<Transaction[]> { return this.txns.filter(t => (t.version || 0) > v); }
  async getCategories(t: string): Promise<Category[]> { return this.categories.filter(c => c.category_type === t); }
  async addCategory(c: Category): Promise<number> { this.categories.push(c); return this.categories.length; }
  async saveNote(date: string, content: string): Promise<void> {
    this.notes.set(date, content);
    const existing = this.noteMeta.findIndex(n => n.date === date);
    if (existing >= 0) {
      this.noteMeta[existing] = { ...this.noteMeta[existing], version: (this.noteMeta[existing].version || 0) + 1 };
    } else {
      this.noteMeta.push({ id: this.noteMeta.length + 1, date, file_path: `${date}.md`, version: 1, is_deleted: false });
    }
  }
  async getNote(date: string): Promise<string | null> { return this.notes.get(date) || null; }
  async getAllNotes(): Promise<Note[]> { return this.noteMeta.filter(n => !n.is_deleted); }
  async getNotesSinceVersion(v: number): Promise<Note[]> { return this.noteMeta.filter(n => (n.version || 0) > v); }
  async deleteNote(date: string): Promise<void> {
    this.notes.delete(date);
    const n = this.noteMeta.find(x => x.date === date);
    if (n) n.is_deleted = true;
  }
  async getWeeklyAnalysis(y: number, w: number): Promise<WeeklyAnalysis> {
    return { week_start: '', week_end: '', total_income: 0, total_expense: 0, income_by_category: [], expense_by_category: [], daily_expense: [], compare_to_last_week: 0 };
  }
  async getMonthlyAnalysis(y: number, m: number): Promise<MonthlyAnalysis> {
    return { month: String(m).padStart(2,'0'), year: y, total_income: 0, total_expense: 0, income_by_category: [], expense_by_category: [], compare_to_last_month: 0, top_categories: [] };
  }
  async getSetting(k: string): Promise<string | null> { return this.settings.get(k) || null; }
  async setSetting(k: string, v: string): Promise<void> { this.settings.set(k, v); }
  async syncData(c: SyncConfig): Promise<string> { return 'Mock: sync ok'; }
  async syncDataIncremental(c: SyncConfig): Promise<string> { return 'Mock: incremental sync ok'; }
  async testSyncConnection(c: SyncConfig): Promise<boolean> { return false; }
  async getLastSyncTime(): Promise<string | null> { return null; }
  async getSyncMetadata(): Promise<SyncMetadata> { return { last_sync_version: 0, last_sync_time: '', checksum: '' }; }
  async exportAllData(): Promise<string> { return '{}'; }
  async importData(j: string, m: boolean): Promise<void> {}
  async exportTransactionsCsv(s: string, e: string): Promise<string> { return ''; }
  async importTransactionsCsv(c: string): Promise<number> { return 0; }
  async exportNotesZip(): Promise<string> { return ''; }
  async validateDataIntegrity(): Promise<boolean> { return true; }
  async computeFullChecksum(): Promise<string> { return ''; }

  async saveFileDialog(content: string, filename: string, mimeType: string): Promise<void> {
    // 浏览器模式：触发下载
    const blob = new Blob(
      [Uint8Array.from(atob(content), c => c.charCodeAt(0))],
      { type: mimeType }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
