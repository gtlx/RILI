# RiLi - 跨平台日历记账笔记应用

## 1. 项目概述

- **项目名称**: RiLi (日历)
- **项目类型**: 跨平台桌面应用 (Tauri + React + TypeScript)
- **核心功能**: 带笔记功能的日历 + 记账功能(支持数据分析) + 数据同步与导入导出
- **目标用户**: 个人用户，需要管理日程、记录财务、写作笔记

## 2. UI/UX 规范

### 2.1 布局结构

- **主窗口**: 单窗口应用，顶部导航栏 + 主内容区 + 底部标签栏
- **窗口最小尺寸**: 768x1024 (移动端优先)
- **标题栏**: 使用系统原生标题栏

### 2.2 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  顶部导航栏 (标题 + 快捷操作按钮)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    主内容区                                   │
│              (日历/记账/笔记/设置)                             │
│                                                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [日历]  [记账]  [笔记]  [设置]   ← 底部标签栏              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 视觉设计

#### 颜色系统
- **主色**: #4F46E5 (靛蓝色)
- **主色浅**: #818CF8
- **主色深**: #3730A3
- **背景色**: #F9FAFB
- **卡片背景**: #FFFFFF
- **文字主色**: #111827
- **文字次色**: #6B7280
- **边框色**: #E5E7EB
- **成功色**: #10B981
- **警告色**: #F59E0B
- **错误色**: #EF4444
- **支出色**: #EF4444 (红)
- **收入色**: #10B981 (绿)

#### 字体
- **主字体**: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- **等宽字体**: "JetBrains Mono", "Fira Code", monospace (用于金额)
- **标题大小**: 24px / 20px / 16px / 14px
- **正文大小**: 14px
- **小字**: 12px

#### 间距系统
- **基础单位**: 4px
- **间距级别**: 4px / 8px / 12px / 16px / 24px / 32px / 48px

#### 视觉效果
- **圆角**: 8px (卡片), 6px (按钮), 4px (输入框)
- **阴影**: `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`
- **过渡**: 150ms ease-in-out

### 2.4 组件规范

#### 按钮
- **主要按钮**: 背景 #4F46E5, 文字白色, hover #3730A3
- **次要按钮**: 边框 #E5E7EB, 文字 #374151, hover 背景 #F3F4F6
- **危险按钮**: 背景 #EF4444, 文字白色
- **高度**: 36px (默认), 32px (小), 40px (大)
- **内边距**: 12px 16px

#### 输入框
- **高度**: 36px
- **边框**: 1px solid #E5E7EB
- **聚焦边框**: 2px solid #4F46E5
- **圆角**: 4px
- **placeholder颜色**: #9CA3AF

#### 卡片
- **背景**: #FFFFFF
- **圆角**: 8px
- **阴影**: `0 1px 3px rgba(0,0,0,0.1)`
- **内边距**: 16px

#### 日历单元格
- **高度**: 100px (周视图) / 80px (月视图)
- **今日高亮**: 背景 #EEF2FF, 边框 #4F46E5
- **有笔记标记**: 底部小点 #4F46E5
- **有记账标记**: 底部小点 #10B981

## 3. 功能规范

### 3.1 日历功能

#### 月视图
- 显示当前月份的日历网格
- 左右箭头切换月份
- 点击日期可查看/添加笔记
- 显示当天是否有笔记/记账的标记点
- 其他月份的日期（灰色区域）也显示农历节气和农历日期
- 点击其他月份的日期会自动跳转到该月份

#### 农历信息显示
- 农历日期背景：浅灰色背景，带投影阴影
- 农历月份（初一）：红色字体显示
- 节日（如春节、元宵节等）：红色背景
- 假期（如国庆节、端午节等）：绿色背景
- 节气（如清明、谷雨等）：紫色背景

#### 周视图
- 显示当前周的日历
- 左右箭头切换周
- 更详细的时间展示

#### 日期点击行为
- 弹出模态框，显示当天：
  - 笔记列表
  - 记账记录
  - 添加新笔记/记账按钮

### 3.2 笔记功能

#### 笔记列表
- 按日期组织笔记
- 支持按月份筛选
- 支持导出所有笔记为ZIP文件

#### 笔记编辑
- 点击日期弹出笔记编辑面板
- Markdown格式支持
- 工具栏：粗体、斜体、标题、列表、链接、图片
- 自动保存

#### 笔记导出
- 导出所有笔记为ZIP文件（包含.md文件）

#### 存储格式
- 文件名: `YYYY-MM-DD.md`
- 存储位置: 应用数据目录下的 `notes/` 文件夹

### 3.3 记账功能

#### 记账记录
- 字段：日期、金额、类型(收入/支出)、分类、备注
- 分类预设：餐饮、交通、购物、教育、医疗、娱乐、投资、工资、其他
- 支持自定义分类

#### 数据分析

##### 周分析
- 本周收入/支出总额
- 与上周对比百分比
- 分类占比饼图
- 每日支出趋势折线图

##### 月分析
- 本月收入/支出总额
- 与上月对比
- 分类占比
- 月度趋势
- Top 5 支出分类
- 初始余额显示
- 净资产计算（初始余额 + 收入 - 支出）

##### 年度分析
- 年度收支概况
- 月度对比
- 分类年度汇总

#### 报表导出
- 支持导出为CSV
- 支持导出为JSON

### 3.4 数据导入导出

#### 导出
- **JSON格式**: 完整数据备份
- **CSV格式**: 记账数据表格
- **MD格式**: 笔记文件打包(zip)

#### 导入
- **JSON导入**: 覆盖/合并选项
- **CSV导入**: 记账数据批量导入
- **MD导入**: 笔记批量导入

### 3.5 Web同步

#### 同步机制
- 用户提供WebDAV服务器地址(可选)
- 支持自建Nextcloud/OwnCloud
- 同步内容：数据库、笔记文件
- 手动触发同步 + 自动同步(可选)

#### 同步状态
- 显示最后同步时间
- 冲突解决：提示用户手动选择

### 3.6 设置

- 主题：跟随系统/浅色/深色
- 同步服务器配置
- 数据导出/导入
- 关于

## 4. 技术架构

### 4.1 技术栈
- **前端**: React 18 + TypeScript + Vite
- **UI**: 自定义组件 (基于上述设计规范)
- **图表**: Recharts
- **后端**: Tauri (Rust)
- **数据库**: SQLite3 (rusqlite)
- **Markdown**: react-markdown + remark-gfm

### 4.2 数据库设计

```sql
-- 记账记录表
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 分类表
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    is_default INTEGER DEFAULT 0
);

-- 笔记表 (索引)
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 设置表
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 同步记录
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_time TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT
);
```

### 4.3 目录结构

```
src/
├── components/       # React组件
│   ├── Calendar/    # 日历组件
│   ├── Accounting/ # 记账组件
│   ├── Notes/      # 笔记组件
│   ├── Analysis/   # 数据分析组件
│   └── Common/     # 通用组件
├── hooks/          # 自定义Hooks
├── stores/         # 状态管理
├── utils/          # 工具函数
└── styles/         # 样式文件

src-tauri/
├── src/
│   ├── main.rs     # 入口
│   ├── db.rs       # 数据库操作
│   ├── sync.rs     # 同步功能
│   └── export.rs   # 导入导出
└── Cargo.toml
```

## 5. 验收标准

### 功能验收
- [ ] 日历正确显示月/周视图
- [ ] 点击日期可添加/查看笔记
- [ ] 笔记支持Markdown并保存为.md文件
- [ ] 记账功能完整(添加/编辑/删除)
- [ ] 周分析图表正确显示
- [ ] 月分析图表正确显示
- [ ] JSON导出导入功能正常
- [ ] CSV导出导入功能正常
- [ ] WebDAV同步功能可用

### 视觉验收
- [ ] 颜色符合设计规范
- [ ] 布局响应正常
- [ ] 过渡动画流畅
- [ ] 图表清晰易读

### 性能验收
- [ ] 页面加载时间 < 2秒
- [ ] 日历切换流畅
- [ ] 1000+条记账记录查询 < 500ms

## 6. 数据同步优化

### 6.1 增量同步
- 使用版本号(version)追踪数据变更
- 每次同步只传输自上次同步以来的变更数据
- 大幅减少同步时间和网络负载

### 6.2 数据校验
- 使用SHA-256算法计算每条记录的校验和(checksum)
- 同步后可验证数据完整性
- 支持全量校验和计算用于备份验证

### 6.3 冲突解决
- 基于版本号的冲突检测
- 较新版本的数据优先
- 保留删除标记用于跨设备同步

### 6.4 异步同步队列
- 本地操作先写入sync_queue表
- 后台异步处理同步任务
- 不会阻塞用户操作

### 6.5 数据库优化
- 为version、is_deleted字段添加索引
- 优化查询性能
- 支持软删除(is_deleted)保留历史数据

## 7. 技术选型说明

### 7.1 Rust依赖
```
rusqlite = { version = "0.32", features = ["bundled"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
chrono = { version = "0.4", features = ["serde"] }
sha2 = "0.10"
thiserror = "2"
log = "0.4"
env_logger = "0.11"
dirs = "6"
zip = "2"
```

### 7.2 数据库选型
**SQLite 已满足需求，无需 RocksDB/LevelDB**：

| 因素 | SQLite | 结论 |
|------|--------|------|
| 单用户 | ✅ | 个人应用无需高并发 |
| 轻量嵌入 | ✅ | 桌面应用无需独立服务 |
| 跨平台 | ✅ | Tauri 天然支持 |
| 结构化数据 | ✅ | SQL适合记账数据 |
| 同步能力 | ✅ | 增量同步+版本控制已实现 |

**结论**: SQLite + 增量同步 + 数据校验方案完全满足需求

## 8. Android 构建说明

### 8.1 构建环境

- **NDK**: 25.2.9519653
- **Android SDK**: 33.0.1+
- **Gradle**: 8.14+
- **Rust**: 1.75+

### 8.2 构建命令

```bash
cd src-tauri
CI=true node ../node_modules/.bin/tauri android build
```

### 8.3 签名APK

```bash
# 签名 (需要先创建密钥库)
$ANDROID_HOME/build-tools/33.0.1/apksigner sign \
  --ks release.keystore \
  --ks-pass pass:<密码> \
  --key-pass pass:<密码> \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out rili-app.apk \
  app-universal-release-unsigned.apk
```

### 8.4 数据库路径 (Android)

在 Android 设备上，数据库文件位于：
```
/data/data/com.root.rili_app/files/rili-app/rili.db
```

应用会自动创建目录，无需手动创建。

### 8.5 日志查看

```bash
# 查看应用日志
adb logcat -s RILI:D *:W

# 查看所有日志
adb logcat | grep RILI
```

### 8.6 版本历史

| 版本 | APK大小 | 说明 |
|------|---------|------|
| v0.3.6 | ~60MB | 记账卡片改为2x2布局，笔记日期框固定宽度居中，星期头部添加圆角边框，日历日期格padding优化 |
| v0.3.5 | ~60MB | 日历方格加宽，农历背景加深（浅灰+阴影），假期显示完整名称，饼图缩小适应容器，年分析按月计算 |
| v0.3.2 | ~51MB | 移除周分析视图，添加净资产计算，月份分析显示初始余额，日历点击其他月份日期跳转 |
| v0.3.1 | ~51MB | 记账增加年/月视图分析，添加初始余额设置，修复日历记账保存 |
| v0.3.0 | ~51MB | UI大改：底部导航栏，节气单独显示，笔记列表优化，修复记账保存 |
| v0.2.2 | ~51MB | 代码性能优化：交易/笔记索引Map，Promise并行加载，图表数据useMemo |
| v0.2.1 | ~51MB | 修复24节气显示，侧边栏默认折叠，优化日历背景 |
| v0.2.0-v7 | ~51MB | 可正常使用的稳定版本 |

### 8.7 已知问题

- **代码压缩问题**: ProGuard/R8 压缩会导致 native 库崩溃，构建时请确保 `isMinifyEnabled = false`
- **日志不显示**: 部分设备可能需要 root 权限才能查看 `logcat -s RILI`

### 8.8 性能优化

#### 前端优化
- 日历组件使用 Map/Set 索引替代数组遍历查找
- 图表数据转换使用 useMemo 缓存
- 分类数据并行加载 (Promise.all)

#### 后端优化
- N+1 查询改用批量操作
