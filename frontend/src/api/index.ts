import { BackendAdapter } from './backend';
import { TauriBackend } from './tauri-adapter';
import { MockBackend } from './mock-adapter';
import { billBackend, isBillBackendEnabled } from './bill-adapter';

function isTauri(): boolean {
  try { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; } catch { return false; }
}

/**
 * 本地后端:Tauri 桌面模式用 invoke 调 Rust,浏览器模式用内存 Mock。
 * 负责日历/笔记/设置等非记账功能(不受「记账后端」切换影响)。
 */
export const backend: BackendAdapter = isTauri() ? new TauriBackend() : new MockBackend();

/**
 * 记账后端选择:bill 云端(默认)或本地。
 * 判断依据 localStorage `rili_accounting_backend`(设置页「记账后端」可切换),
 * 未显式设为 'local' 即视为云端 bill。
 */
export function getAccountingBackend(): BackendAdapter {
  return isBillBackendEnabled() ? billBackend : backend;
}

export type { BackendAdapter } from './backend';
