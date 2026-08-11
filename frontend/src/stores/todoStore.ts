/**
 * 待办事项 store(RILI 本地日历待办)。
 * 独立于 appStore:待办是日历本地功能,不走记账后端与笔记体系,
 * localStorage 持久化即可满足提醒/生日场景,保持模块边界清晰。
 */
import { create } from 'zustand';
import { Todo, TODO_STORAGE_KEY } from '../types/todo';

/** 从 localStorage 读取全部待办(容错:损坏/缺失返回空数组) */
function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 持久化到 localStorage */
function persistTodos(todos: Todo[]) {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  } catch {
    /* 存储满/隐私模式等失败场景静默,不阻断操作 */
  }
}

/** 生成唯一 id:时间戳 + 随机后缀 */
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface TodoState {
  todos: Todo[];
  /** 初始化时从 localStorage 载入(幂等,重复调用无副作用) */
  loadTodos: () => void;
  /** 新增待办;repeat=yearly 时自动忽略年份(存 MM-DD 语义,date 保留原值仅用于展示) */
  addTodo: (date: string, title: string, repeat?: 'none' | 'yearly') => void;
  /** 切换完成状态 */
  toggleTodo: (id: string) => void;
  /** 删除待办 */
  removeTodo: (id: string) => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],

  loadTodos: () => {
    // 已载入过则跳过,避免覆盖内存中的未保存改动
    if (get().todos.length > 0) return;
    set({ todos: loadTodos() });
  },

  addTodo: (date, title, repeat = 'none') => {
    const todo: Todo = {
      id: genId(),
      date,
      title: title.trim(),
      done: false,
      repeat,
      createdAt: new Date().toISOString(),
    };
    if (!todo.title) return;
    const todos = [...get().todos, todo];
    set({ todos });
    persistTodos(todos);
  },

  toggleTodo: (id) => {
    const todos = get().todos.map(t => (t.id === id ? { ...t, done: !t.done } : t));
    set({ todos });
    persistTodos(todos);
  },

  removeTodo: (id) => {
    const todos = get().todos.filter(t => t.id !== id);
    set({ todos });
    persistTodos(todos);
  },
}));
