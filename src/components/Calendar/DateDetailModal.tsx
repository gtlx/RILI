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
    addCategory
  } = useAppStore();
  
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [transactionForm, setTransactionForm] = useState({
    amount: '',
    transaction_type: 'expense' as 'income' | 'expense',
    category: '',
    note: '',
  });

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

  const handleAddTransaction = async () => {
    if (!transactionForm.amount || !transactionForm.category) return;
    
    await addTransaction({
      date: dateStr,
      amount: parseFloat(transactionForm.amount),
      transaction_type: transactionForm.transaction_type,
      category: transactionForm.category,
      note: transactionForm.note || undefined,
    });
    
    setTransactionForm({ amount: '', transaction_type: 'expense', category: '', note: '' });
    setShowTransactionForm(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    await addCategory({
      name: newCategoryName.trim(),
      category_type: transactionForm.transaction_type,
      icon: 'tag',
      color: '#6B7280',
      is_default: false,
    });
    
    setNewCategoryName('');
    setShowAddCategory(false);
    setTransactionForm({ ...transactionForm, category: newCategoryName.trim() });
  };

  const handleSaveNote = async () => {
    await saveNote(dateStr, currentNoteContent);
    setShowNoteEditor(false);
  };

  const handleDeleteNote = async () => {
    if (confirm('确定删除这篇笔记吗？')) {
      await deleteNote(dateStr);
      setShowNoteEditor(false);
    }
  };

  const totalIncome = dayTransactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = dayTransactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
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
        
        {showAddCategory && (
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div className="form-group">
              <label className="form-label">新增 {transactionForm.transaction_type === 'expense' ? '支出' : '收入'} 分类</label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称，如：日常、房租、水费、电费等"
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddCategory(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddCategory}>添加</button>
            </div>
          </div>
        )}
        
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
              
              <div className="card">
                <div className="card-header">
                  <div className="card-title">今日记账</div>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowTransactionForm(true)}>添加</button>
                </div>
                <div className="transaction-list">
                  {dayTransactions.length === 0 ? (
                    <div className="empty-state">
                      <p>暂无记账记录</p>
                    </div>
                  ) : (
                    dayTransactions.map((t, i) => (
                      <div key={i} className="transaction-item">
                        <div className={`transaction-icon ${t.transaction_type}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            {t.transaction_type === 'income' ? (
                              <path d="M12 19V5M5 12l7-7 7 7" />
                            ) : (
                              <path d="M12 5v14M5 12l7 7 7-7" />
                            )}
                          </svg>
                        </div>
                        <div className="transaction-details">
                          <div className="transaction-category">{t.category}</div>
                          {t.note && <div className="transaction-note">{t.note}</div>}
                        </div>
                        <div className={`transaction-amount ${t.transaction_type}`}>
                          {t.transaction_type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'transactions' && (
            <div>
              {!showTransactionForm ? (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">记账记录</div>
                    <button className="btn btn-sm btn-primary" onClick={() => setShowTransactionForm(true)}>添加</button>
                  </div>
                  <div className="transaction-list">
                    {dayTransactions.length === 0 ? (
                      <div className="empty-state">
                        <p>暂无记账记录</p>
                      </div>
                    ) : (
                      dayTransactions.map((t, i) => (
                        <div key={i} className="transaction-item">
                          <div className={`transaction-icon ${t.transaction_type}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                              {t.transaction_type === 'income' ? (
                                <path d="M12 19V5M5 12l7-7 7 7" />
                              ) : (
                                <path d="M12 5v14M5 12l7 7 7-7" />
                              )}
                            </svg>
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
                            style={{ marginLeft: '8px' }}
                            onClick={() => deleteTransaction(t.id!)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">添加记账</div>
                    <button className="btn btn-sm btn-secondary" onClick={() => setShowTransactionForm(false)}>取消</button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">类型</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={`btn ${transactionForm.transaction_type === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'expense' })}
                        style={{ flex: 1 }}
                      >
                        支出
                      </button>
                      <button
                        className={`btn ${transactionForm.transaction_type === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'income' })}
                        style={{ flex: 1 }}
                      >
                        收入
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">金额</label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      value={transactionForm.amount}
                      onChange={e => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">分类</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        className="select"
                        style={{ flex: 1 }}
                        value={transactionForm.category}
                        onChange={e => setTransactionForm({ ...transactionForm, category: e.target.value })}
                      >
                        <option value="">选择分类</option>
                        {(transactionForm.transaction_type === 'expense' ? categories.expense : categories.income).map(cat => (
                          <option key={cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setShowAddCategory(true)}
                        title="添加自定义分类"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">备注</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      value={transactionForm.note}
                      onChange={e => setTransactionForm({ ...transactionForm, note: e.target.value })}
                      placeholder="可选备注"
                    />
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAddTransaction}>
                    保存
                  </button>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'notes' && (
            <div>
              {!showNoteEditor ? (
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
                  {dayNote ? (
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
              ) : (
                <NoteEditor
                  content={currentNoteContent}
                  onChange={(content) => useAppStore.setState({ currentNoteContent: content })}
                  onSave={handleSaveNote}
                  onCancel={() => setShowNoteEditor(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ content, onChange, onSave, onCancel }) => {
  const insertText = (before: string, after: string = '') => {
    const textarea = document.querySelector('.note-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newText = content.substring(0, start) + before + selected + after + content.substring(end);
    onChange(newText);
  };

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <button className="note-toolbar-btn" onClick={() => insertText('**', '**')} title="粗体">
          <strong>B</strong>
        </button>
        <button className="note-toolbar-btn" onClick={() => insertText('*', '*')} title="斜体">
          <em>I</em>
        </button>
        <button className="note-toolbar-btn" onClick={() => insertText('## ')} title="标题">
          H
        </button>
        <button className="note-toolbar-btn" onClick={() => insertText('- ')} title="列表">
          •
        </button>
        <button className="note-toolbar-btn" onClick={() => insertText('[', '](url)')} title="链接">
          🔗
        </button>
      </div>
      <textarea
        className="note-textarea"
        value={content}
        onChange={e => onChange(e.target.value)}
        placeholder="在这里写下你的笔记... (支持 Markdown 格式)"
      />
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onCancel}>取消</button>
        <button className="btn btn-primary" onClick={onSave}>保存</button>
      </div>
    </div>
  );
};

export default DateDetailModal;
