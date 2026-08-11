import { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar/Calendar';
import { DateDetailModal } from './components/Calendar/DateDetailModal';
import { Accounting } from './components/Accounting/Accounting';
import { DayAccounting } from './components/Accounting/DayAccounting';
import { Notes } from './components/Notes/Notes';
import { Settings } from './components/Settings/Settings';
import { useAppStore } from './stores/appStore';
import './styles.css';

function App() {
  const { currentView, setCurrentView, setSelectedDate, loadTransactions, loadTheme, detailDate, setDetailDate } = useAppStore();
  const [showDateModal, setShowDateModal] = useState(false);
  const [modalDate, setModalDate] = useState<Date>(new Date());
  /** 启动 splash 三态:showing(展示)→ leaving(淡出)→ done(进入主界面);无需点击,延时自动进入 */
  const [splashState, setSplashState] = useState<'showing' | 'leaving' | 'done'>('showing');

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // 启动界面免点击:展示 1.3s 后淡出,0.3s 后进入主界面;用户点击可提前进入
  useEffect(() => {
    const t1 = setTimeout(() => setSplashState('leaving'), 1300);
    const t2 = setTimeout(() => setSplashState('done'), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    const handleBack = (e: Event) => {
      e.preventDefault();
      if (showDateModal) {
        setShowDateModal(false);
        return;
      }
      if (detailDate) {
        setDetailDate(null);
        return;
      }
    };
    window.addEventListener('popstate', handleBack);
    window.addEventListener('tauri://back-requested', handleBack);
    return () => {
      window.removeEventListener('popstate', handleBack);
      window.removeEventListener('tauri://back-requested', handleBack);
    };
  }, [showDateModal, detailDate, setDetailDate]);

  const handleDateClick = (date: Date) => {
    setModalDate(date);
    setSelectedDate(date);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    setShowDateModal(true);
  };

  const handleGoToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'calendar':
        return <Calendar onDateClick={handleDateClick} />;
      case 'accounting':
        return <Accounting />;
      case 'notes':
        return <Notes />;
      case 'settings':
        return <Settings />;
      default:
        return <Calendar onDateClick={handleDateClick} />;
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'calendar':
        return '日历';
      case 'accounting':
        return '记账分析';
      case 'notes':
        return '笔记';
      case 'settings':
        return '设置';
      default:
        return '日历';
    }
  };

  const navItems = [
    { key: 'calendar', label: '日历', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )},
    { key: 'accounting', label: '记账', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    )},
    { key: 'notes', label: '笔记', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )},
    { key: 'settings', label: '设置', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    )}
  ];

  if (splashState !== 'done') {
    return (
      <div className={`splash ${splashState === 'leaving' ? 'splash-leaving' : ''}`} onClick={() => setSplashState('done')}>
        <div className="splash-content">
          <div className="splash-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
              <rect x="3" y="4" width="18" height="18" rx="4" ry="4" />
              <line x1="15" y1="2" x2="15" y2="6" />
              <line x1="9" y1="2" x2="9" y2="6" />
              <line x1="6" y1="11" x2="18" y2="11" />
              <line x1="6" y1="14.5" x2="18" y2="14.5" />
              <line x1="6" y1="18" x2="12" y2="18" />
              <circle cx="17.5" cy="17.5" r="4" fill="currentColor" stroke="none" />
              <path d="M15.5 17.5 L17 19 L19.8 16" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="splash-title">RILI</h1>
          <p className="splash-subtitle">日历 · 记账 · 笔记</p>
          <p className="splash-tip">正在进入...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <h2 className="top-bar-title">{getViewTitle()}</h2>
          </div>
          <div className="top-bar-right">
            {currentView === 'calendar' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleGoToToday}
              >
                今天
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {renderContent()}
        </div>

        <nav className="bottom-tab-bar">
          {navItems.map(item => (
            <div
              key={item.key}
              className={`tab-item ${currentView === item.key ? 'active' : ''}`}
              onClick={() => setCurrentView(item.key as any)}
            >
              <div className="tab-icon">{item.icon}</div>
              <div className="tab-label">{item.label}</div>
            </div>
          ))}
        </nav>
      </main>

      {showDateModal && (
        <DateDetailModal
          date={modalDate}
          onClose={() => setShowDateModal(false)}
        />
      )}

      {detailDate && (
        <div className="modal-overlay" onClick={() => setDetailDate(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <DayAccounting date={detailDate} onClose={() => setDetailDate(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
