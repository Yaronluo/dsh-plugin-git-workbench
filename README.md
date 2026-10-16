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
- **整页 Git 工作台：在「对话 / 轨迹 / 上下文 / 编队」同一排增加 `Git` 标签**：
  - 工作台占满主内容区，保留左侧工作区导航；工作台本身不依赖侧边栏插件，AI 草稿动作使用右侧对话；
  - 顶部 `Git` 页签与分支胶囊快捷操作进入当前会话的同一整页；移除会话头部重复的「Git 工作台」按钮；
  - 内部 tab 切换变更 / 提交记录 / 储藏 / 工作树，右侧具名按钮进入创建分支 / 创建工作树表单（内联渲染，无遮罩）；
  - 整页有独立纵向滚动区域，宽屏左侧文件列表、右侧大幅 Diff，两栏各自滚动；下方是提交编辑区与操作区，窄屏自动上下布局；
  - 文件标题栏保留主操作，历史、复制、AI 解释等收进「更多操作」；储藏与工作树使用统一标题、操作栏和内容卡片，不再平铺弹窗关闭/完成按钮；
  - 通过页签直接切换对话/Git，不再显示「返回」按钮；提交详情通过「提交」页签回到列表。空白会话单独保留「对话 / Git」页签，避免无路退出；文件选择、比较范围、草稿和滚动位置按会话与仓库隔离保留；
  - 对比基线切换下拉框（如 `main → origin/main`、`工作区 vs HEAD`）；
  - 全仓变动行数统计徽标（`+792 -31` 增删着色）；
  - 变更文件列表树，展示单文件增删行数字数（如 `+226 -0`）；
  - 内联代码差异对比器，具备行号、增绿删红、差异块上下文与代码对比；
  - 差异标题栏右侧「在编辑器中打开」：用本机编辑器打开当前文件（自动探测 `code` / `cursor` / `code-insiders` / `windsurf` / `zed` / `subl`，可用环境变量 `DSH_GIT_EDITOR` 指定；都没有时交给系统默认应用，优先使用 DSH 自身的打开能力）。只允许打开仓库内、且不含 shell 元字符的路径；
  - 加载、空状态与错误状态统一为带骨架屏的组件，不再是一行裸文本。

### 变更页（全部 / 未暂存 / 已暂存 三个范围）

- **提交框**：提交信息、`修正上次提交`（amend）、`签名`（Signed-off-by）、`全部改动`（`-a`）；暂存区为空或有未解决冲突时按钮禁用并说明原因；`撤销提交`（`reset --soft HEAD~1`，改动退回暂存区）；`Ctrl/Cmd+Enter` 直接提交。
- **分组文件列表**：冲突 / 已暂存 / 未暂存 / 未跟踪四组，逐文件动作 `暂存`、`取消暂存`、`撤销更改`、`删除未跟踪`、`加入 .gitignore`（含 `.git/info/exclude` 选项）、`在文件管理器中显示`、`复制路径`。
- **hunk 级暂存**：每个差异块上有 `暂存此块` / `取消暂存此块`，底层是 `git apply --cached [--reverse]`，「工作区 vs 索引」的补丁可以逐块进/出暂存区。
- **差异工具条**：词级高亮（token LCS 对齐增删行）、忽略空白、并排视图、上下文行数（`-U`）、上/下一处差异、复制补丁/路径、内联图片预览（`GET /dsh-git/blob`，仅仓库内且有大小上限）。
- **冲突处理**：未解决冲突单独分组，可 `用当前版本` / `用传入版本` 一键解决并暂存，也可直接编辑工作区文件。
- **进行中操作横幅**：识别 merge / rebase / cherry-pick / revert / am，提供 `继续` / `中止` / `跳过`（不可用的动作不显示；继续前若有未解决冲突会被拒绝）。

### 提交记录页

- **真 lane 图谱**：按父提交列布局（`src/client/graph.ts` 的纯函数 `computeGraph`），不再是平铺列表。
- **提交详情**：点击任意提交查看提交信息、作者/提交者、父提交、引用与逐文件 diff；可复制 hash、在编辑器中打开、签出该提交新建分支、打标签。
- **引用日志（reflog）**：列出最近的 HEAD 移动，可 `软重置到此处` 来撤销上一次操作。

### 储藏页 / 工作树页

- **储藏**：列表 + 补丁预览；`储藏当前改动`（可含未跟踪、可保留暂存区）、`应用`、`弹出`、`删除`（二次确认）。
- **工作树**：每棵树的状态徽标与脏文件数、`lock`（含原因）/ `unlock`、`prune`（先预演再确认）、删除需要显式确认（脏或锁定的树不会强制删除），并可 `在当前工作树中打开会话`。

### 分支胶囊（图 1）

- 显示 `ahead` / `behind` / 储藏数量；底部新增 `拉取` / `推送` / `获取`（fetch 支持 `--prune`；push 支持 `-u` 推送到新分支与 `--force-with-lease`；凭据缺失时给出明确提示而不是静默失败）。

### 单文件检查

- 差异标题栏 `历史`：单文件提交历史 + `blame` 逐行责任（按提交分组，展示作者与时间）。

### 与 agent 协作

- **8 个 Git 工具**注册给会话内 agent 直接调用：`git_status`、`git_diff`、`git_log`、`git_stage`、`git_unstage`、`git_commit`、`git_stash`、`git_branch`（都要求显式 `cwd`；只读工具出错即抛错，写工具返回 `{ok, error}`）。
- **审批门禁**：`tools/pre-execute` 钩子对 `amend` 提交与 `stash drop` 强制询问，其余放行；钩子内部异常一律 `next()`（不吞掉、不误拒）。
- **AI 动作**：`AI 写信息`、`AI 审查改动`、`注入 Git 上下文`、`解释这个文件` 四个按钮直接打开当前会话的**右侧对话并填入提示词草稿**，不会自动发送、不会自动复制，也不会调用 LLM。已有草稿保留并追加，用户编辑确认后再发送。`AI 写信息`单独读取真实暂存区补丁；审查使用当前比较范围。侧边栏插件不存在、未提供侧边对话或功能被停用时，自动在同一项目目录新建普通对话并填入草稿。侧边对话已开始打开后若失败，则明确报错，不重复创建普通对话；所有路径均需用户手动发送。

### 其它修复与探测结论

- `status.revision` 不再每 3 秒重读所有脏文件：改为按 `lstat` 签名（mode/size/mtimeNs/ctimeNs/ino）缓存内容摘要，签名不变就跳过全文哈希，同时保持「同尺寸同 mtime 的编辑仍会改变 revision」。
- 命令面板探测结论：这一版 DSH 没有通用命令面板 API，`commands` / `shortcuts` 只是 host 侧注册面，且命令上下文拿不到仓库 `cwd`，因此 Git 能力以 agent 工具 + 面板内按键（`Esc` 关闭浮层、`Ctrl/Cmd+Enter` 提交）交付。

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
│   ├── index.ts                # Host 端入口：注册 /dsh-git 路由、Git 服务与 agent 工具
│   ├── core/
│   │   ├── types.ts            # 数据类型定义
│   │   ├── changes.ts          # 状态条目 → 变更列表 / 冲突内容解析（纯函数）
│   │   └── git-command.ts      # Git 命令生成与解析工具（status/diff/log/stash/blame…）
│   ├── host/
│   │   ├── git-runner.ts       # 平台原生 git.exe 子进程调度
│   │   ├── git-service.ts      # 仓库检测、状态解析、分支与 Diff 核心服务
│   │   ├── editor-launcher.ts  # 外部编辑器探测与安全启动（含在文件管理器中显示）
│   │   ├── routes.ts           # /dsh-git/* HTTP 接口、blob 图片与 SSE 事件推送
│   │   ├── tool-defs.ts        # defineTool 等价实现（JSON Schema 转换，无第三方依赖）
│   │   └── agent-tools.ts      # 8 个 Git 工具 + tools/pre-execute 审批门禁
│   └── client/
│       ├── index.tsx           # Client 端入口：挂载会话 Git 标签与分支胶囊
│       ├── conversation-registration.ts # 原生 conversation.view / 导航桥 / 空白会话接入
│       ├── api.ts              # 前端 API 请求封装
│       ├── agent-bridge.ts     # AI 提示词构建与「发给会话 / 复制到剪贴板」投递
│       ├── graph.ts            # 提交 lane 图谱布局（纯函数）
│       ├── icons.tsx           # 原生 SVG 图标组件
│       ├── styles.ts           # UI 样式与主题变量
│       ├── loading-state.tsx   # 统一加载骨架屏组件（页面 / 提交记录 / 工作树共用）
│       ├── hooks/
│       │   └── use-git-status.ts # 仓库自动探测与状态监听 Hook
│       ├── panels/
│       │   ├── navigation.ts       # 单一 Tab 内的页面定义与当前页状态
│       │   ├── GitWorkbenchPage.tsx # 整页外壳、返回对话与原生导航桥
│       │   ├── GitSidebarPanel.tsx # 复用内容组件：内部页面 tab 条 + 内容区（不再挂侧栏）
│       │   └── panel-context.ts    # 标记“在面板中渲染”，表单不再使用遮罩
│       ├── chips/
│       │   ├── BranchChip.tsx    # 图 1：分支胶囊组件
│       │   └── BranchPopover.tsx # 图 1：分支切换下拉弹层
│       ├── dialogs/
│       │   ├── CreateBranchDialog.tsx  # 新建分支弹窗
│       │   ├── GitGraphDialog.tsx      # 提交记录：lane 图谱 + reflog 标签页
│       │   ├── CommitDetailDialog.tsx  # 单条提交详情与逐文件 diff
│       │   ├── ReflogPanel.tsx         # 引用日志与软重置撤销
│       │   ├── StashPanel.tsx          # 储藏管理页
│       │   ├── WorktreeDialogs.tsx     # Worktree 创建 / 管理（lock、prune）
│       │   ├── FileInspectDialog.tsx   # 单文件历史与 blame
│       │   ├── blame-groups.ts         # blame 行按提交分组（纯函数）
│       │   └── DialogShell.tsx         # 内联 / 模态容器
│       └── diff/
│           ├── ChangesTab.tsx    # 图 2：变更审查面板、提交框与代码差异对比器
│           ├── change-sections.ts # 变更分组、索引摘要与提交前置校验（纯函数）
│           └── patch.ts          # hunk 切分、补丁拼装、词级 diff 与并排配对（纯函数）
```
