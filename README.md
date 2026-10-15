# dsh-plugin-git

DeepSeek Harness (DSH) 官方 Web GUI 与桌面端 Git 增强插件。

## ✨ 特性

- **自动识别 Git 仓库**：
  - 打开项目时自动探测是否为 Git 仓库；
  - 非 Git 仓库时自动隐藏输入框顶部胶囊，不侵占界面空间；变更面板显示初始化引导；
  - Git 仓库激活完整功能体系。
- **【图 1】会话输入框顶部：分支切换胶囊与下拉面板**：
  - 显示当前分支名（如 `main`）与分支图标；
  - 展开浮层支持搜索过滤本地与远程分支；
  - 动态展示当前未提交的变更文件数量（如 `未提交的更改: 4 个文件`）；
  - 点击分支安全检出（带冲突守卫）；
  - 底部快捷操作：`创建并检出新分支...`、`Git 图谱`、`在 worktree 中开始新会话...`、`管理 worktree...`。
- **【图 2】侧边栏 / 独立工作台：变更 (Changes) 审查与 Diff 视图**：
  - 对比基线切换下拉框（如 `main → origin/main`、`工作区 vs HEAD`）；
  - 全仓变动行数统计徽标（`+792 -31` 增删着色）；
  - 变更文件列表树，展示单文件增删行数字数（如 `+226 -0`）；
  - 内联代码差异对比器，具备行号、增绿删红、差异块上下文与代码对比。

---

## 🛠️ 安装与调试

### 1. 本地 Link 安装至 DSH Desktop Profile

在终端中执行：

```bash
dsh plugin --profile desktop add link:D:\dsh-plugin\git-plugin
```

或者在 DSH Desktop profile 的 `cordis.patch.yml` 中添加：

```yaml
- insert:
    - id: git-plugin
      name: dsh-plugin-git
```

### 2. 本地开发与代码构建

```bash
cd D:\dsh-plugin\git-plugin
pnpm run build
```

构建产物位于 `lib/` 目录下（`lib/index.js` 为 Host 端服务，`lib/client.js` 为浏览器端 React Bundle）。

---

## 📁 目录结构

```
D:\dsh-plugin\git-plugin
├── package.json
├── cordis.patch.yml
├── tsconfig.json
├── scripts/
│   └── build.mjs
├── src/
│   ├── index.ts                # Host 端入口：注册 /dsh-git 路由与 Git 服务
│   ├── core/
│   │   ├── types.ts            # 数据类型定义
│   │   └── git-command.ts      # Git 命令生成与解析工具
│   ├── host/
│   │   ├── git-runner.ts       # 平台原生 git.exe 子进程调度
│   │   ├── git-service.ts      # 仓库检测、状态解析、分支与 Diff 核心服务
│   │   └── routes.ts           # /dsh-git/* HTTP 接口与 SSE 事件推送
│   └── client/
│       ├── index.tsx           # Client 端入口：挂载 Slot 与侧边栏 Tab
│       ├── api.ts              # 前端 API 请求封装
│       ├── icons.tsx           # 原生 SVG 图标组件
│       ├── styles.ts           # UI 样式与主题变量
│       ├── hooks/
│       │   └── use-git-status.ts # 仓库自动探测与状态监听 Hook
│       ├── chips/
│       │   ├── BranchChip.tsx    # 图 1：分支胶囊组件
│       │   └── BranchPopover.tsx # 图 1：分支切换下拉弹层
│       ├── dialogs/
│       │   ├── CreateBranchDialog.tsx # 新建分支弹窗
│       │   ├── GitGraphDialog.tsx     # Git 图谱弹窗
│       │   └── WorktreeDialogs.tsx    # Worktree 管理弹窗
│       └── diff/
│           └── ChangesTab.tsx    # 图 2：变更审查面板与代码差异对比器
```
