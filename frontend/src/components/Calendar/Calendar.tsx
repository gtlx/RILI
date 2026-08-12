import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAppStore } from '../../stores/appStore';
import { useTodoStore } from '../../stores/todoStore';
import { pluginManager } from './plugins';
import { YearMonthPicker } from './YearMonthPicker';

interface CalendarProps {
  onDateClick: (date: Date) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onDateClick }) => {
  const [view, setView] = useState<'month' | 'week'>('month');
  const { selectedDate, transactions, notes, loadTransactions, loadNotes, setSelectedDate } = useAppStore();
  const todos = useTodoStore(s => s.todos);
  const loadTodos = useTodoStore(s => s.loadTodos);
  const [currentDate, setCurrentDate] = useState(() => selectedDate);
  /** 年月选择器浮层开关 */
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // 日历页加载时载入本地待办(用于格子标记)
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  /**
   * 移动端日历格子高度屏幕自适应(方案 B):
   * 量 window.innerHeight,减去顶栏/日历header/星期行/底栏/上下padding/gap 等实际占用,
   * 余量除以 6 行得到每行目标高度,写入 CSS 变量 --cal-row-h(移动端 minmax 的 max)。
   * 桌面端不设(保持 88px 固定)。resize 时重算。
   */
  useEffect(() => {
    const compute = () => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        document.documentElement.style.removeProperty('--cal-row-h');
        return;
      }
      // 各区域实际高度(取不到用经验值兜底):
      //   顶栏 ~48 / 日历 header ~60 / 星期行 ~30 / 底栏 ~64 / content padding 上下(16+88) / grid gap 6行×3
      const topBar = document.querySelector('.top-bar')?.getBoundingClientRect().height ?? 48;
      const calHeader = document.querySelector('.calendar-header')?.getBoundingClientRect().height ?? 60;
      const weekdayRow = document.querySelector('.calendar-weekday-row')?.getBoundingClientRect().height ?? 30;
      const bottomBar = document.querySelector('.bottom-tab-bar')?.getBoundingClientRect().height ?? 64;
      const paddingTop = 16, paddingBottom = 88, gapTotal = 6 * 3;
      const available = window.innerHeight - topBar - calHeader - weekdayRow - bottomBar - paddingTop - paddingBottom - gapTotal;
      // 每行至少 66px(内容塞得下的下限);屏幕高时自动放大填满
      const rowH = Math.max(66, Math.floor(available / 6));
      document.documentElement.style.setProperty('--cal-row-h', `${rowH}px`);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  /** 待办索引:日期(或 MM-DD 年度重复) → 未完成待办数 */
  const todoIndex = useMemo(() => {
    const idx = new Map<string, { count: number; hasYearly: boolean }>();
    todos.forEach(t => {
      if (t.done) return;
      const key = t.repeat === 'yearly' ? t.date.slice(5) : t.date;
      const cur = idx.get(key) || { count: 0, hasYearly: false };
      cur.count += 1;
      if (t.repeat === 'yearly') cur.hasYearly = true;
      idx.set(key, cur);
    });
    return idx;
  }, [todos]);

  const getTodoCount = useCallback((d: Date) => {
    const dStr = format(d, 'yyyy-MM-dd');
    const direct = todoIndex.get(dStr);
    const yearly = todoIndex.get(dStr.slice(5));
    const count = (direct?.count || 0) + (yearly?.count || 0);
    return count;
  }, [todoIndex]);

  /** 当天未完成待办标题列表(含每年重复);周视图显示内容用 */
  const getTodosForDate = useCallback((d: Date) => {
    const dStr = format(d, 'yyyy-MM-dd');
    const mmdd = dStr.slice(5);
    return todos
      .filter(t => !t.done && (t.repeat === 'yearly' ? t.date.slice(5) === mmdd : t.date === dStr))
      .map(t => t.title);
  }, [todos]);

  const enabledPlugins = useMemo(() => pluginManager.getEnabledPlugins(), []);

  const today = useMemo(() => new Date(), []);

  const transactionIndex = useMemo(() => {
    const idx = new Map<string, typeof transactions>();
    transactions.forEach(t => {
      const arr = idx.get(t.date) || [];
      arr.push(t);
      idx.set(t.date, arr);
    });
    return idx;
  }, [transactions]);

  const noteIndex = useMemo(() => {
    const idx = new Set<string>();
    notes.forEach(n => idx.add(n.date));
    return idx;
  }, [notes]);

  useEffect(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    loadTransactions(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    loadNotes();
  }, [selectedDate, loadTransactions, loadNotes]);

  const getTransactionsForDate = useCallback((date: Date) => {
    return transactionIndex.get(format(date, 'yyyy-MM-dd')) || [];
  }, [transactionIndex]);

  const hasNoteOnDate = useCallback((date: Date) => {
    return noteIndex.has(format(date, 'yyyy-MM-dd'));
  }, [noteIndex]);

  const handleDateClick = (date: Date) => {
    if (!isSameMonth(date, currentDate)) {
      setCurrentDate(date);
      setSelectedDate(date);
    }
    onDateClick(date);
  };

  const handleNavigation = (date: Date) => {
    setCurrentDate(date);
    setSelectedDate(date);
  };

  /** 年月选择器:跳转到指定年/月 */
  const handleJumpTo = (year: number, month: number) => {
    const target = new Date(year, month - 1, 1);
    setCurrentDate(target);
    setSelectedDate(target);
    setShowPicker(false);
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
      <div className="calendar">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="btn btn-icon btn-secondary" onClick={() => handleNavigation(subMonths(currentDate, 1))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="calendar-nav-center">
              <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('month')}>
                月
              </button>
              <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('week')}>
                周
              </button>
            </div>
            <button className="btn btn-icon btn-secondary" onClick={() => handleNavigation(addDays(endOfMonth(currentDate), 1))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
          {/* 标题区:grid 三列等宽让标题相对整体居中;点击可跳转任意年月 */}
          <button className="calendar-title" onClick={() => setShowPicker(true)} title="点击跳转年月">
            {format(currentDate, 'yyyy年M月', { locale: zhCN })}
          </button>
          <div className="calendar-header-right">
            <button className="btn btn-icon btn-secondary" onClick={() => setShowPicker(true)} title="跳转年月">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>
          </div>
        </div>
        {showPicker && (
          <div className="ym-picker-overlay" onClick={() => setShowPicker(false)}>
            <YearMonthPicker
              year={currentDate.getFullYear()}
              month={currentDate.getMonth() + 1}
              onPick={handleJumpTo}
              onClose={() => setShowPicker(false)}
            />
          </div>
        )}
        <div className="calendar-grid">
          <div className="calendar-weekday-row">
            {weekdays.map((w, i) => (
              <div key={w} className={`calendar-weekday ${i === 0 || i === 6 ? 'is-weekend' : ''}`}>{w}</div>
            ))}
          </div>
          {days.map((d, i) => {
            const dateTransactions = getTransactionsForDate(d);
            const incomeTotal = dateTransactions.filter(t => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
            const expenseTotal = dateTransactions.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
            const hasNote = hasNoteOnDate(d);
            const isToday = isSameDay(d, today);
            const isCurrentMonth = isSameMonth(d, currentDate);

            return (
              <div
                key={i}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => {
                  if (!isCurrentMonth) {
                    handleNavigation(d);
                  } else {
                    handleDateClick(d);
                  }
                }}
              >
                <div className="calendar-day-top">
                  <div className="calendar-day-number">{format(d, 'd')}</div>
                  {isCurrentMonth && (
                    <div className="calendar-day-markers">
                      {hasNote && <span className="calendar-marker note" title="有笔记" />}
                      {(() => {
                        const tc = getTodoCount(d);
                        return tc > 0 ? <span className="calendar-marker todo" title={`${tc} 项待办`} /> : null;
                      })()}
                    </div>
                  )}
                </div>
                {enabledPlugins.length > 0 && (() => {
                  // 按行分类渲染:农历(第二行)/节日(第三行)/节气等其他(第四行)
                  // className 约定:空或 lunar-month-start=农历;festival/holiday=节日;solar-term=节气
                  const results = pluginManager.renderDay({ date: d, isCurrentMonth, isToday });
                  const isLunar = (r: { className?: string }) => !r.className || r.className === 'lunar-month-start' || r.className.includes('lunar');
                  const isFestival = (r: { className?: string }) => !!r.className && (r.className.includes('festival') || r.className.includes('holiday'));
                  const isOther = (r: { className?: string }) => !!r.className && r.className.includes('solar');
                  const rows = [
                    results.filter(isLunar),
                    results.filter(isFestival),
                    results.filter(isOther),
                  ];
                  return (
                    <>
                      {rows.map((row, ri) => row.length > 0 ? (
                        <div key={ri} className={`calendar-day-line line-${ri}`}>
                          {row.map((result, idx) => {
                            // 内容较长(如四字节日名)时缩字号,避免固定格子内溢出
                            const text = result.content || result.badge || '';
                            const long = text.length > 3 ? ' badge-long' : '';
                            return (
                              <div 
                                key={idx} 
                                className={`plugin-badge ${result.className || ''}${long}`}
                                title={result.tooltip || ''}
                              >
                                {text}
                              </div>
                            );
                          })}
                        </div>
                      ) : null)}
                    </>
                  );
                })()}
                {isCurrentMonth && (incomeTotal > 0 || expenseTotal > 0) && (
                  <div className="calendar-day-amounts" title={`收入 +${incomeTotal.toFixed(2)} / 支出 -${expenseTotal.toFixed(2)}`}>
                    {expenseTotal > 0 && <span className="amount expense">-{expenseTotal.toFixed(2)}</span>}
                    {incomeTotal > 0 && <span className="amount income">+{incomeTotal.toFixed(2)}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }

    return (
      <div className="calendar">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="btn btn-icon btn-secondary" onClick={() => handleNavigation(addDays(weekStart, -7))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="calendar-nav-center">
              <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('month')}>
                月
              </button>
              <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('week')}>
                周
              </button>
            </div>
            <button className="btn btn-icon btn-secondary" onClick={() => handleNavigation(addDays(weekStart, 7))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
          <div className="calendar-title">
            {format(weekStart, 'yyyy年M月d日', { locale: zhCN })} - {format(addDays(weekStart, 6), 'M月d日', { locale: zhCN })}
          </div>
          <div style={{ width: '60px' }}></div>
        </div>
        <div className="week-view">
          {days.map((d, i) => {
            const dateTransactions = getTransactionsForDate(d);
            const hasNote = hasNoteOnDate(d);
            const isToday = isSameDay(d, today);
            const pluginResults = enabledPlugins.length > 0 
              ? pluginManager.renderWeekCell({ date: d, isCurrentMonth: true, isToday })
              : [];
            const todoCount = getTodoCount(d);
            const dayTodos = getTodosForDate(d);

            return (
              <div
                key={i}
                className={`week-day ${isToday ? 'today' : ''}`}
                onClick={() => handleDateClick(d)}
              >
                {/* 左侧:星期/日期/节日/待办标记 */}
                <div className="week-day-side">
                  <div className="week-day-name">{format(d, 'EEE', { locale: zhCN })}</div>
                  <div className="week-day-date">{format(d, 'd')}</div>
                  {pluginResults.length > 0 && (
                    <div className="week-day-plugin">
                      {pluginResults.map((result, idx) => (
                        <div key={idx} className={`plugin-text ${result.className || ''}`}>
                          {result.content}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="week-day-markers">
                    {hasNote && <span className="calendar-marker note" title="有笔记" />}
                    {todoCount > 0 && <span className="calendar-marker todo" title={`${todoCount} 项待办`} />}
                  </div>
                </div>
                {/* 右侧:待办内容/收支明细/笔记 */}
                <div className="week-day-content">
                  {dayTodos.length > 0 && (
                    <div className="week-day-todos">
                      {dayTodos.slice(0, 3).map((title, j) => (
                        <div key={j} className="week-day-todo">
                          <span className="week-day-todo-dot" />
                          <span className="week-day-todo-title">{title}</span>
                        </div>
                      ))}
                      {dayTodos.length > 3 && (
                        <div className="week-day-more">+{dayTodos.length - 3} 项待办</div>
                      )}
                    </div>
                  )}
                  {dateTransactions.length === 0 && !hasNote && dayTodos.length === 0 ? (
                    <div className="week-day-empty">无记录</div>
                  ) : (
                    <>
                      {dateTransactions.slice(0, 4).map((t, j) => (
                        <div key={j} className="week-day-tx">
                          <span className={`week-day-tx-amount ${t.transaction_type}`}>
                            {t.transaction_type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                          </span>
                          <span className="week-day-tx-cat">{t.category}</span>
                        </div>
                      ))}
                      {dateTransactions.length > 4 && (
                        <div className="week-day-more">+{dateTransactions.length - 4} 更多</div>
                      )}
                      {hasNote && (
                        <div className="week-day-note">📝 有笔记</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return view === 'month' ? renderMonthView() : renderWeekView();
};

export default Calendar;
