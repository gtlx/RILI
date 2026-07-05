# RILI — 跨平台日历记账笔记应用

> 日历 + 记账分析 + 笔记，三合一桌面应用  
> 支持农历/节气/节日显示、WebDAV 同步、数据校验

---

## 目录

- [项目概览](#项目概览)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
  - [Web 浏览器模式](#1-浏览器模式快速体验)
  - [CLI 命令行模式](#2-cli-命令行模式)
  - [桌面 App 模式](#3-桌面-app-模式完整功能)
- [CLI 命令参考](#cli-命令参考)
- [项目结构](#项目结构)
- [数据库设计](#数据库设计)
- [前后端分离适配层](#前后端分离适配层)
- [从原版迁移](#从原版迁移)

---

## 项目概览

RILI 是一款功能丰富的跨平台桌面应用，结合了日历、记账分析和笔记功能。

### 核心功能

| 功能 | 说明 |
|------|------|
| 📅 **日历** | 月/周视图，农历/节气/节日/生肖显示，点击日期查看详情 |
| 💰 **记账** | 记录子视图（日期网格+添加表单）+ 周/月/年分析图表 |
| 🔁 **周期交易** | 设置每日/周/月/年规则，一键生成交易记录 |
| 📝 **笔记** | Markdown 编辑，按日存储为 `.md` 文件 |
| 🔄 **WebDAV 同步** | 支持 Nextcloud/OwnCloud 全量/增量同步 |
| 📊 **数据分析** | Recharts 图表：分类占比饼图、每日趋势折线图、月度对比 |
| 📦 **导入导出** | JSON 完整备份、CSV 记账数据、ZIP 笔记打包 |
| 🔐 **数据校验** | SHA-256 checksum 验证数据完整性 |
| 🎨 **主题切换** | 浅色/深色/跟随系统 |

### 技术栈对比

| 维度 | 原版 (Tauri v1) | 重构版 |
|------|----------------|--------|
| 后端架构 | 单体 `db.rs` + `lib.rs` 混在一起 | **三层分离**：core + tauri + cli |
| 前端 | React 19 + Zustand | React 19 + Zustand + **BackendAdapter** |
| 后端语言 | Rust (单文件) | Rust (**分层模块化**, 34个文件) |
| 数据库 | rusqlite | rusqlite (schema 不变) |
| 前后端耦合 | 直接 `invoke()` | **BackendAdapter 抽象层** |
| CLI | 无 | **有** (rili-cli) |
| 浏览器运行 | 不可能 | **支持** (MockBackend) |
| 纯 Web 版 | 不可能 | **支持** (加 HttpBackend) |

---

## 技术栈

### 后端 (Rust)

| 依赖 | 用途 |
|------|------|
| `rusqlite` (bundled) | SQLite 数据库，WAL 模式 |
| `serde` / `serde_json` | 序列化/反序列化 |
| `chrono` | 日期时间处理 |
| `sha2` | SHA-256 数据校验 |
| `reqwest` (blocking) | WebDAV HTTP 客户端 |
| `zip` | 笔记打包导出 |
| `base64` | ZIP 文件编码传输 |
| `thiserror` | 统一错误处理 |

### 前端 (TypeScript)

| 依赖 | 用途 |
|------|------|
| React 19 | UI 框架 |
| Zustand 5 | 状态管理 |
| Recharts 2 | 图表可视化 |
| date-fns | 日期工具 |
| lunar-calendar | 农历/节气/节日 |
| react-markdown | Markdown 渲染 |

### 数据库 (SQLite)

8 张表：`transactions`, `categories`, `notes`, `settings`, `sync_log`, `sync_queue`, `sync_metadata`, `recurring_rules`

---

## 架构设计

### 三层分离架构

```
┌──────────────────────────────────────────────────────────────┐
│                       前端层 (可更换)                          │
│                                                              │
│   ┌──────────────────┐  ┌─────────────────┐  ┌──────────┐   │
│   │  React Web UI    │  │  CLI (终端)      │  │ 未来:    │   │
│   │  (Tauri WebView  │  │                  │  │ 其他前端 │   │
│   │   或纯浏览器)     │  │                  │  │          │   │
│   └────────┬─────────┘  └────────┬────────┘  └─────┬────┘   │
│            │                     │                   │        │
│      ┌─────┴─────┐         直接调用             ┌───┴────┐  │
│      │ IPC 桥接   │         App::init()          │ HTTP   │  │
│      │ (Commands) │                              │ Server │  │
│      └─────┬─────┘                              └───┬────┘  │
├────────────┼────────────────────────────────────────┼───────┤
│            ▼                                        ▼       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   rili-core (Rust 库)                   │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │  models/     │  │  database/   │  │  services/  │  │ │
│  │  │  Transaction │  │  CRUD        │  │  WebDAV     │  │ │
│  │  │  Category    │  │  分析查询    │  │  导出/导入  │  │ │
│  │  │  Note        │  │  版本控制    │  │  数据校验   │  │ │
│  │  │  Analysis    │  │  同步队列    │  │             │  │ │
│  │  │  Recurring   │  │  recurring   │  │             │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 四种运行模式

| 模式 | 后端适配器 | 数据持久 | 启动命令 |
|------|-----------|----------|----------|
| 🖥️ **桌面 App** | `TauriBackend` (IPC) | ✅ SQLite | `cargo tauri dev` |
| 🌐 **纯 Web** | `HttpBackend` (REST) | ✅ SQLite | `pnpm dev` + `cargo run` |
| 🧪 **开发/演示** | `MockBackend` (内存) | ❌ 刷新丢失 | `pnpm dev` |
| 💻 **终端 CLI** | 直接调用 `rili_core::App` | ✅ SQLite | `cargo run -p rili-cli -- list-tx` |

---

## 快速开始

### 1. 浏览器模式（快速体验）

不需要 Rust，不需要编译：

```bash
cd frontend
pnpm install
pnpm run dev
```

浏览器打开 **http://localhost:5173**

> 使用 MockBackend，数据在内存中，刷新重置。用于体验界面。

### 2. CLI 命令行模式

```bash
# 添加一笔交易
cargo run -p rili-cli -- add-tx 2026-06-29 100 expense 餐饮 "午餐"

# 列出交易
cargo run -p rili-cli -- list-tx 2026-06-01 2026-06-30

# 查看本周分析
cargo run -p rili-cli -- week-analysis 2026 26

# 查看本月分析
cargo run -p rili-cli -- month-analysis 2026 6

# 查看状态
cargo run -p rili-cli -- status

# 导出全部数据
cargo run -p rili-cli -- export /tmp/rili-backup.json

# 导入数据
cargo run -p rili-cli -- import /tmp/rili-backup.json true
```

### 3. 桌面 App 模式

```bash
cargo tauri dev
```

---

## CLI 命令参考

```bash
rili add-tx <date> <amount> <type> <category> [note]
rili list-tx <start> <end>
rili list-notes
rili show-note <date>
rili week-analysis <year> <week>
rili month-analysis <year> <month>
rili set <key> <value>
rili get <key>
rili export <path>
rili import <path> <merge>
rili status
```

---

## 项目结构

```
rili-rust/
│
├── rili-core/              # ★ Rust 核心库（纯业务逻辑，零框架依赖）
│   ├── Cargo.toml
│   ├── migrations/
│   │   ├── 001_init.sql    # 7张表 + 默认数据 + 索引
│   │   └── 002_recurring.sql  # recurring_rules 表
│   └── src/
│       ├── lib.rs           # App 结构体：统一入口
│       ├── models/          # 数据结构
│       │   ├── transaction.rs
│       │   ├── category.rs
│   │   ├── note.rs
│   │   ├── settings.rs
│   │   ├── analysis.rs  # WeeklyAnalysis, MonthlyAnalysis
│   │   ├── sync.rs      # SyncMetadata, SyncConfig, SyncQueueItem
│   │   └── recurring.rs # RecurringRule
│       ├── database/        # SQLite CRUD
│       │   ├── mod.rs       # Database 结构体 + 迁移
│       │   ├── transaction_repo.rs
│       │   ├── category_repo.rs
│       │   ├── note_repo.rs
│       │   ├── analysis_repo.rs  # 周/月分析查询
│   │   ├── settings_repo.rs
│   │   ├── sync_repo.rs      # 同步队列 + 元数据
│   │   └── recurring_repo.rs # 周期规则 CRUD + 生成
│       ├── services/        # 业务服务
│       │   ├── sync_webdav.rs    # WebDAV 全量/增量同步
│       │   └── export.rs         # JSON/CSV/ZIP/校验
│       └── utils/           # 工具
│           ├── errors.rs    # 统一错误类型
│           └── checksum.rs  # SHA-256 校验和
│
├── rili-tauri/              # ★ Tauri 桌面应用壳
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs          # 入口
│       ├── lib.rs           # AppState + 32 个命令注册
│       └── commands/        # 薄 IPC 命令层
│           ├── transactions.rs
│           ├── categories.rs
│           ├── notes.rs
│           ├── analysis.rs
│           ├── settings.rs
│           ├── sync.rs
│           ├── io.rs        # 导入导出/校验
│           └── recurring.rs # 周期交易命令
│
├── rili-cli/                # ★ CLI 命令行工具
│   ├── Cargo.toml
│   └── src/main.rs          # 子命令
│
├── frontend/                # ★ React 前端（可独立部署）
│   ├── package.json
│   ├── pnpm-workspace.yaml
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.css
│       ├── styles.css
│       ├── api/             # ★ 前后端分离适配层
│       │   ├── backend.ts        # BackendAdapter 抽象接口
│       │   ├── index.ts          # 自动选择适配器
│       │   ├── tauri-adapter.ts  # Tauri IPC 实现
│       │   └── mock-adapter.ts   # 浏览器内存实现
│       ├── stores/
│       │   └── appStore.ts       # Zustand → 通过 backend 调用
│       └── components/
│           ├── Calendar/    # 日历（农历/节气/节日/生肖）
│           ├── Accounting/  # 记账分析 + 记录子视图
│           ├── Notes/       # Markdown 笔记
│           └── Settings/    # 设置（主题/同步/导入导出/周期交易）
│
├── Cargo.toml               # Rust 工作区
└── package.json             # 工作区脚本
```

---

## 数据库设计

### 8 张表

```sql
transactions      -- 记账记录 (版本号/软删除/checksum)
categories        -- 分类预设 (收入/支出/图标/颜色)
notes             -- 笔记索引 (日期→文件路径)
settings          -- 键值设置 (主题/同步配置)
sync_log          -- 同步日志
sync_queue        -- 异步同步队列
sync_metadata     -- 同步元数据 (版本号/checksum)
recurring_rules   -- 周期交易规则 (start_date/amount/type/interval)
```

### 数据流

```
用户操作
    │
    ▼
transactions / notes 写入
    │
    ├─▶ 自动 version++，计算 checksum
    ├─▶ sync_queue 记录变更
    └─▶ sync_status 标记 pending
              │
              ▼
        WebDAV 同步时
        ├─ 全量: PUT rili-data.json
        └─ 增量: PUT rili-incremental/{version}.json
```

---

## 前后端分离适配层

所有前端通过 `BackendAdapter` 接口与后端通信：

```typescript
export interface BackendAdapter {
  addTransaction(t: Transaction): Promise<number>;
  getTransactions(start: string, end: string): Promise<Transaction[]>;
  getWeeklyAnalysis(year: number, week: number): Promise<WeeklyAnalysis>;
  saveNote(date: string, content: string): Promise<void>;
  syncData(config: SyncConfig): Promise<string>;
  exportSystemJson(): Promise<string>;

  // ── 周期交易 ──
  addRecurringRule(rule: RecurringRule): Promise<number>;
  updateRecurringRule(rule: RecurringRule): Promise<void>;
  deleteRecurringRule(id: number): Promise<void>;
  getRecurringRules(): Promise<RecurringRule[]>;
  generateRecurringTransactions(endDate: string): Promise<number>;
  // ... 共 40+ 个方法
}

export interface RecurringRule {
  id?: number;
  start_date: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category: string;
  note?: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval_value: number;
  end_date?: string;
  is_active: boolean;
}
```

切换后端只需改一行：

```typescript
export const backend: BackendAdapter = isTauri()
  ? new TauriBackend()     // 桌面 App
  : new MockBackend();      // 浏览器演示
```

---

## 从原版迁移

原版项目在同一目录下有完整实现。新版重构后：

| 原版文件 | 重构后 | 变化 |
|----------|--------|------|
| `src-tauri/src/db.rs` (800行) | `rili-core/src/database/` (7个文件) | 拆分为 7 个 repo 文件 |
| `src-tauri/src/lib.rs` (200行) | `rili-tauri/src/commands/` (7个文件) | 拆分命令 |
| `src-tauri/src/sync.rs` (200行) | `rili-core/src/services/sync_webdav.rs` | 移入 core |
| `src/stores/appStore.ts` | 保留但改为用 `backend` 调用 | 替换 `invoke` → `backend.xxx()` |
| 无 CLI | `rili-cli/` | 新增 |
| 前/后端耦合 | `frontend/src/api/` | 新增适配层 |

数据库 schema 新增 `recurring_rules` 表（通过迁移 `002_recurring.sql`），原有 7 张表不变，旧版 `rili.db` 可复用。
