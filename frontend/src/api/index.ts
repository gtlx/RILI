import { BackendAdapter } from './backend';
import { TauriBackend } from './tauri-adapter';
import { MockBackend } from './mock-adapter';

function isTauri(): boolean {
  try { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; } catch { return false; }
}

export const backend: BackendAdapter = isTauri() ? new TauriBackend() : new MockBackend();
export type { BackendAdapter } from './backend';
