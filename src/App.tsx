import { useState } from 'react';
import { Calendar } from './components/Calendar/Calendar';
import { DateDetailModal } from './components/Calendar/DateDetailModal';
import { Accounting } from './components/Accounting/Accounting';
import { Notes } from './components/Notes/Notes';
import { Settings } from './components/Settings/Settings';
import { useAppStore } from './stores/appStore';
import './styles.css';

function App() {
  const { currentView, setCurrentView, setSelectedDate, loadTransactions, lastSyncTime } = useAppStore();
  const [showDateModal, setShowDateModal] = useState(false);
  const [modalDate, setModalDate] = useState<Date>(new Date());

  const handleDateClick = (date: Date) => {
    setModalDate(date);
    setSelectedDate(date);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    loadTransactions(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    setShowDateModal(true);
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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>RILI</h1>
        </div>
        <nav className="sidebar-nav">
          <div
            className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => setCurrentView('calendar')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>日历</span>
          </div>
          <div
            className={`nav-item ${currentView === 'accounting' ? 'active' : ''}`}
            onClick={() => setCurrentView('accounting')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            <span>记账分析</span>
          </div>
          <div
            className={`nav-item ${currentView === 'notes' ? 'active' : ''}`}
            onClick={() => setCurrentView('notes')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
            <span>笔记</span>
          </div>
          <div
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>设置</span>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <h2 className="top-bar-title">{getViewTitle()}</h2>
          </div>
          <div className="top-bar-right">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleDateClick(new Date())}
            >
              回到今天
            </button>
          </div>
        </header>

        <div className="content">
          {renderContent()}
        </div>

        <footer className="bottom-bar">
          <div>RILI 日历记账笔记 v0.1.0</div>
          {lastSyncTime && <div>最后同步: {lastSyncTime}</div>}
        </footer>
      </main>

      {showDateModal && (
        <DateDetailModal
          date={modalDate}
          onClose={() => setShowDateModal(false)}
        />
      )}
    </div>
  );
}

export default App;
