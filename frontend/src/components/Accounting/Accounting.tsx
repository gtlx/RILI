import { useState, useEffect, useMemo } from 'react';
import { format, getWeek, eachDayOfInterval } from 'date-fns';
import { useAppStore, MonthlyAnalysis, WeeklyAnalysis } from '../../stores/appStore';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { backend, getAccountingBackend } from '../../api';

const COLORS = ['#10B981', '#14B8A6', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#3B82F6', '#0D9488'];

interface YearMonthData {
  month: number;
  income: number;
  expense: number;
  balance: number;
}

export const Accounting: React.FC = () => {
  const [view, setView] = useState<'week' | 'month' | 'year' | 'records'>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedWeek] = useState(getWeek(new Date()));
  const [yearData, setYearData] = useState<YearMonthData[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    loadTransactions, weeklyAnalysis, monthlyAnalysis, accountingError, clearAccountingError,
    loadWeeklyAnalysis, loadMonthlyAnalysis,
    transactions, setDetailDate, accounts, loadAccounts,
  } = useAppStore();

  useEffect(() => {
    // 净资产来自 bill 云端账户余额(bill 已接管账户,本地初始余额概念已废弃)
    loadAccounts();
  }, [loadAccounts]);

  /** 净资产 = 所有账户余额之和(bill 负债账户余额为负,求和即净资产);无账户或加载失败时隐藏 */
  const netWorth = accounts.length > 0 ? accounts.reduce((s, a) => s + (a.balance ?? 0), 0) : null;

  useEffect(() => {
    const start = format(new Date(selectedYear, selectedMonth - 1, 1), 'yyyy-MM-dd');
    const end = format(new Date(selectedYear, selectedMonth, 0), 'yyyy-MM-dd');
    loadTransactions(start, end);
  }, [selectedYear, selectedMonth, loadTransactions]);

  useEffect(() => {
    if (view === 'week') loadWeeklyAnalysis(selectedYear, selectedWeek);
    else if (view === 'month') loadMonthlyAnalysis(selectedYear, selectedMonth);
  }, [view, selectedYear, selectedMonth, selectedWeek, loadWeeklyAnalysis, loadMonthlyAnalysis]);

  useEffect(() => {
    if (view === 'year') loadYearData();
  }, [view, selectedYear]);

  const loadYearData = async () => {
    const months: YearMonthData[] = [];
    for (let m = 1; m <= 12; m++) {
      try {
        // 年视图逐月分析:走记账后端(bill 云端或本地)
        const analysis = await getAccountingBackend().getMonthlyAnalysis(selectedYear, m);
        months.push({ month: m, income: analysis.total_income, expense: analysis.total_expense, balance: analysis.total_income - analysis.total_expense });
      } catch {
        months.push({ month: m, income: 0, expense: 0, balance: 0 });
      }
    }
    setYearData(months);
  };

  const yearChartData = useMemo(() => yearData.map(d => ({ name: `${d.month}月`, income: d.income, expense: d.expense, balance: d.balance })), [yearData]);
  const yearTotalIncome = useMemo(() => yearData.reduce((s, d) => s + d.income, 0), [yearData]);
  const yearTotalExpense = useMemo(() => yearData.reduce((s, d) => s + d.expense, 0), [yearData]);

  const getTitle = () => {
    if (view === 'year') return `${selectedYear}年分析`;
    if (view === 'month') return `${selectedYear}年${selectedMonth}月分析`;
    if (view === 'records') return `${selectedYear}年${selectedMonth}月记录`;
    return `${selectedYear}年第${selectedWeek}周分析`;
  };

  const isWeekly = view === 'week';
  const chartData = useMemo(() => {
    let expensePieData: { name: string; value: number; color: string }[] = [];
    let incomePieData: { name: string; value: number; color: string }[] = [];
    let dailyExpenseData: { date: string; amount: number }[] = [];
    let comparePercent = 0;
    let topCategories: { category: string; amount: number }[] = [];
    if (isWeekly && weeklyAnalysis) {
      const wa = weeklyAnalysis as WeeklyAnalysis;
      expensePieData = wa.expense_by_category.map((item, i) => ({ name: item.category, value: item.amount, color: COLORS[i % COLORS.length] }));
      incomePieData = wa.income_by_category.map((item, i) => ({ name: item.category, value: item.amount, color: COLORS[i % COLORS.length] }));
      dailyExpenseData = wa.daily_expense.map(item => ({ date: format(new Date(item.date), 'M/d'), amount: item.amount }));
      comparePercent = wa.compare_to_last_week;
    } else if (!isWeekly && monthlyAnalysis) {
      const ma = monthlyAnalysis as MonthlyAnalysis;
      expensePieData = ma.expense_by_category.map((item, i) => ({ name: item.category, value: item.amount, color: COLORS[i % COLORS.length] }));
      incomePieData = ma.income_by_category.map((item, i) => ({ name: item.category, value: item.amount, color: COLORS[i % COLORS.length] }));
      comparePercent = ma.compare_to_last_month;
      topCategories = ma.top_categories || [];
    }
    return { expensePieData, incomePieData, dailyExpenseData, comparePercent, topCategories };
  }, [isWeekly, weeklyAnalysis, monthlyAnalysis]);

  const totalIncome = isWeekly ? (weeklyAnalysis as WeeklyAnalysis)?.total_income || 0 : (monthlyAnalysis as MonthlyAnalysis)?.total_income || 0;
  const totalExpense = isWeekly ? (weeklyAnalysis as WeeklyAnalysis)?.total_expense || 0 : (monthlyAnalysis as MonthlyAnalysis)?.total_expense || 0;

  const daysInMonth = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const end = new Date(selectedYear, selectedMonth, 0);
    return eachDayOfInterval({ start, end });
  }, [selectedYear, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t =>
      t.category.toLowerCase().includes(q) ||
      (t.note && t.note.toLowerCase().includes(q))
    );
  }, [transactions, searchQuery]);

  const transactionIndex = useMemo(() => {
    const idx = new Map<string, typeof transactions>();
    filteredTransactions.forEach(t => {
      const arr = idx.get(t.date) || [];
      arr.push(t);
      idx.set(t.date, arr);
    });
    return idx;
  }, [filteredTransactions]);

  // bill 不可达时显示友好错误提示(而不是永远转圈/白屏)
  if (accountingError) {
    return (
      <div>
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: 'var(--status-error-bg)', color: 'var(--status-error-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ 记账数据加载失败</div>
            <div style={{ fontSize: '13px', wordBreak: 'break-all' }}>{accountingError}</div>
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
              请检查「设置 → 记账后端」中的 bill 服务器地址与账号,或切换回本地记账
            </div>
          </div>
          <button className="btn btn-sm btn-secondary" style={{ flexShrink: 0 }} onClick={clearAccountingError}>知道了</button>
        </div>
        <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          暂无记账数据(bill 服务器不可达)
        </div>
      </div>
    );
  }

  if (view !== 'year' && view !== 'records' && !weeklyAnalysis && !monthlyAnalysis) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="calendar" style={{ marginBottom: '24px' }}>
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className={`btn btn-sm ${view === 'year' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('year')}>年</button>
            <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('month')}>月</button>
            <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('week')}>周</button>
            <button className={`btn btn-sm ${view === 'records' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('records')}>记录</button>
          </div>
          <div className="calendar-title">{getTitle()}</div>
          <div className="calendar-header-right">
            {showSearch ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  className="input"
                  type="text"
                  placeholder="搜索分类/备注..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{ height: '28px', fontSize: '12px', width: '160px', padding: '0 8px' }}
                />
                <button
                  className="btn btn-icon btn-secondary"
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  title="关闭搜索"
                  style={{ width: '28px', height: '28px', flexShrink: 0 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                className="btn btn-icon btn-secondary"
                onClick={() => setShowSearch(true)}
                title="搜索"
                style={{ width: '28px', height: '28px' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {view === 'records' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <select className="select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 'auto' }}>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select className="select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ width: 'auto' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <button className="btn btn-sm btn-secondary" onClick={async () => {
              try {
                const endDate = format(new Date(selectedYear, selectedMonth, 0), 'yyyy-MM-dd');
                await backend.generateRecurringTransactions(endDate);
                const start = format(new Date(selectedYear, selectedMonth - 1, 1), 'yyyy-MM-dd');
                await loadTransactions(start, endDate);
              } catch { /* ignore */ }
            }}>同步周期</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {daysInMonth.map(d => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const txns = transactionIndex.get(dateStr) || [];
              const hasIncome = txns.some(t => t.transaction_type === 'income');
              const hasExpense = txns.some(t => t.transaction_type === 'expense');
              return (
                <div
                  key={dateStr}
                  className="calendar-day"
                  onClick={() => setDetailDate(dateStr)}
                  style={{ padding: '6px 2px', cursor: 'pointer', textAlign: 'center', fontSize: '12px', borderRadius: 'var(--radius)' }}
                >
                  <div style={{ fontWeight: 400, color: 'var(--text-primary)' }}>{format(d, 'd')}</div>
                  <div className="calendar-day-markers" style={{ justifyContent: 'center' }}>
                    {hasIncome && <span className="calendar-marker income" />}
                    {hasExpense && <span className="calendar-marker expense" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'year' && (
        <>
          <div className="analysis-cards">
            <div className="analysis-card">
              <div className="analysis-card-label">{selectedYear}年总收入</div>
              <div className="analysis-card-value income">+{yearTotalIncome.toFixed(2)}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-card-label">{selectedYear}年总支出</div>
              <div className="analysis-card-value expense">-{yearTotalExpense.toFixed(2)}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-card-label">年结余</div>
              <div className={`analysis-card-value ${yearTotalIncome - yearTotalExpense >= 0 ? 'income' : 'expense'}`}>
                {(yearTotalIncome - yearTotalExpense).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="chart-container">
            <div className="chart-title">{selectedYear}年月度收支对比</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`]} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                <Bar dataKey="income" fill="#10B981" name="收入" />
                <Bar dataKey="expense" fill="#EF4444" name="支出" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <div className="chart-title">月度结余趋势</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`]} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="balance" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <div className="chart-title">月度明细</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left' }}>月份</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>收入</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>支出</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>结余</th>
                  </tr>
                </thead>
                <tbody>
                  {yearData.map(d => (
                    <tr key={d.month} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px' }}>{d.month}月</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#10B981', fontFamily: 'var(--font-mono)' }}>+{d.income.toFixed(2)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#EF4444', fontFamily: 'var(--font-mono)' }}>-{d.expense.toFixed(2)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: d.balance >= 0 ? '#10B981' : '#EF4444', fontFamily: 'var(--font-mono)' }}>
                        {d.balance >= 0 ? '+' : ''}{d.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === 'month' && (
        <>
          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setDetailDate(format(new Date(), 'yyyy-MM-dd'))}>
              + 添加本日记账
            </button>
          </div>
          <div className="analysis-cards">
            <div className="analysis-card">
              <div className="analysis-card-label">收入</div>
              <div className="analysis-card-value income">+{totalIncome.toFixed(2)}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-card-label">支出</div>
              <div className="analysis-card-value expense">-{totalExpense.toFixed(2)}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-card-label">结余</div>
              <div className={`analysis-card-value ${totalIncome - totalExpense >= 0 ? 'income' : 'expense'}`}>
                {(totalIncome - totalExpense).toFixed(2)}
              </div>
              <div className={`analysis-card-change ${chartData.comparePercent >= 0 ? 'positive' : 'negative'}`}>
                较上月 {chartData.comparePercent >= 0 ? '+' : ''}{chartData.comparePercent.toFixed(1)}%
              </div>
            </div>
            {netWorth !== null && (
              <div className="analysis-card">
                <div className="analysis-card-label">净资产</div>
                <div className={`analysis-card-value ${netWorth >= 0 ? 'income' : 'expense'}`}>
                  {netWorth.toFixed(2)}
                </div>
                <div className="analysis-card-change">
                  bill 账户余额合计
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
            <div className="chart-container">
              <div className="chart-title">支出分类</div>
              {chartData.expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={chartData.expensePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {chartData.expensePieData.map((entry: { color: string }, index: number) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (<div className="empty-state">暂无数据</div>)}
            </div>
            <div className="chart-container">
              <div className="chart-title">收入分类</div>
              {chartData.incomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={chartData.incomePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {chartData.incomePieData.map((entry: { color: string }, index: number) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (<div className="empty-state">暂无数据</div>)}
            </div>
          </div>

          {chartData.topCategories.length > 0 && (
            <div className="chart-container">
              <div className="chart-title">Top 5 支出分类</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chartData.topCategories.map((cat: { category: string; amount: number }, index: number) => {
                  const percentage = (cat.amount / totalExpense) * 100;
                  return (
                    <div key={cat.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>{cat.category}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>¥{cat.amount.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percentage}%`, background: COLORS[index % COLORS.length], borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'week' && (
        <>
          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setDetailDate(format(new Date(), 'yyyy-MM-dd'))}>
              + 添加本日记账
            </button>
          </div>
          <div className="analysis-cards">
            <div className="analysis-card">
              <div className="analysis-card-label">收入</div>
              <div className="analysis-card-value income">+{totalIncome.toFixed(2)}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-card-label">支出</div>
              <div className="analysis-card-value expense">-{totalExpense.toFixed(2)}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-card-label">结余</div>
              <div className={`analysis-card-value ${totalIncome - totalExpense >= 0 ? 'income' : 'expense'}`}>
                {(totalIncome - totalExpense).toFixed(2)}
              </div>
              <div className={`analysis-card-change ${chartData.comparePercent >= 0 ? 'positive' : 'negative'}`}>
                较上周 {chartData.comparePercent >= 0 ? '+' : ''}{chartData.comparePercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {chartData.dailyExpenseData.length > 0 && (
            <div className="chart-container">
              <div className="chart-title">每日支出趋势</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData.dailyExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`, '支出']} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px' }} />
                  <Line type="monotone" dataKey="amount" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
            <div className="chart-container">
              <div className="chart-title">支出分类</div>
              {chartData.expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={chartData.expensePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {chartData.expensePieData.map((entry: { color: string }, index: number) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (<div className="empty-state">暂无数据</div>)}
            </div>
            <div className="chart-container">
              <div className="chart-title">收入分类</div>
              {chartData.incomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={chartData.incomePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {chartData.incomePieData.map((entry: { color: string }, index: number) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (<div className="empty-state">暂无数据</div>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Accounting;
