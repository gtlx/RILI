import { useState, useEffect, useMemo } from 'react';
import { format, getWeek } from 'date-fns';
import { useAppStore, MonthlyAnalysis, WeeklyAnalysis } from '../../stores/appStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { invoke } from '@tauri-apps/api/core';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6B7280', '#3B82F6', '#6366F1'];

interface YearMonthData {
  month: number;
  income: number;
  expense: number;
  balance: number;
}

export const Accounting: React.FC = () => {
  const [view, setView] = useState<'week' | 'month' | 'year'>('month');
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedWeek] = useState(getWeek(new Date()));
  const [yearData, setYearData] = useState<YearMonthData[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  
  const { loadTransactions, loadCategories, weeklyAnalysis, monthlyAnalysis, loadWeeklyAnalysis, loadMonthlyAnalysis } = useAppStore();

  const loadInitialBalance = async () => {
    try {
      const balance = await invoke<string | null>('get_setting', { key: 'initial_balance' });
      setInitialBalance(balance ? parseFloat(balance) : 0);
    } catch {
      setInitialBalance(0);
    }
  };

  useEffect(() => {
    loadCategories();
    loadInitialBalance();
    const date = new Date(selectedYear, selectedMonth - 1, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    loadTransactions(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  }, [selectedYear, selectedMonth, loadTransactions, loadCategories]);

  useEffect(() => {
    if (view === 'week') {
      loadWeeklyAnalysis(selectedYear, selectedWeek);
    } else if (view === 'month') {
      loadMonthlyAnalysis(selectedYear, selectedMonth);
    }
  }, [view, selectedYear, selectedMonth, selectedWeek, loadWeeklyAnalysis, loadMonthlyAnalysis]);

  useEffect(() => {
    if (view === 'year') {
      loadYearData();
    }
  }, [view, selectedYear]);

  const loadYearData = async () => {
    const months: YearMonthData[] = [];
    for (let m = 1; m <= 12; m++) {
      try {
        const analysis = await invoke<MonthlyAnalysis>('get_monthly_analysis', { year: selectedYear, month: m });
        months.push({
          month: m,
          income: analysis.total_income,
          expense: analysis.total_expense,
          balance: analysis.total_income - analysis.total_expense
        });
      } catch {
        months.push({ month: m, income: 0, expense: 0, balance: 0 });
      }
    }
    setYearData(months);
  };

  const yearChartData = useMemo(() => {
    return yearData.map(d => ({
      name: `${d.month}月`,
      income: d.income,
      expense: d.expense,
      balance: d.balance
    }));
  }, [yearData]);

  const yearTotalIncome = useMemo(() => yearData.reduce((sum, d) => sum + d.income, 0), [yearData]);
  const yearTotalExpense = useMemo(() => yearData.reduce((sum, d) => sum + d.expense, 0), [yearData]);

  const getTitle = () => {
    if (view === 'year') return `${selectedYear}年分析`;
    if (view === 'month') return `${selectedYear}年${selectedMonth}月分析`;
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
      expensePieData = wa.expense_by_category.map((item: { category: string; amount: number }, index: number) => ({
        name: item.category,
        value: item.amount,
        color: COLORS[index % COLORS.length]
      }));
      incomePieData = wa.income_by_category.map((item: { category: string; amount: number }, index: number) => ({
        name: item.category,
        value: item.amount,
        color: COLORS[index % COLORS.length]
      }));
      dailyExpenseData = wa.daily_expense.map((item: { date: string; amount: number }) => ({
        date: format(new Date(item.date), 'M/d'),
        amount: item.amount
      }));
      comparePercent = wa.compare_to_last_week;
    } else if (!isWeekly && monthlyAnalysis) {
      const ma = monthlyAnalysis as MonthlyAnalysis;
      expensePieData = ma.expense_by_category.map((item: { category: string; amount: number }, index: number) => ({
        name: item.category,
        value: item.amount,
        color: COLORS[index % COLORS.length]
      }));
      incomePieData = ma.income_by_category.map((item: { category: string; amount: number }, index: number) => ({
        name: item.category,
        value: item.amount,
        color: COLORS[index % COLORS.length]
      }));
      comparePercent = ma.compare_to_last_month;
      topCategories = ma.top_categories || [];
    }

    return { expensePieData, incomePieData, dailyExpenseData, comparePercent, topCategories };
  }, [isWeekly, weeklyAnalysis, monthlyAnalysis]);

  const totalIncome = isWeekly 
    ? (weeklyAnalysis as WeeklyAnalysis)?.total_income || 0 
    : (monthlyAnalysis as MonthlyAnalysis)?.total_income || 0;
  const totalExpense = isWeekly 
    ? (weeklyAnalysis as WeeklyAnalysis)?.total_expense || 0 
    : (monthlyAnalysis as MonthlyAnalysis)?.total_expense || 0;

  if (view !== 'year' && !weeklyAnalysis && !monthlyAnalysis) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="calendar" style={{ marginBottom: '24px' }}>
        <div className="calendar-header">
          <div style={{ width: '60px' }}></div>
          <div className="calendar-title">{getTitle()}</div>
          <div className="calendar-nav">
            <button className={`btn btn-sm ${view === 'year' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('year')}>
              年
            </button>
            <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('month')}>
              月
            </button>
            <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('week')}>
              周
            </button>
          </div>
        </div>
      </div>

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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`]} contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px' }} />
                <Bar dataKey="income" fill="#10B981" name="收入" />
                <Bar dataKey="expense" fill="#EF4444" name="支出" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-container">
            <div className="chart-title">月度结余趋势</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`]} contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px' }} />
                <Line type="monotone" dataKey="balance" stroke="#4F46E5" strokeWidth={2} dot={{ fill: '#4F46E5' }} />
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
            <div className="analysis-card">
              <div className="analysis-card-label">净资产</div>
              <div className={`analysis-card-value ${initialBalance + totalIncome - totalExpense >= 0 ? 'income' : 'expense'}`}>
                {(initialBalance + totalIncome - totalExpense).toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
            <div className="chart-container">
              <div className="chart-title">支出分类</div>
              {chartData.expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={chartData.expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.expensePieData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">暂无数据</div>
              )}
            </div>

            <div className="chart-container">
              <div className="chart-title">收入分类</div>
              {chartData.incomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={chartData.incomePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.incomePieData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">暂无数据</div>
              )}
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
                      <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`, '支出']} contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px' }} />
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
                    <Pie
                      data={chartData.expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.expensePieData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">暂无数据</div>
              )}
            </div>

            <div className="chart-container">
              <div className="chart-title">收入分类</div>
              {chartData.incomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData.incomePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.incomePieData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">暂无数据</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Accounting;
