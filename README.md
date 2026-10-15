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
- **【图 2】右侧边栏：单一 Git Tab，内含变更 / 提交记录 / 工作树**：
  - 侧边栏启动器里 Git 只占一项（标题固定为 `Git`），不再为每个页面各塞一个入口；
  - 面板顶部 tab 条切换页面，右侧两个图标动作进入“创建分支 / 创建工作树”表单（表单内联渲染，无遮罩、无模态焦点锁）；
  - 对比基线切换下拉框（如 `main → origin/main`、`工作区 vs HEAD`）；
  - 全仓变动行数统计徽标（`+792 -31` 增删着色）；
  - 变更文件列表树，展示单文件增删行数字数（如 `+226 -0`）；
  - 内联代码差异对比器，具备行号、增绿删红、差异块上下文与代码对比；
  - 差异标题栏右侧「在编辑器中打开」：用本机编辑器打开当前文件（自动探测 `code` / `cursor` / `code-insiders` / `windsurf` / `zed` / `subl`，可用环境变量 `DSH_GIT_EDITOR` 指定；都没有时交给系统默认应用，优先使用 DSH 自身的打开能力）。只允许打开仓库内、且不含 shell 元字符的路径；
  - 加载、空状态与错误状态统一为带骨架屏的组件，不再是一行裸文本。

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
│   │   ├── editor-launcher.ts  # 外部编辑器探测与安全启动（仓库内路径、无 shell 注入）
│   │   └── routes.ts           # /dsh-git/* HTTP 接口与 SSE 事件推送
│   └── client/
│       ├── index.tsx           # Client 端入口：挂载 Slot，并只注册一个 Git 侧边栏 Tab
│       ├── api.ts              # 前端 API 请求封装
│       ├── icons.tsx           # 原生 SVG 图标组件
│       ├── styles.ts           # UI 样式与主题变量
│       ├── loading-state.tsx   # 统一加载骨架屏组件（页面 / 提交记录 / 工作树共用）
│       ├── hooks/
│       │   └── use-git-status.ts # 仓库自动探测与状态监听 Hook
│       ├── panels/
│       │   ├── navigation.ts       # 单一 Tab 内的页面定义与当前页状态
│       │   ├── GitSidebarPanel.tsx # 唯一侧边栏面板：页面 tab 条 + 内容区
│       │   └── panel-context.ts    # 标记“在面板中渲染”，表单不再使用遮罩
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
