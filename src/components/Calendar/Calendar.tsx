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
import { pluginManager } from './plugins';

interface CalendarProps {
  onDateClick: (date: Date) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onDateClick }) => {
  const [view, setView] = useState<'month' | 'week'>('month');
  const { selectedDate, transactions, notes, loadTransactions, loadNotes, setSelectedDate } = useAppStore();
  const [currentDate, setCurrentDate] = useState(() => selectedDate);

  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

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
          <div className="calendar-title">
            {format(currentDate, 'yyyy年M月', { locale: zhCN })}
          </div>
          <div style={{ width: '60px' }}></div>
        </div>
        <div className="calendar-grid">
          <div className="calendar-weekday-row">
            {weekdays.map(w => (
              <div key={w} className="calendar-weekday">{w}</div>
            ))}
          </div>
          {days.map((d, i) => {
            const dateTransactions = getTransactionsForDate(d);
            const hasIncome = dateTransactions.some(t => t.transaction_type === 'income');
            const hasExpense = dateTransactions.some(t => t.transaction_type === 'expense');
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
                <div className="calendar-day-number">{format(d, 'd')}</div>
                {isCurrentMonth && (
                  <>
                    <div className="calendar-day-markers">
                      {hasNote && <span className="calendar-marker note" title="有笔记" />}
                      {hasIncome && <span className="calendar-marker income" title="有收入" />}
                      {hasExpense && <span className="calendar-marker expense" title="有支出" />}
                    </div>
                    {enabledPlugins.length > 0 && (
                      <div className="calendar-day-plugin">
                        {pluginManager.renderDay({
                          date: d,
                          isCurrentMonth,
                          isToday
                        }).map((result, idx) => (
                          <div 
                            key={idx} 
                            className={`plugin-badge ${result.className || ''}`}
                            title={result.tooltip || ''}
                          >
                            {result.content || result.badge}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!isCurrentMonth && enabledPlugins.length > 0 && (
                  <div className="calendar-day-plugin">
                    {pluginManager.renderDay({
                      date: d,
                      isCurrentMonth,
                      isToday
                    }).map((result, idx) => (
                      <div 
                        key={idx} 
                        className={`plugin-badge ${result.className || ''}`}
                        title={result.tooltip || ''}
                      >
                        {result.content || result.badge}
                      </div>
                    ))}
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

            return (
              <div
                key={i}
                className={`week-day ${isToday ? 'today' : ''}`}
                onClick={() => handleDateClick(d)}
              >
                <div className="week-day-header">
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
                </div>
                <div className="week-day-content">
                  {dateTransactions.slice(0, 3).map((t, j) => (
                    <div key={j} style={{ fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: t.transaction_type === 'income' ? '#10B981' : '#EF4444' }}>
                        {t.transaction_type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                      </span>
                      <span style={{ color: '#6B7280', marginLeft: '4px' }}>{t.category}</span>
                    </div>
                  ))}
                  {dateTransactions.length > 3 && (
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      +{dateTransactions.length - 3} 更多
                    </div>
                  )}
                  {hasNote && (
                    <div style={{ fontSize: '12px', color: '#4F46E5', marginTop: '4px' }}>
                      📝 有笔记
                    </div>
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
