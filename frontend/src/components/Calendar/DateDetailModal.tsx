import React, { useState, useEffect } from 'react';
import { format, getDayOfYear, getWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAppStore } from '../../stores/appStore';
import lunarCalendar from 'lunar-calendar';

interface DateDetailModalProps {
  date: Date;
  onClose: () => void;
}

const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const LUNAR_DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
const ZODIAC_NAMES = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const HOLIDAYS: Record<string, string> = {
  '01-01': '元旦', '02-14': '情人节', '03-08': '妇女节', '03-12': '植树节',
  '04-01': '愚人节', '05-01': '劳动节', '05-04': '青年节', '06-01': '儿童节',
  '07-01': '建党节', '08-01': '建军节', '09-10': '教师节', '10-01': '国庆节', '12-25': '圣诞节',
};

export const DateDetailModal: React.FC<DateDetailModalProps> = ({ date, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'accounting' | 'notes'>('overview');
  const { notes, loadNote, saveNote, currentNoteContent, deleteNote, loadNotes, transactions } = useAppStore();
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');
  const dayNote = notes.find(n => n.date === dateStr);

  useEffect(() => {
    if (dayNote) {
      loadNote(dateStr);
    }
  }, [dayNote, dateStr, loadNote]);

  useEffect(() => {
    if (activeTab === 'notes') {
      loadNote(dateStr);
    }
  }, [activeTab, dateStr, loadNote]);

  const lunar = (() => {
    try {
      const l = lunarCalendar.solarToLunar(date.getFullYear(), date.getMonth() + 1, date.getDate()) as any;
      if (!l) return null;
      const monthIdx = l.lunarMonthName ? LUNAR_MONTH_NAMES.indexOf(l.lunarMonthName) + 1 : l.lunarMonth;
      const lunarMonthName = l.lunarLeapMonth > 0 ? '闰' + LUNAR_MONTH_NAMES[monthIdx] : LUNAR_MONTH_NAMES[monthIdx] || '';
      const lunarDayName = LUNAR_DAY_NAMES[l.lunarDay - 1] || '';
      return {
        lunarMonthName,
        lunarDayName,
        zodiac: ZODIAC_NAMES[(l.lunarYear - 4) % 12] || '',
        solarTerm: l.term || '',
        yearName: `${['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][Math.floor(l.lunarYear / 1000)]}${['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][Math.floor((l.lunarYear % 1000) / 100)]}${['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][Math.floor((l.lunarYear % 100) / 10)]}${['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][l.lunarYear % 10]}`,
      };
    } catch { return null; }
  })();

  const holiday = HOLIDAYS[format(date, 'MM-dd')] || null;

  const dayTransactions = transactions.filter(t => t.date === dateStr);
  const dayIncome = dayTransactions.filter(t => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
  const dayExpense = dayTransactions.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);

  const handleSaveNote = async () => {
    await saveNote(dateStr, currentNoteContent);
    await loadNotes();
    setShowNoteEditor(false);
  };

  const handleDeleteNote = async () => {
    if (confirm('确定删除这篇笔记吗？')) {
      await deleteNote(dateStr);
      await loadNotes();
      setShowNoteEditor(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div className="modal-title">{format(date, 'yyyy年M月d日', { locale: zhCN })}</div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="tabs" style={{ padding: '0 16px' }}>
          <div className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>概览</div>
          <div className={`tab ${activeTab === 'accounting' ? 'active' : ''}`} onClick={() => setActiveTab('accounting')}>记账</div>
          <div className={`tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>笔记</div>
        </div>

        <div className="modal-body">
          {activeTab === 'overview' && (
            <div>
              <div className="date-info-card">
                <div className="date-info-row">
                  <span className="date-info-label">星期</span>
                  <span className="date-info-value">{WEEKDAY_NAMES[date.getDay()]}</span>
                </div>
                {lunar && (
                  <>
                    <div className="date-info-row">
                      <span className="date-info-label">农历</span>
                      <span className="date-info-value">{lunar.lunarMonthName} {lunar.lunarDayName}</span>
                    </div>
                    <div className="date-info-row">
                      <span className="date-info-label">干支</span>
                      <span className="date-info-value">{lunar.yearName}年 生肖{lunar.zodiac}</span>
                    </div>
                  </>
                )}
                {lunar?.solarTerm && (
                  <div className="date-info-row">
                    <span className="date-info-label">节气</span>
                    <span className="date-info-value solar-term">{lunar.solarTerm}</span>
                  </div>
                )}
                {holiday && (
                  <div className="date-info-row">
                    <span className="date-info-label">节日</span>
                    <span className="date-info-value holiday">{holiday}</span>
                  </div>
                )}
              </div>

              <div className="date-info-card" style={{ marginTop: '12px' }}>
                <div className="date-info-row">
                  <span className="date-info-label">今年第</span>
                  <span className="date-info-value">{getDayOfYear(date)} 天</span>
                </div>
                <div className="date-info-row">
                  <span className="date-info-label">第</span>
                  <span className="date-info-value">{getWeek(date)} 周</span>
                </div>
                <div className="date-info-row">
                  <span className="date-info-label">季度</span>
                  <span className="date-info-value">第 {Math.floor(date.getMonth() / 3) + 1} 季度</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounting' && (
            <div>
              <div className="date-info-card">
                <div className="date-info-row">
                  <span className="date-info-label">收入</span>
                  <span className="date-info-value" style={{ color: '#10B981' }}>+{dayIncome.toFixed(2)}</span>
                </div>
                <div className="date-info-row">
                  <span className="date-info-label">支出</span>
                  <span className="date-info-value" style={{ color: '#EF4444' }}>-{dayExpense.toFixed(2)}</span>
                </div>
                <div className="date-info-row">
                  <span className="date-info-label">结余</span>
                  <span className="date-info-value" style={{ color: dayIncome - dayExpense >= 0 ? '#10B981' : '#EF4444' }}>
                    {(dayIncome - dayExpense).toFixed(2)}
                  </span>
                </div>
              </div>

              {dayTransactions.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  {dayTransactions.map(t => (
                    <div key={t.id} className="transaction-item" style={{ marginBottom: '8px' }}>
                      <div className={`transaction-icon ${t.transaction_type}`}>
                        <span style={{ fontSize: '12px' }}>{t.transaction_type === 'income' ? '↑' : '↓'}</span>
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-category">{t.category}</div>
                        {t.note && <div className="transaction-note">{t.note}</div>}
                      </div>
                      <div className={`transaction-amount ${t.transaction_type}`}>
                        {t.transaction_type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dayTransactions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  暂无记账记录
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                  onClose();
                  useAppStore.getState().setDetailDate(dateStr);
                }}>
                  添加记录
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              {showNoteEditor ? (
                <div className="note-editor">
                  <textarea
                    className="note-textarea"
                    value={currentNoteContent}
                    onChange={e => useAppStore.setState({ currentNoteContent: e.target.value })}
                    placeholder="在这里写下你的笔记... (支持 Markdown 格式)"
                  />
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowNoteEditor(false)}>取消</button>
                    <button className="btn btn-primary" onClick={handleSaveNote}>保存</button>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">笔记</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {dayNote && (
                        <button className="btn btn-sm btn-secondary" onClick={() => setShowNoteEditor(true)}>编辑</button>
                      )}
                      {dayNote && (
                        <button className="btn btn-sm btn-danger" onClick={handleDeleteNote}>删除</button>
                      )}
                    </div>
                  </div>
                  {currentNoteContent ? (
                    <div className="note-preview" style={{ whiteSpace: 'pre-wrap' }}>
                      {currentNoteContent}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>暂无笔记</p>
                      <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowNoteEditor(true)}>
                        添加笔记
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateDetailModal;
