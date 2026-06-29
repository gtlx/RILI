import React, { useState, useEffect } from 'react';
import { useAppStore, Theme } from '../../stores/appStore';
import { pluginManager } from '../Calendar/plugins';
import { backend } from '../../api';

export const Settings: React.FC = () => {
  const { 
    syncConfig, 
    setSyncConfig, 
    syncData, 
    testSyncConnection, 
    lastSyncTime, 
    loadLastSyncTime,
    exportData,
    importSystemJson,
    exportAccountingCsv,
    importAccountingCsv,
    exportNotesZip,
    importNotesZip,
    theme,
    setTheme
  } = useAppStore();

  const [syncUrl, setSyncUrl] = useState(syncConfig.server_url);
  const [syncUsername, setSyncUsername] = useState(syncConfig.username);
  const [syncPassword, setSyncPassword] = useState(syncConfig.password);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'testing' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState('');
  
  const [plugins, setPlugins] = useState(() => pluginManager.getAllPlugins());
  
  const [initialBalance, setInitialBalance] = useState('0');
  const [balanceStatus, setBalanceStatus] = useState('');

  const togglePlugin = (name: string) => {
    const plugin = pluginManager.getPlugin(name);
    if (plugin) {
      pluginManager.setEnabled(name, !plugin.enabled);
      setPlugins(pluginManager.getAllPlugins());
    }
  };

  useEffect(() => {
    loadLastSyncTime();
    loadInitialBalance();
  }, [loadLastSyncTime]);

  const loadInitialBalance = async () => {
    try {
      const balance = await backend.getSetting('initial_balance');
      setInitialBalance(balance || '0');
    } catch {
      setInitialBalance('0');
    }
  };

  const handleSaveInitialBalance = async () => {
    try {
      await backend.setSetting('initial_balance', initialBalance);
      setBalanceStatus('初始余额已保存');
      setTimeout(() => setBalanceStatus(''), 3000);
    } catch (e) {
      setBalanceStatus('保存失败: ' + String(e));
    }
  };

  const handleSaveSyncConfig = () => {
    setSyncConfig({
      server_url: syncUrl,
      username: syncUsername,
      password: syncPassword,
    });
    setSyncMessage('配置已保存');
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleTestConnection = async () => {
    setSyncConfig({
      server_url: syncUrl,
      username: syncUsername,
      password: syncPassword,
    });
    setSyncStatus('testing');
    setSyncMessage('');
    
    try {
      const result = await testSyncConnection();
      if (result) {
        setSyncStatus('success');
        setSyncMessage('连接成功！');
      } else {
        setSyncStatus('error');
        setSyncMessage('连接失败，请检查配置');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('连接失败: ' + String(e));
    }
  };

  const handleSync = async () => {
    setSyncConfig({
      server_url: syncUrl,
      username: syncUsername,
      password: syncPassword,
    });
    setSyncStatus('syncing');
    setSyncMessage('同步中...');
    
    try {
      await syncData();
      setSyncStatus('success');
      setSyncMessage('同步完成！');
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('同步失败: ' + String(e));
    }
  };

  const handleExportJson = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rili-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('导出失败: ' + String(e));
    }
  };

  const handleExportCsv = async () => {
    try {
      const startEl = document.getElementById('csvStart') as HTMLInputElement;
      const endEl = document.getElementById('csvEnd') as HTMLInputElement;
      const startDate = startEl?.value;
      const endDate = endEl?.value;
      if (!startDate || !endDate) return;
      
      const data = await exportAccountingCsv(startDate, endDate);
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rili-transactions-${startDate}-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('导出失败: ' + String(e));
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      await importSystemJson(text, importMode === 'merge');
      setImportStatus(`导入成功！${importMode === 'merge' ? '(合并模式)' : '(替换模式)'}`);
      setTimeout(() => setImportStatus(''), 3000);
    } catch (err) {
      setImportStatus('导入失败: ' + String(err));
    }
    
    e.target.value = '';
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const count = await importAccountingCsv(text);
      setImportStatus(`成功导入 ${count} 条记录`);
      setTimeout(() => setImportStatus(''), 3000);
    } catch (err) {
      setImportStatus('导入失败: ' + String(err));
    }
    
    e.target.value = '';
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div>
      <div className="settings-section">
        <div className="settings-section-header">日历插件</div>
        <div className="settings-section-body">
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
            启用/禁用日历插件，可显示农历和节假日信息
          </p>
          {plugins.map(plugin => (
            <div key={plugin.name} className="settings-item">
              <div>
                <div className="settings-item-label">
                  {plugin.name === 'lunar' ? '农历显示' : '节假日显示'}
                </div>
                <div className="settings-item-desc">
                  {plugin.name === 'lunar' 
                    ? '显示公历对应的农历日期、节气、生肖' 
                    : '显示中国传统节日和法定节假日'}
                </div>
              </div>
              <div 
                className={`toggle ${plugin.enabled ? 'active' : ''}`}
                onClick={() => togglePlugin(plugin.name)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">外观设置</div>
        <div className="settings-section-body">
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
            选择应用的主题外观
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div 
              className={`theme-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>浅色</span>
            </div>
            <div 
              className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              <span>深色</span>
            </div>
            <div 
              className={`theme-option ${theme === 'system' ? 'active' : ''}`}
              onClick={() => handleThemeChange('system')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>跟随系统</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">账户设置</div>
        <div className="settings-section-body">
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
            设置您的初始存款或负债，用于计算真实的净资产
          </p>
          <div className="form-group">
            <label className="form-label">初始余额</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                className="input"
                style={{ width: '200px' }}
                value={initialBalance}
                onChange={e => setInitialBalance(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
              <span style={{ color: '#6B7280' }}>元</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              正数表示存款，负数表示负债
            </p>
          </div>
          {balanceStatus && (
            <div style={{ 
              padding: '8px 12px', 
              borderRadius: '6px', 
              marginBottom: '16px',
              background: balanceStatus.includes('失败') ? '#FEE2E2' : '#D1FAE5',
              color: balanceStatus.includes('失败') ? '#EF4444' : '#10B981'
            }}>
              {balanceStatus}
            </div>
          )}
          <button className="btn btn-primary" onClick={handleSaveInitialBalance}>
            保存设置
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">WebDAV 同步设置</div>
        <div className="settings-section-body">
          <div className="form-group">
            <label className="form-label">服务器地址</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={syncUrl}
              onChange={e => setSyncUrl(e.target.value)}
              placeholder="https://your-nextcloud.com/remote.php/dav/files/username"
            />
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              支持 Nextcloud、OwnCloud 等 WebDAV 服务器
            </p>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">用户名</label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={syncUsername}
                onChange={e => setSyncUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">密码</label>
              <input
                type="password"
                className="input"
                style={{ width: '100%' }}
                value={syncPassword}
                onChange={e => setSyncPassword(e.target.value)}
              />
            </div>
          </div>
          
          {syncMessage && (
            <div style={{ 
              padding: '8px 12px', 
              borderRadius: '6px', 
              marginBottom: '16px',
              background: syncStatus === 'error' ? '#FEE2E2' : syncStatus === 'success' ? '#D1FAE5' : '#E0E7FF',
              color: syncStatus === 'error' ? '#EF4444' : syncStatus === 'success' ? '#10B981' : '#4F46E5'
            }}>
              {syncMessage}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleSaveSyncConfig}>保存配置</button>
            <button className="btn btn-secondary" onClick={handleTestConnection} disabled={syncStatus === 'testing'}>
              {syncStatus === 'testing' ? '测试中...' : '测试连接'}
            </button>
            <button className="btn btn-primary" onClick={handleSync} disabled={syncStatus === 'syncing'}>
              {syncStatus === 'syncing' ? '同步中...' : '立即同步'}
            </button>
          </div>
          
          {lastSyncTime && (
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '12px' }}>
              最后同步时间: {lastSyncTime}
            </p>
          )}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">数据管理</div>
        <div className="settings-section-body">
          {/* ── 系统数据卡片 ── */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px', padding: '16px', marginBottom: '12px',
            background: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>📦</span>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>系统数据</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              JSON 格式 · 完整备份，可用于数据迁移
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>导入模式</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                  合并
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="radio" name="importMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                  替换
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '13px' }}>
                📥 导入 JSON
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
              </label>
              <button className="btn btn-secondary" onClick={handleExportJson} style={{ fontSize: '13px' }}>
                📤 导出 JSON
              </button>
            </div>
          </div>

          {/* ── 记账数据卡片 ── */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px', padding: '16px', marginBottom: '12px',
            background: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>💰</span>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>记账数据</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              CSV 格式 · 可导入 Excel 或其他软件分析
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>日期范围</label>
              <input type="date" id="csvStart" defaultValue={new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}
                style={{ fontSize: '13px', padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>~</span>
              <input type="date" id="csvEnd" defaultValue={new Date().toISOString().split('T')[0]}
                style={{ fontSize: '13px', padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '13px' }}>
                📥 导入 CSV
                <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCsv} />
              </label>
              <button className="btn btn-secondary" onClick={handleExportCsv} style={{ fontSize: '13px' }}>
                📤 导出 CSV
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              格式: 日期,类型(income/expense),金额,分类,备注<br />
              示例: 2026-06-29,expense,25.50,餐饮,午餐
            </p>
          </div>

          {/* ── 笔记数据卡片 ── */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px', padding: '16px',
            background: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>📝</span>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>笔记数据</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              ZIP 格式 · 打包为 .md 文件
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '13px' }}>
                📥 导入 ZIP
                <input type="file" accept=".zip" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const buf = await file.arrayBuffer();
                    const bytes = new Uint8Array(buf);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    const base64 = btoa(binary);
                      const count = await importNotesZip(base64);
                    setImportStatus(`成功导入 ${count} 篇笔记`);
                    setTimeout(() => setImportStatus(''), 3000);
                  } catch (err) {
                    setImportStatus('导入失败: ' + String(err));
                  }
                  e.target.value = '';
                }} />
              </label>
              <button className="btn btn-secondary" onClick={async () => {
                try {
                  const base64 = await exportNotesZip();
                  await backend.saveFileDialog(base64, `rili-notes-${new Date().toISOString().split('T')[0]}.zip`, 'application/zip');
                } catch (e) {
                  alert('导出失败: ' + String(e));
                }
              }} style={{ fontSize: '13px' }}>
                📤 导出 ZIP
              </button>
            </div>
          </div>

          {/* ── 统一状态提示 ── */}
          {importStatus && (
            <div style={{
              padding: '8px 12px', borderRadius: '6px', marginTop: '12px',
              background: importStatus.includes('失败') ? '#FEE2E2' : '#D1FAE5',
              color: importStatus.includes('失败') ? '#EF4444' : '#10B981',
              fontSize: '13px'
            }}>
              {importStatus}
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">关于</div>
        <div className="settings-section-body">
          <div className="settings-item">
            <div>
              <div className="settings-item-label">RiLi 日历记账笔记</div>
              <div className="settings-item-desc">版本 0.4.0</div>
            </div>
          </div>
          <div className="settings-item">
            <div>
              <div className="settings-item-label">技术栈</div>
              <div className="settings-item-desc">rili-core (Rust) + rili-tauri + rili-cli</div>
              <div className="settings-item-desc">React 19 + TypeScript + Zustand + Recharts</div>
              <div className="settings-item-desc">SQLite3 + rusqlite + WebDAV 同步</div>
              <div className="settings-item-desc" style={{marginTop:8, fontSize:11, color:'var(--text-muted)'}}>
                三层分离架构 | 支持浏览器/CLI/桌面三种模式
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
