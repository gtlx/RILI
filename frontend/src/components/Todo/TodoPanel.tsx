/**
 * 待办事项面板(日历日期详情弹层内使用)。
 * 功能:查看某日期的待办(含每年重复的生日/纪念日)、新增、勾选完成、删除。
 * 数据:useTodoStore(localStorage 持久化),与记账/笔记互不干扰。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTodoStore } from '../../stores/todoStore';

interface TodoPanelProps {
  /** 当前查看的日期 */
  date: Date;
}

export const TodoPanel: React.FC<TodoPanelProps> = ({ date }) => {
  const { todos, loadTodos, addTodo, toggleTodo, removeTodo } = useTodoStore();
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'yearly'>('none');

  // 首次挂载载入本地待办
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const dateStr = format(date, 'yyyy-MM-dd');
  const monthDay = dateStr.slice(5); // MM-DD,用于匹配每年重复

  /** 当日待办:单次(日期精确匹配)+ 每年重复(月-日匹配) */
  const dayTodos = useMemo(() => {
    return todos
      .filter(t => (t.repeat === 'yearly' ? t.date.slice(5) === monthDay : t.date === dateStr))
      .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));
  }, [todos, dateStr, monthDay]);

  const pendingCount = dayTodos.filter(t => !t.done).length;

  const handleAdd = () => {
    if (!title.trim()) return;
    addTodo(dateStr, title, repeat);
    setTitle('');
    setRepeat('none');
  };

  return (
    <div className="todo-panel">
      <div className="todo-panel-header">
        <span className="todo-panel-title">待办事项</span>
        {pendingCount > 0 && <span className="todo-panel-count">{pendingCount} 项未完成</span>}
      </div>

      <div className="todo-add-row">
        <input
          className="input"
          placeholder="要做的事,如:交房租 / 妈妈生日"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <select
          className="select"
          value={repeat}
          onChange={e => setRepeat(e.target.value as 'none' | 'yearly')}
          title="重复规则"
        >
          <option value="none">单次</option>
          <option value="yearly">每年重复</option>
        </select>
        <button className="btn btn-primary" onClick={handleAdd}>添加</button>
      </div>

      {dayTodos.length === 0 ? (
        <div className="todo-empty">这一天还没有待办事项</div>
      ) : (
        <ul className="todo-list">
          {dayTodos.map(t => (
            <li key={t.id} className={`todo-item ${t.done ? 'todo-done' : ''}`}>
              <label className="todo-check">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTodo(t.id)}
                />
                <span className="todo-checkmark" />
              </label>
              <span className="todo-title">{t.title}</span>
              {t.repeat === 'yearly' && <span className="todo-badge">每年</span>}
              <button
                className="btn btn-icon btn-sm todo-delete"
                onClick={() => removeTodo(t.id)}
                title="删除"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TodoPanel;
