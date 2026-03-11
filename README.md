# RILI - 跨平台日历记账笔记应用

一个功能丰富的跨平台桌面应用，结合了日历、记账分析和笔记功能。

## 功能特性

### 📅 日历
- 月/周视图切换
- 显示每日记账和笔记标记
- 点击日期快速查看详情

### 💰 记账
- 收入/支出记录
- 周分析（趋势图、分类占比）
- 月分析（Top分类、月度对比）
- 支持自定义分类

### 📝 笔记
- 点击日期添加笔记
- Markdown格式支持
- 笔记保存为 .md 文件

### 🔄 数据同步与导入导出
- WebDAV同步（支持Nextcloud/OwnCloud）
- JSON完整数据备份
- CSV格式导出/导入记账数据

## 技术栈

- **前端**: React 19 + TypeScript + Vite
- **UI**: 自定义组件 + Recharts图表
- **后端**: Tauri (Rust)
- **数据库**: SQLite3 (rusqlite)

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建
npm run tauri build
```

## 许可证

MIT
