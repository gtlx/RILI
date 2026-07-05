import { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { useAppStore } from '../../stores/appStore';

interface DayAccountingProps {
  date: string;
  onClose: () => void;
}

export const DayAccounting: React.FC<DayAccountingProps> = ({ date, onClose }) => {
  const [currentDate, setCurrentDate] = useState(date);
  const {
    transactions, loadTransactions,
    categories, loadCategories, addTransaction, updateTransaction, deleteTransaction, addCategory,
  } = useAppStore();

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadTransactions(currentDate, currentDate);
  }, [currentDate, loadTransactions]);

  const dayTransactions = transactions.filter(t => t.date === currentDate);
  const dayIncome = dayTransactions.filter(t => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
  const dayExpense = dayTransactions.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);

  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [txNote, setTxNote] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const currentCategories = txType === 'expense' ? categories.expense : categories.income;

  const resetForm = () => {
    setAmount(''); setCategory(''); setTxNote(''); setEditingId(null);
  };

  const handleSaveTransaction = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !category) { alert('请输入有效的金额和分类'); return; }
    if (!editingId) {
      const duplicate = dayTransactions.find(t =>
        t.amount === numAmount && t.category === category && t.note === (txNote || undefined)
      );
      if (duplicate && !confirm('检测到与已有记录重复，是否继续保存？')) return;
    }
    try {
      if (editingId) {
        await updateTransaction({ id: editingId, date: currentDate, amount: numAmount, transaction_type: txType, category, note: txNote || undefined, version: 1, is_deleted: false });
      } else {
        await addTransaction({ date: currentDate, amount: numAmount, transaction_type: txType, category, note: txNote || undefined, version: 1, is_deleted: false });
      }
      resetForm();
      await loadTransactions(currentDate, currentDate);
    } catch (e) { alert('保存失败: ' + String(e)); }
  };

  const handleEditTx = (t: typeof dayTransactions[0]) => {
    setTxType(t.transaction_type);
    setAmount(String(t.amount));
    setCategory(t.category);
    setTxNote(t.note || '');
    setEditingId(t.id ?? null);
  };

  const handleDeleteTx = async (id: number) => {
    if (confirm('确定删除这条记录吗？')) {
      await deleteTransaction(id);
      if (editingId === id) resetForm();
      await loadTransactions(currentDate, currentDate);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addCategory({ name: newCategoryName.trim(), category_type: txType, icon: 'tag', color: '#6B7280', is_default: false });
    setNewCategoryName(''); setShowNewCategory(false); setCategory(newCategoryName.trim());
  };

  const goPrevDay = () => setCurrentDate(d => format(subDays(new Date(d), 1), 'yyyy-MM-dd'));
  const goNextDay = () => setCurrentDate(d => format(addDays(new Date(d), 1), 'yyyy-MM-dd'));

  return (
    <div className="day-accounting">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          ← 返回
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={goPrevDay}>←</button>
          <span style={{ fontSize: '18px', fontWeight: 600 }}>{format(new Date(currentDate), 'yyyy年M月d日')}</span>
          <button className="btn btn-secondary btn-sm" onClick={goNextDay}>→</button>
        </div>
        <div style={{ width: '60px' }} />
      </div>

      <div className="analysis-cards" style={{ marginBottom: '24px' }}>
        <div className="analysis-card">
          <div className="analysis-card-label">收入</div>
          <div className="analysis-card-value income">+{dayIncome.toFixed(2)}</div>
        </div>
        <div className="analysis-card">
          <div className="analysis-card-label">支出</div>
          <div className="analysis-card-value expense">-{dayExpense.toFixed(2)}</div>
        </div>
        <div className="analysis-card">
          <div className="analysis-card-label">结余</div>
          <div className={`analysis-card-value ${dayIncome - dayExpense >= 0 ? 'income' : 'expense'}`}>
            {(dayIncome - dayExpense).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '12px' }}>
          {editingId ? '编辑记录' : '添加记录'}
          {editingId && <button className="btn btn-sm btn-secondary" style={{ marginLeft: '8px' }} onClick={resetForm}>取消</button>}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <button className={`btn ${txType === 'expense' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTxType('expense'); setCategory(''); }} style={{ flex: 1, fontSize: '13px', padding: '6px 12px' }}>支出</button>
          <button className={`btn ${txType === 'income' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTxType('income'); setCategory(''); }} style={{ flex: 1, fontSize: '13px', padding: '6px 12px' }}>收入</button>
        </div>

        <div className="form-group">
          <input type="number" className="input" style={{ width: '100%' }} value={amount} onChange={e => setAmount(e.target.value)} placeholder="金额" />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="select" style={{ flex: 1 }} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">选择分类</option>
              {currentCategories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={() => setShowNewCategory(true)}>+</button>
          </div>
        </div>

        {showNewCategory && (
          <div className="form-group">
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="input" style={{ flex: 1 }} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="分类名称" onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
              <button className="btn btn-primary" onClick={handleAddCategory}>添加</button>
              <button className="btn btn-secondary" onClick={() => setShowNewCategory(false)}>取消</button>
            </div>
          </div>
        )}

        <div className="form-group">
          <input type="text" className="input" style={{ width: '100%' }} value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="备注 (可选)" />
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveTransaction}>
          {editingId ? '更新' : '保存'}
        </button>
      </div>

      {dayTransactions.length > 0 && (
        <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>当日记录</div>
          {dayTransactions.map(t => (
            <div
              key={t.id}
              className="transaction-item"
              style={{ marginBottom: '8px', cursor: 'pointer' }}
              onClick={() => handleEditTx(t)}
            >
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
              <button className="btn btn-icon btn-sm" style={{ marginLeft: '8px', color: '#EF4444' }} onClick={e => { e.stopPropagation(); t.id && handleDeleteTx(t.id); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DayAccounting;
