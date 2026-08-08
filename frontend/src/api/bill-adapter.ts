/**
 * BillBackendAdapter —— RILI 记账接 bill 云端 REST API 的后端适配器
 *
 * 职责:实现 BackendAdapter 接口,把 RILI 的记账操作翻译成 bill 软件的
 * REST API 调用(bill 负责数据存储,后续可 Docker 部署在服务器)。
 *
 * bill API 契约(bill-dual-end 分支,前缀 /api/v1):
 *   POST   /auth/login                   登录 → {token, user_id, username, role}
 *   GET    /bills?page=&page_size=       分页账单列表(无日期过滤,需本地过滤;page_size ≤ 100)
 *   POST   /bills                        新建账单(CreateBillRequest)
 *   PUT    /bills/:id                    更新账单
 *   DELETE /bills/:id                    删除账单(204)
 *   GET    /accounts                     账户列表(记账必须指定账户)
 *   GET    /reports/income-expense       按月收支趋势
 *   GET    /reports/categories           支出分类排行
 *   GET    /statistics/report?year=&month= 月度报表
 * 认证:除 /auth/login 外全部需要 Authorization: Bearer <JWT>,token 有效期 7 天。
 * 金额单位:bill 用整数分(amount_cents),RILI 用元,进出各换算一次。
 * 日期格式:bill 的 transacted_at 为 "YYYY-MM-DDTHH:MM:SS"(后端按此格式 parse),
 *          RILI 的 date 为 "YYYY-MM-DD",提交时补 T00:00:00。
 *
 * 配置存储:localStorage(bill_base_url / bill_username / bill_password /
 *          bill_token / bill_token_exp / bill_default_account_id),
 *          在 RILI 设置页「记账后端」区块填写;base URL 可配置,
 *          默认 http://localhost:3000,部署到服务器后改为服务器地址。
 */

import { BackendAdapter, Transaction, Category, Note, WeeklyAnalysis, MonthlyAnalysis, SyncConfig, SyncMetadata, RecurringRule } from './backend';

/* ────────────────────── 配置与常量 ────────────────────── */

// localStorage 键名统一前缀
const LS = {
  backendMode: 'rili_accounting_backend',      // 'bill' | 'local'
  baseUrl: 'bill_base_url',
  username: 'bill_username',
  password: 'bill_password',
  token: 'bill_token',
  tokenExp: 'bill_token_exp',                  // JWT 过期时间戳(秒)
  defaultAccountId: 'bill_default_account_id', // 可选:记账默认账户
  extraCategories: 'bill_extra_categories',    // 本地扩展分类(JSON 数组)
};

// bill 内置分类(与 bill web/src/types/index.ts 的 CATEGORIES 一致,由 bill 数据库种子固定)
// 注意:bill 没有「新增分类」的 REST API,分类是固定种子表;
//       RILI 记账 UI 的下拉分类即来自此表,新增分类只存本地(见 addCategory)。
const BILL_CATEGORIES: { id: number; name: string; icon: string; transaction_type: 'expense' | 'income' }[] = [
  { id: 1, name: '餐饮', icon: '🍽️', transaction_type: 'expense' },
  { id: 2, name: '交通', icon: '🚗', transaction_type: 'expense' },
  { id: 3, name: '购物', icon: '🛒', transaction_type: 'expense' },
  { id: 4, name: '娱乐', icon: '🎮', transaction_type: 'expense' },
  { id: 5, name: '住房', icon: '🏠', transaction_type: 'expense' },
  { id: 6, name: '医疗', icon: '🏥', transaction_type: 'expense' },
  { id: 7, name: '教育', icon: '📚', transaction_type: 'expense' },
  { id: 8, name: '薪资', icon: '💰', transaction_type: 'income' },
  { id: 9, name: '兼职', icon: '💼', transaction_type: 'income' },
  { id: 10, name: '理财', icon: '📈', transaction_type: 'income' },
  { id: 11, name: '红包', icon: '🧧', transaction_type: 'income' },
  { id: 12, name: '其他', icon: '📦', transaction_type: 'expense' },
];

// 未知分类的兜底 id:支出→其他(12);收入 bill 无「其他」类,兜底到薪资(8),注释说明
const FALLBACK_CATEGORY_ID: Record<'expense' | 'income', number> = { expense: 12, income: 8 };

/* ────────────────────── bill API 类型(前端契约对齐) ────────────────────── */

interface BillAuthResponse { token: string; user_id: number; username: string; role: string; }

interface BillAccount {
  id: number;
  name: string;
  account_type: string;
  asset_type: string;
  balance_cents: number;
  currency: string;
  icon: string;
}

/** bill 账单响应结构(与 bill web/types Bill 一致) */
interface BillRecord {
  id: number;
  amount_cents: number;
  transaction_type: 'expense' | 'income' | 'transfer' | 'repayment';
  category_id: number;
  account_id: number | null;
  from_account_id: number | null;
  to_account_id: number | null;
  account_name: string;
  tags: number[];
  transfer_id: number | null;
  transacted_at: string; // "YYYY-MM-DDTHH:MM:SS"
  note: string;
  created_at: string;
  updated_at: string;
}

/** bill 新建/更新账单请求体(与 bill web/types CreateBillRequest 一致) */
interface CreateBillRequest {
  amount_cents: number;
  transaction_type: 'expense' | 'income' | 'transfer' | 'repayment';
  category_id: number;
  account_id?: number | null;
  from_account_id?: number | null;
  to_account_id?: number | null;
  tags?: number[];
  transfer_id?: number | null;
  transacted_at: string;
  note?: string;
}

/** bill 月度报表 /statistics/report 响应 */
interface BillMonthlyReport {
  current_expense: number;
  current_income: number;
  previous_expense: number;
  previous_income: number;
  expense_change_percent: number;
  daily_average: number;
  weekday_spending: number;
  weekend_spending: number;
  hourly_distribution: [number, number][];
  top_categories: { category_id: number; category_name: string; total_cents: number; count: number }[];
  bill_count: number;
}

/* ────────────────────── 工具函数 ────────────────────── */

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* 忽略存储失败 */ }
}

/** 读取配置的 bill 服务器地址(可配置,默认本地开发地址) */
export function getBillBaseUrl(): string {
  return lsGet(LS.baseUrl) || 'http://localhost:3000';
}

/** 记账后端是否启用 bill 云端模式(设置页「记账后端」切换,默认云端) */
export function isBillBackendEnabled(): boolean {
  return lsGet(LS.backendMode) !== 'local'; // 默认 bill
}

/** 设置记账后端模式:'bill' 云端 | 'local' 本地 */
export function setBillBackendMode(mode: 'bill' | 'local'): void {
  lsSet(LS.backendMode, mode);
}

/** 读取 bill 连接配置(设置页表单回显用) */
export function getBillConfig() {
  return {
    baseUrl: getBillBaseUrl(),
    username: lsGet(LS.username) || '',
    password: lsGet(LS.password) || '',
    defaultAccountId: lsGet(LS.defaultAccountId) || '',
  };
}

/** 保存 bill 连接配置(设置页表单提交用) */
export function setBillConfig(cfg: { baseUrl: string; username: string; password: string; defaultAccountId?: string }): void {
  lsSet(LS.baseUrl, (cfg.baseUrl || 'http://localhost:3000').replace(/\/+$/, ''));
  lsSet(LS.username, cfg.username || '');
  lsSet(LS.password, cfg.password || '');
  if (cfg.defaultAccountId !== undefined) lsSet(LS.defaultAccountId, cfg.defaultAccountId);
  // 配置变更后旧 token 作废,强制下次重新登录
  lsSet(LS.token, '');
  lsSet(LS.tokenExp, '0');
}

/** 内置分类表 + 本地扩展分类,统一返回(用于记账 UI 下拉) */
function allCategories(): Category[] {
  const builtin: Category[] = BILL_CATEGORIES.map(c => ({
    name: c.name,
    category_type: c.transaction_type,
    icon: c.icon,
    is_default: true,
  }));
  // 本地扩展分类(见 addCategory 注释:bill 无分类创建 API,扩展分类仅存本地,记账落到兜底分类)
  let extra: Category[] = [];
  try {
    const raw = lsGet(LS.extraCategories);
    if (raw) extra = JSON.parse(raw);
  } catch { /* 忽略解析失败 */ }
  return [...builtin, ...extra];
}

/** 分类名 → bill category_id;未知分类用兜底 id(expense→其他,income→薪资) */
function resolveCategoryId(name: string, type: 'expense' | 'income'): number {
  const hit = BILL_CATEGORIES.find(c => c.name === name && c.transaction_type === type);
  return hit ? hit.id : FALLBACK_CATEGORY_ID[type];
}

/** category_id → 分类名;未知返回「其他」 */
function categoryNameById(id: number): string {
  const hit = BILL_CATEGORIES.find(c => c.id === id);
  return hit ? hit.name : '其他';
}

/** 元 → 分(整数,避免浮点误差) */
function yuanToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** 分 → 元 */
function centsToYuan(cents: number): number {
  return cents / 100;
}

/** 金额格式化:本地扩展分类 JSON 用 */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ────────────────────── 适配器主体 ────────────────────── */

export class BillBackendAdapter implements BackendAdapter {
  /** 登录成功后缓存的账户列表(记账必须指定账户) */
  private accounts: BillAccount[] | null = null;

  /* ────────── 认证:登录 / token 管理 ────────── */

  /**
   * 确保有可用的 JWT:
   * 1. 已有未过期 token 直接返回;
   * 2. 否则用配置的用户名密码 POST /auth/login 换取新 token;
   * 3. 配置缺失/登录失败抛中文错误(调用方负责友好提示)。
   */
  private async ensureToken(): Promise<string> {
    const token = lsGet(LS.token);
    const exp = parseInt(lsGet(LS.tokenExp) || '0', 10);
    if (token && exp > Math.floor(Date.now() / 1000) + 300) {
      return token; // 提前 5 分钟视为过期,避免临界失效
    }
    // token 缺失/过期 → 重新登录
    const baseUrl = getBillBaseUrl();
    const username = lsGet(LS.username);
    const password = lsGet(LS.password);
    if (!username || !password) {
      throw new Error('未配置 bill 账号,请到「设置 → 记账后端」填写服务器地址、用户名和密码');
    }
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error(`无法连接 bill 服务器(${baseUrl}),请检查地址或网络`);
    }
    if (!res.ok) {
      throw new Error(`bill 登录失败(HTTP ${res.status}),请检查用户名密码`);
    }
    const data: BillAuthResponse = await res.json();
    // token 有效期 7 天(bill 后端 EXPIRY_HOURS = 24*7),记录过期时间便于续期
    lsSet(LS.token, data.token);
    lsSet(LS.tokenExp, String(Math.floor(Date.now() / 1000) + 7 * 24 * 3600));
    return data.token;
  }

  /** 通用请求:带 Bearer 认证;401 时清 token 重登一次再重试 */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = getBillBaseUrl();
    let token = await this.ensureToken();
    const doFetch = (tk: string) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tk}`,
          ...(init?.headers || {}),
        },
      });
    let res = await doFetch(token);
    if (res.status === 401) {
      // token 失效 → 清掉重新登录,再试一次
      lsSet(LS.token, '');
      lsSet(LS.tokenExp, '0');
      token = await this.ensureToken();
      res = await doFetch(token);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`bill API 请求失败(HTTP ${res.status})${text ? `: ${text}` : ''}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  /** 登录并拉取账户列表(记账必须指定账户);可指定默认账户 id,否则取第一个 */
  private async ensureAccounts(): Promise<BillAccount> {
    if (!this.accounts) {
      this.accounts = await this.request<BillAccount[]>('/api/v1/accounts');
    }
    if (!this.accounts || this.accounts.length === 0) {
      throw new Error('bill 中还没有账户,请先在 bill 里创建账户后再记账');
    }
    const cfgId = lsGet(LS.defaultAccountId);
    const preferred = cfgId
      ? this.accounts.find(a => String(a.id) === cfgId)
      : undefined;
    return preferred || this.accounts[0];
  }

  /** 供设置页「测试连接」:验证服务器可达 + 账号正确,返回中文结果 */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.ensureToken();
      return { ok: true, message: `连接成功,已登录 bill(${getBillBaseUrl()})` };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  }

  /* ────────── 交易:记账 / 查询(映射到 bill /bills) ────────── */

  async addTransaction(t: Transaction): Promise<number> {
    const account = await this.ensureAccounts();
    const body: CreateBillRequest = {
      amount_cents: yuanToCents(t.amount),
      transaction_type: t.transaction_type,
      category_id: resolveCategoryId(t.category, t.transaction_type),
      // 双端账户映射:支出→from_account_id,收入→to_account_id
      from_account_id: t.transaction_type === 'expense' ? account.id : null,
      to_account_id: t.transaction_type === 'income' ? account.id : null,
      transacted_at: `${t.date}T00:00:00`,
      note: t.note || '',
    };
    const bill = await this.request<BillRecord>('/api/v1/bills', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return bill.id;
  }

  async updateTransaction(t: Transaction): Promise<void> {
    if (!t.id) throw new Error('更新账单缺少 id');
    const account = await this.ensureAccounts();
    const body: CreateBillRequest = {
      amount_cents: yuanToCents(t.amount),
      transaction_type: t.transaction_type,
      category_id: resolveCategoryId(t.category, t.transaction_type),
      from_account_id: t.transaction_type === 'expense' ? account.id : null,
      to_account_id: t.transaction_type === 'income' ? account.id : null,
      transacted_at: `${t.date}T00:00:00`,
      note: t.note || '',
    };
    await this.request<BillRecord>(`/api/v1/bills/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteTransaction(id: number): Promise<void> {
    await this.request<void>(`/api/v1/bills/${id}`, { method: 'DELETE' });
  }

  /** 分页拉取 bill 全部账单(无日期过滤参数,循环 page 直到取完) */
  private async fetchAllBills(): Promise<BillRecord[]> {
    const all: BillRecord[] = [];
    const pageSize = 100; // bill 上限 100
    for (let page = 1; ; page++) {
      const batch = await this.request<BillRecord[]>(`/api/v1/bills?page=${page}&page_size=${pageSize}`);
      all.push(...batch);
      if (batch.length < pageSize) break; // 最后一页
      if (page > 200) break; // 防御:最多 2 万条,防止死循环
    }
    return all;
  }

  /** BillRecord → RILI Transaction(转账/还款类型 RILI 无对应概念,过滤掉) */
  private mapBillToTransaction(b: BillRecord): Transaction | null {
    if (b.transaction_type !== 'expense' && b.transaction_type !== 'income') return null;
    return {
      id: b.id,
      date: b.transacted_at.slice(0, 10), // "YYYY-MM-DDTHH:MM:SS" → "YYYY-MM-DD"
      amount: centsToYuan(b.amount_cents),
      transaction_type: b.transaction_type,
      category: categoryNameById(b.category_id),
      note: b.note || undefined,
      created_at: b.created_at,
      updated_at: b.updated_at,
      version: 1,   // bill 无版本号,固定 1(RILI 增量同步逻辑不适用于云端模式)
      is_deleted: false,
    };
  }

  async getTransactions(startDate: string, endDate: string): Promise<Transaction[]> {
    const bills = await this.fetchAllBills();
    return bills
      .map(b => this.mapBillToTransaction(b))
      .filter((t): t is Transaction =>
        !!t && t.date >= startDate && t.date <= endDate);
  }

  async getAllTransactions(): Promise<Transaction[]> {
    const bills = await this.fetchAllBills();
    return bills
      .map(b => this.mapBillToTransaction(b))
      .filter((t): t is Transaction => !!t);
  }

  /** bill 云端无版本号概念,增量同步不适用 → 返回全量(注释:语义近似) */
  async getTransactionsSinceVersion(_version: number): Promise<Transaction[]> {
    return this.getAllTransactions();
  }

  /* ────────── 分类 ────────── */

  async getCategories(categoryType: string): Promise<Category[]> {
    const list = allCategories();
    return list.filter(c => c.category_type === categoryType);
  }

  /**
   * bill 没有「新增分类」REST API(分类是固定种子表)。
   * 实现:扩展分类仅保存在本地 localStorage,记账 UI 立即可选;
   * 但 bill 数据库无法创建该分类,记账时按名称匹配内置分类,
   * 匹配不到则落到兜底分类(支出→其他,收入→薪资)。
   * 后续 bill 若提供分类 API 可改为真正同步。
   */
  async addCategory(c: Category): Promise<number> {
    const list = allCategories();
    if (list.some(x => x.name === c.name && x.category_type === c.category_type)) {
      return 0; // 已存在
    }
    const extra: Category[] = [...list.filter(x => !x.is_default), { ...c, is_default: false }];
    lsSet(LS.extraCategories, JSON.stringify(extra));
    return 0;
  }

  /* ────────── 笔记:云端模式下不适用(笔记仍走本地后端,此处仅接口对齐) ────────── */

  async saveNote(_date: string, _content: string): Promise<void> { /* 笔记由本地后端管理,云端不落 bill */ }
  async getNote(_date: string): Promise<string | null> { return null; }
  async getAllNotes(): Promise<Note[]> { return []; }
  async getNotesSinceVersion(_version: number): Promise<Note[]> { return []; }
  async deleteNote(_date: string): Promise<void> { /* no-op */ }

  /* ────────── 分析:拉取账单本地聚合(与本地后端算法一致) ────────── */

  private aggregate(txns: Transaction[]) {
    const income = txns.filter(t => t.transaction_type === 'income');
    const expense = txns.filter(t => t.transaction_type === 'expense');
    const total_income = income.reduce((s, t) => s + t.amount, 0);
    const total_expense = expense.reduce((s, t) => s + t.amount, 0);
    const byCategory = (list: Transaction[]) => {
      const map = new Map<string, number>();
      for (const t of list) map.set(t.category, (map.get(t.category) || 0) + t.amount);
      return Array.from(map, ([category, amount]) => ({ category, amount }));
    };
    return { total_income, total_expense, income_by_category: byCategory(income), expense_by_category: byCategory(expense) };
  }

  async getMonthlyAnalysis(year: number, month: number): Promise<MonthlyAnalysis> {
    const monthStr = String(month).padStart(2, '0');
    const start = `${year}-${monthStr}-01`;
    const end = `${year}-${monthStr}-${new Date(year, month, 0).getDate()}`;
    const monthTxns = await this.getTransactions(start, end);
    // 上月区间,用于环比
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const prevStart = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
    const prevEnd = `${prevY}-${String(prevM).padStart(2, '0')}-${new Date(prevY, prevM, 0).getDate()}`;
    const prevTxns = await this.getTransactions(prevStart, prevEnd);
    const prevExpense = prevTxns.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
    const { total_income, total_expense, income_by_category, expense_by_category } = this.aggregate(monthTxns);
    const top_categories = [...expense_by_category].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const compare_to_last_month = prevExpense > 0 ? ((total_expense - prevExpense) / prevExpense) * 100 : 0;
    return { month: monthStr, year, total_income, total_expense, income_by_category, expense_by_category, compare_to_last_month, top_categories };
  }

  async getWeeklyAnalysis(year: number, week: number): Promise<WeeklyAnalysis> {
    // 与本地 MockBackend 相同的周区间算法(ISO 周简化版:以 1 月 1 日为第 1 周起点)
    const startOfYear = new Date(year, 0, 1);
    const weekStart = new Date(startOfYear.getTime() + (week - 1) * 7 * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    const s = fmtDate(weekStart);
    const e = fmtDate(weekEnd);
    const weekTxns = await this.getTransactions(s, e);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
    const prevWeekEnd = new Date(prevWeekStart.getTime() + 6 * 86400000);
    const prevTxns = await this.getTransactions(fmtDate(prevWeekStart), fmtDate(prevWeekEnd));
    const prevExpense = prevTxns.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const { total_income, total_expense, income_by_category, expense_by_category } = this.aggregate(weekTxns);
    const daily_expense = weekTxns
      .filter(t => t.transaction_type === 'expense')
      .reduce((acc, t) => {
        const d = acc.find(x => x.date === t.date);
        if (d) d.amount += t.amount; else acc.push({ date: t.date, amount: t.amount });
        return acc;
      }, [] as { date: string; amount: number }[]);
    const compare_to_last_week = prevExpense > 0 ? ((total_expense - prevExpense) / prevExpense) * 100 : 0;
    return { week_start: s, week_end: e, total_income, total_expense, income_by_category, expense_by_category, daily_expense, compare_to_last_week };
  }

  /* ────────── 设置:bill 配置键走 localStorage,其余返回 null ────────── */

  async getSetting(key: string): Promise<string | null> {
    return lsGet(`bill_${key}`);
  }

  async setSetting(key: string, value: string): Promise<void> {
    lsSet(`bill_${key}`, value);
  }

  /* ────────── 同步:云端模式下不适用(WebDAV 同步属于本地后端能力) ────────── */

  async syncData(_config: SyncConfig): Promise<string> { return 'bill 云端模式下不使用 WebDAV 同步'; }
  async syncDataIncremental(_config: SyncConfig): Promise<string> { return 'bill 云端模式下不使用 WebDAV 同步'; }
  async testSyncConnection(_config: SyncConfig): Promise<boolean> { return false; }
  async getLastSyncTime(): Promise<string | null> { return null; }
  async getSyncMetadata(): Promise<SyncMetadata> { return { last_sync_version: 0, last_sync_time: '', checksum: '' }; }

  /* ────────── 系统数据:JSON 备份/迁移(云端模式下不适用) ────────── */

  async exportSystemJson(): Promise<string> { return JSON.stringify({ source: 'bill-cloud', note: '账单数据存储在 bill 服务器,本地无完整 JSON 备份' }); }
  async importSystemJson(_jsonData: string, _merge: boolean): Promise<void> { /* 云端模式下导入不适用 */ }
  async validateDataIntegrity(): Promise<boolean> { return true; }
  async computeFullChecksum(): Promise<string> { return ''; }

  /* ────────── CSV 导入导出:云端模式下不适用(设置页导出走本地后端) ────────── */

  async exportAccountingCsv(_startDate: string, _endDate: string): Promise<string> { return ''; }
  async importAccountingCsv(_csvData: string): Promise<number> { return 0; }

  /* ────────── 笔记 ZIP:不适用 ────────── */

  async exportNotesZip(): Promise<string> { return ''; }
  async importNotesZip(_base64Data: string): Promise<number> { return 0; }

  /* ────────── 周期交易:bill 有 /recurring API 但 RILI 云端模式暂不接入,保持空实现 ────────── */

  async addRecurringRule(_rule: RecurringRule): Promise<number> { return 0; }
  async updateRecurringRule(_rule: RecurringRule): Promise<void> { /* no-op */ }
  async deleteRecurringRule(_id: number): Promise<void> { /* no-op */ }
  async getRecurringRules(): Promise<RecurringRule[]> { return []; }
  async generateRecurringTransactions(_endDate: string): Promise<number> { return 0; }

  /* ────────── 笔记 Git 同步:不适用(本地后端能力) ────────── */

  async gitInit(): Promise<void> { /* no-op */ }
  async gitCommit(_message: string): Promise<void> { /* no-op */ }
  async gitLog(_maxCount: number): Promise<string[]> { return []; }
  async gitSetRemote(_url: string): Promise<void> { /* no-op */ }
  async gitRemoveRemote(): Promise<void> { /* no-op */ }
  async gitGetRemoteUrl(): Promise<string | null> { return null; }
  async gitPush(): Promise<string> { return 'bill 云端模式下不使用 Git 同步'; }
  async gitPull(): Promise<string> { return 'bill 云端模式下不使用 Git 同步'; }

  /* ────────── 交易审计:bill 无审计接口,返回空 ────────── */

  async getTransactionAudit(_limit: number): Promise<import('./backend').TransactionAudit[]> { return []; }

  /* ────────── 文件保存:浏览器模式触发下载(与 MockBackend 一致) ────────── */

  async saveFileDialog(content: string, filename: string, mimeType: string): Promise<void> {
    const blob = new Blob([Uint8Array.from(atob(content), c => c.charCodeAt(0))], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// 导出单例(供 index.ts 注入记账后端选择)
export const billBackend = new BillBackendAdapter();
