import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { pluginManager } from '../Calendar/plugins';
import { invoke } from '@tauri-apps/api/core';

export const Settings: React.FC = () => {
  const { 
    syncConfig, 
    setSyncConfig, 
    syncData, 
    testSyncConnection, 
    lastSyncTime, 
    loadLastSyncTime,
    exportData,
    importData,
    exportTransactionsCsv,
    importTransactionsCsv
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
      const balance = await invoke<string | null>('get_setting', { key: 'initial_balance' });
      setInitialBalance(balance || '0');
    } catch {
      setInitialBalance('0');
    }
  };

  const handleSaveInitialBalance = async () => {
    try {
      await invoke('set_setting', { key: 'initial_balance', value: initialBalance });
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
      const startDate = prompt('开始日期 (YYYY-MM-DD)', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
      const endDate = prompt('结束日期 (YYYY-MM-DD)', new Date().toISOString().split('T')[0]);
      if (!startDate || !endDate) return;
      
      const data = await exportTransactionsCsv(startDate, endDate);
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
      await importData(text, importMode === 'merge');
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
      const count = await importTransactionsCsv(text);
      setImportStatus(`成功导入 ${count} 条记录`);
      setTimeout(() => setImportStatus(''), 3000);
    } catch (err) {
      setImportStatus('导入失败: ' + String(err));
    }
    
    e.target.value = '';
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
        <div className="settings-section-header">数据导出</div>
        <div className="settings-section-body">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={handleExportJson}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              导出 JSON (完整备份)
            </button>
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              导出 CSV (记账数据)
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">数据导入</div>
        <div className="settings-section-body">
          <div className="form-group">
            <label className="form-label">导入模式</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                />
                合并 (保留现有数据)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                替换 (清空现有数据)
              </label>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              导入 JSON
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportJson}
              />
            </label>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              导入 CSV
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleImportCsv}
              />
            </label>
          </div>
          
          {importStatus && (
            <div style={{ 
              padding: '8px 12px', 
              borderRadius: '6px', 
              marginTop: '16px',
              background: importStatus.includes('失败') ? '#FEE2E2' : '#D1FAE5',
              color: importStatus.includes('失败') ? '#EF4444' : '#10B981'
            }}>
              {importStatus}
            </div>
          )}
          
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '16px' }}>
            CSV 格式要求：日期,类型,金额,分类,备注<br/>
            示例：2024-01-15,expense,25.50,餐饮,午餐
          </p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">关于</div>
        <div className="settings-section-body">
          <div className="settings-item">
            <div>
              <div className="settings-item-label">RILI 日历记账笔记</div>
              <div className="settings-item-desc">版本 0.3.4</div>
            </div>
          </div>
          <div className="settings-item">
            <div>
              <div className="settings-item-label">技术栈</div>
              <div className="settings-item-desc">Tauri + React + TypeScript + SQLite3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
