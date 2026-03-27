import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAppStore } from '../../stores/appStore';

interface DateDetailModalProps {
  date: Date;
  onClose: () => void;
}

export const DateDetailModal: React.FC<DateDetailModalProps> = ({ date, onClose }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'transactions' | 'notes'>('all');
  const { 
    transactions, 
    notes, 
    categories,
    loadCategories,
    addTransaction,
    deleteTransaction,
    loadNote,
    saveNote,
    currentNoteContent,
    deleteNote,
    loadNotes
  } = useAppStore();
  
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');
  const dayTransactions = transactions.filter(t => t.date === dateStr);
  const dayNote = notes.find(n => n.date === dateStr);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (dayNote) {
      loadNote(dateStr);
    }
  }, [dayNote, dateStr, loadNote]);

  const handleSaveTransaction = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !category) {
      alert('请输入有效的金额和分类');
      return;
    }
    
    try {
      await addTransaction({
        date: dateStr,
        amount: numAmount,
        transaction_type: transactionType,
        category: category,
        note: note || undefined,
      });
      setAmount('');
      setCategory('');
      setNote('');
      setActiveTab('all');
    } catch (e) {
      alert('保存失败: ' + String(e));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    await useAppStore.getState().addCategory({
      name: newCategoryName.trim(),
      category_type: transactionType,
      icon: 'tag',
      color: '#6B7280',
      is_default: false,
    });
    
    setNewCategoryName('');
    setShowNewCategory(false);
    setCategory(newCategoryName.trim());
  };

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

  const handleDeleteTransaction = async (id: number) => {
    if (confirm('确定删除这条记录吗？')) {
      await deleteTransaction(id);
    }
  };

  const totalIncome = dayTransactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = dayTransactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentCategories = transactionType === 'expense' ? categories.expense : categories.income;

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
          <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>概览</div>
          <div className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>记账</div>
          <div className={`tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>笔记</div>
        </div>
        
        <div className="modal-body">
          {activeTab === 'all' && (
            <div>
              <div className="stats-summary">
                <div className="stat-item">
                  <div className="stat-icon income">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">收入</div>
                    <div className="stat-value" style={{ color: '#10B981' }}>+{totalIncome.toFixed(2)}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon expense">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">支出</div>
                    <div className="stat-value" style={{ color: '#EF4444' }}>-{totalExpense.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button 
                  className={`btn ${transactionType === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTransactionType('expense'); setCategory(''); }}
                  style={{ flex: 1 }}
                >
                  支出
                </button>
                <button 
                  className={`btn ${transactionType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTransactionType('income'); setCategory(''); }}
                  style={{ flex: 1 }}
                >
                  收入
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">金额</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">分类</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="select"
                    style={{ flex: 1 }}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option value="">选择分类</option>
                    {currentCategories.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowNewCategory(true)}
                  >
                    +
                  </button>
                </div>
              </div>

              {showNewCategory && (
                <div className="form-group">
                  <label className="form-label">新增分类</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1 }}
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="分类名称"
                      onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                    />
                    <button className="btn btn-primary" onClick={handleAddCategory}>添加</button>
                    <button className="btn btn-secondary" onClick={() => setShowNewCategory(false)}>取消</button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">备注 (可选)</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="备注"
                />
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveTransaction}>
                保存
              </button>

              {dayTransactions.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <div className="card-title" style={{ marginBottom: '12px' }}>今日记录</div>
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
                      <button 
                        className="btn btn-icon btn-sm" 
                        style={{ marginLeft: '8px', color: '#EF4444' }}
                        onClick={() => handleDeleteTransaction(t.id!)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'transactions' && (
            <div>
              {dayTransactions.length === 0 ? (
                <div className="empty-state">
                  <p>暂无记账记录</p>
                  <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('all')}>
                    添加记录
                  </button>
                </div>
              ) : (
                <div className="transaction-list">
                  {dayTransactions.map(t => (
                    <div key={t.id} className="transaction-item">
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
                      <button 
                        className="btn btn-icon btn-sm" 
                        style={{ marginLeft: '8px', color: '#EF4444' }}
                        onClick={() => handleDeleteTransaction(t.id!)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
