/**
 * 待办事项类型(RILI 本地日历待办,localStorage 持久化,不走 bill/后端)。
 * 用途:提醒未来某天要做的事、生日、纪念日等。
 */

/** 待办重复规则 */
export type TodoRepeat = 'none' | 'yearly';

export interface Todo {
  /** 唯一 id(时间戳+随机,localStorage 主键) */
  id: string;
  /** 事项日期,格式 YYYY-MM-DD;repeat=yearly 时仅取月-日用于每年重复 */
  date: string;
  /** 事项内容,如「妈妈生日」「交房租」 */
  title: string;
  /** 是否已完成 */
  done: boolean;
  /** 重复规则:none 单次 / yearly 每年重复(生日/纪念日) */
  repeat: TodoRepeat;
  /** 创建时间 ISO */
  createdAt: string;
}

/** 待办本地存储的 key(与账本科目等设置隔离) */
export const TODO_STORAGE_KEY = 'rili_todos';
