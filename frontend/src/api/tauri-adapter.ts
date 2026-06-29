import { BackendAdapter, Transaction, Category, Note, WeeklyAnalysis, MonthlyAnalysis, SyncConfig, SyncMetadata } from './backend';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke: ti } = await import('@tauri-apps/api/core');
    return await ti<T>(cmd, args);
  } catch (e) {
    console.warn(`[TauriAdapter] invoke(${cmd}) failed:`, e);
    throw e;
  }
}

export class TauriBackend implements BackendAdapter {
  async addTransaction(t: Transaction): Promise<number> { return invoke('add_transaction', { transaction: t }); }
  async updateTransaction(t: Transaction): Promise<void> { return invoke('update_transaction', { transaction: t }); }
  async deleteTransaction(id: number): Promise<void> { return invoke('delete_transaction', { id }); }
  async getTransactions(s: string, e: string): Promise<Transaction[]> { return invoke('get_transactions', { startDate: s, endDate: e }); }
  async getAllTransactions(): Promise<Transaction[]> { return invoke('get_all_transactions'); }
  async getTransactionsSinceVersion(v: number): Promise<Transaction[]> { return invoke('get_transactions_since_version', { version: v }); }

  async getCategories(t: string): Promise<Category[]> { return invoke('get_categories', { categoryType: t }); }
  async addCategory(c: Category): Promise<number> { return invoke('add_category', { category: c }); }

  async saveNote(d: string, c: string): Promise<void> { return invoke('save_note', { date: d, content: c }); }
  async getNote(d: string): Promise<string | null> { return invoke('get_note', { date: d }); }
  async getAllNotes(): Promise<Note[]> { return invoke('get_all_notes'); }
  async getNotesSinceVersion(v: number): Promise<Note[]> { return invoke('get_notes_since_version', { version: v }); }
  async deleteNote(d: string): Promise<void> { return invoke('delete_note', { date: d }); }

  async getWeeklyAnalysis(y: number, w: number): Promise<WeeklyAnalysis> { return invoke('get_weekly_analysis', { year: y, week: w }); }
  async getMonthlyAnalysis(y: number, m: number): Promise<MonthlyAnalysis> { return invoke('get_monthly_analysis', { year: y, month: m }); }

  async getSetting(k: string): Promise<string | null> { return invoke('get_setting', { key: k }); }
  async setSetting(k: string, v: string): Promise<void> { return invoke('set_setting', { key: k, value: v }); }

  async syncData(c: SyncConfig): Promise<string> { return invoke('sync_data', { config: c }); }
  async syncDataIncremental(c: SyncConfig): Promise<string> { return invoke('sync_data_incremental', { config: c }); }
  async testSyncConnection(c: SyncConfig): Promise<boolean> { return invoke('test_sync_connection', { config: c }); }
  async getLastSyncTime(): Promise<string | null> { return invoke('get_last_sync_time'); }
  async getSyncMetadata(): Promise<SyncMetadata> { return invoke('get_sync_metadata'); }

  async exportAllData(): Promise<string> { return invoke('export_all_data'); }
  async importData(j: string, m: boolean): Promise<void> { return invoke('import_data', { jsonData: j, merge: m }); }
  async exportTransactionsCsv(s: string, e: string): Promise<string> { return invoke('export_transactions_csv', { startDate: s, endDate: e }); }
  async importTransactionsCsv(c: string): Promise<number> { return invoke('import_transactions_csv', { csvData: c }); }
  async exportNotesZip(): Promise<string> { return invoke('export_notes_zip'); }
  async validateDataIntegrity(): Promise<boolean> { return invoke('validate_data_integrity'); }
  async computeFullChecksum(): Promise<string> { return invoke('compute_full_checksum'); }

  async saveFileDialog(content: string, filename: string, _mimeType: string): Promise<void> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      defaultPath: filename,
      filters: [{ name: filename.split('.').pop()?.toUpperCase() || 'File', extensions: [filename.split('.').pop() || ''] }]
    });
    if (filePath) {
      const binaryData = atob(content);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);
      await writeFile(filePath, bytes);
    }
  }
}
