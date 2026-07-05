import { BackendAdapter, Transaction, Category, Note, WeeklyAnalysis, MonthlyAnalysis, SyncConfig, SyncMetadata, RecurringRule } from './backend';

export class MockBackend implements BackendAdapter {
  private txns: Transaction[] = [];
  private recurringRules: RecurringRule[] = [];
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
  private computeAnalysis(txns: Transaction[]) {
    const income = txns.filter(t => t.transaction_type === 'income' && !t.is_deleted);
    const expense = txns.filter(t => t.transaction_type === 'expense' && !t.is_deleted);
    const total_income = income.reduce((s, t) => s + t.amount, 0);
    const total_expense = expense.reduce((s, t) => s + t.amount, 0);
    const byCategory = (list: Transaction[]) => {
      const map = new Map<string, number>();
      for (const t of list) map.set(t.category, (map.get(t.category) || 0) + t.amount);
      return Array.from(map, ([category, amount]) => ({ category, amount }));
    };
    return { total_income, total_expense, income_by_category: byCategory(income), expense_by_category: byCategory(expense) };
  }

  async getWeeklyAnalysis(y: number, w: number): Promise<WeeklyAnalysis> {
    const startOfYear = new Date(y, 0, 1);
    const dayOfYear = (w - 1) * 7;
    const weekStart = new Date(startOfYear.getTime() + dayOfYear * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const weekTxns = this.txns.filter(t => !t.is_deleted && t.date >= fmt(weekStart) && t.date <= fmt(weekEnd));
    const prevWeekTxns = this.txns.filter(t => !t.is_deleted && t.date >= fmt(new Date(weekStart.getTime() - 7 * 86400000)) && t.date < fmt(weekStart));
    const prevExpense = prevWeekTxns.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
    const { total_income, total_expense, income_by_category, expense_by_category } = this.computeAnalysis(weekTxns);
    const daily_expense = weekTxns.filter(t => t.transaction_type === 'expense').reduce((acc, t) => {
      const d = acc.find(x => x.date === t.date);
      if (d) d.amount += t.amount; else acc.push({ date: t.date, amount: t.amount });
      return acc;
    }, [] as { date: string; amount: number }[]);
    const compare_to_last_week = prevExpense > 0 ? ((total_expense - prevExpense) / prevExpense) * 100 : 0;
    return { week_start: fmt(weekStart), week_end: fmt(weekEnd), total_income, total_expense, income_by_category, expense_by_category, daily_expense, compare_to_last_week };
  }
  async getMonthlyAnalysis(y: number, m: number): Promise<MonthlyAnalysis> {
    const monthStr = String(m).padStart(2, '0');
    const monthTxns = this.txns.filter(t => !t.is_deleted && t.date.startsWith(`${y}-${monthStr}`));
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const prevMonthStr = String(prevM).padStart(2, '0');
    const prevTxns = this.txns.filter(t => !t.is_deleted && t.date.startsWith(`${prevY}-${prevMonthStr}`));
    const prevExpense = prevTxns.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
    const { total_income, total_expense, income_by_category, expense_by_category } = this.computeAnalysis(monthTxns);
    const top_categories = [...expense_by_category].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const compare_to_last_month = prevExpense > 0 ? ((total_expense - prevExpense) / prevExpense) * 100 : 0;
    return { month: monthStr, year: y, total_income, total_expense, income_by_category, expense_by_category, compare_to_last_month, top_categories };
  }
  async getSetting(k: string): Promise<string | null> { return this.settings.get(k) || null; }
  async setSetting(k: string, v: string): Promise<void> { this.settings.set(k, v); }
  async syncData(c: SyncConfig): Promise<string> { return 'Mock: sync ok'; }
  async syncDataIncremental(c: SyncConfig): Promise<string> { return 'Mock: incremental sync ok'; }
  async testSyncConnection(c: SyncConfig): Promise<boolean> { return false; }
  async getLastSyncTime(): Promise<string | null> { return null; }
  async getSyncMetadata(): Promise<SyncMetadata> { return { last_sync_version: 0, last_sync_time: '', checksum: '' }; }
  // ── 系统数据: JSON ──
  async exportSystemJson(): Promise<string> { return JSON.stringify({ transactions: this.txns, categories: this.categories }); }
  async importSystemJson(j: string, m: boolean): Promise<void> {}
  async validateDataIntegrity(): Promise<boolean> { return true; }
  async computeFullChecksum(): Promise<string> { return ''; }

  // ── 记账: CSV ──
  async exportAccountingCsv(s: string, e: string): Promise<string> { return 'date,type,amount,category,note'; }
  async importAccountingCsv(c: string): Promise<number> { return 0; }

  // ── 笔记: ZIP ──
  async exportNotesZip(): Promise<string> { return ''; }
  async importNotesZip(b: string): Promise<number> { return 0; }

  // ── 周期交易 ──
  async addRecurringRule(r: RecurringRule): Promise<number> { this.recurringRules.push({ ...r, id: this.recurringRules.length + 1 }); return this.recurringRules.length; }
  async updateRecurringRule(r: RecurringRule): Promise<void> { const idx = this.recurringRules.findIndex(x => x.id === r.id); if (idx >= 0) this.recurringRules[idx] = r; }
  async deleteRecurringRule(id: number): Promise<void> { this.recurringRules = this.recurringRules.filter(x => x.id !== id); }
  async getRecurringRules(): Promise<RecurringRule[]> { return this.recurringRules.filter(r => r.is_active); }
  async generateRecurringTransactions(endDate: string): Promise<number> {
    let count = 0;
    for (const rule of this.recurringRules) {
      if (!rule.is_active) continue;
      let current = new Date(rule.start_date);
      const end = new Date(endDate);
      while (current <= end) {
        if (rule.end_date && current > new Date(rule.end_date)) break;
        if (current.toISOString().split('T')[0] !== rule.start_date) {
          const dateStr = current.toISOString().split('T')[0];
          if (!this.txns.some(t => t.date === dateStr && t.amount === rule.amount && t.category === rule.category)) {
            this.txns.push({ date: dateStr, amount: rule.amount, transaction_type: rule.transaction_type, category: rule.category, note: rule.note, version: 1, is_deleted: false, id: this.txns.length + 1 });
            count++;
          }
        }
        if (rule.interval === 'daily') current.setDate(current.getDate() + rule.interval_value);
        else if (rule.interval === 'weekly') current.setDate(current.getDate() + 7 * rule.interval_value);
        else if (rule.interval === 'monthly') current.setMonth(current.getMonth() + rule.interval_value);
        else if (rule.interval === 'yearly') current.setFullYear(current.getFullYear() + rule.interval_value);
      }
    }
    return count;
  }

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
