# 修复与验收

## 自动验证

最新结果：85 项测试全部通过（0 失败、0 跳过），TypeScript 检查、Host/Client 构建及产物语法检查通过。新增侧栏导航、Hero 模式选择器保留、面板无遮罩展示和图标 SVG 回归。新增「tab 注册被拒绝时报告真实原因」的回归：注册失败不再退化成「侧边栏插件未就绪」。新增接入回归覆盖 Host 工作区模型类方法的 `this` 绑定：直接把 `getSnapshot` / `subscribe` 传给 React 会丢失接收者，导致 Slot 崩溃并被框架退役；现已改成稳定闭包调用原对象方法。此前 39 项测试未覆盖该集成边界，不能作为页面已成功挂载的证明。新增外部编辑器能力的回归：编辑器探测顺序与 `-g` 参数形态、`DSH_GIT_EDITOR` 覆盖、宿主打开能力优先于 shell、拒绝仓库外路径与 shell 元字符、文件已删除、路由参数校验，以及前端按钮点击后如实展示宿主返回结果（失败不显示成功）。新增「只加载一次」的回归：提交记录必须等仓库状态就绪后再请求日志（否则同一 revision 会被请求两次，列表显示后又被清空重载），仓库状态尚未就绪时不发差异请求，且「等仓库状态」与「等差异」共用同一个加载文案，不再出现连续两个加载画面。

需要 Git 和 Node.js 24.2+（测试使用 Node 自带 TypeScript 转译与模块 hooks；发布产物不需要转译器）。

```powershell
pnpm install --ignore-scripts
pnpm test
pnpm typecheck
pnpm build
```

也可直接运行，避免包管理器在执行脚本前自动处理依赖：

```powershell
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/build.mjs
node --check lib/index.js
node --check lib/client.js
```

所有写入性 Git 测试都在独立临时目录完成，并在测试后核对路径再清理；不切换当前项目分支，不删除用户 Worktree。

### 覆盖范围（对应本次审计 26 项）

| 审计项 | 修复 | 自动检查 |
| --- | --- | --- |
| 1–3 切分支恢复文件、Git 参数注入 | 不再 checkout 回退；校验引用并解析为对象 ID | 真实 Git 临时仓库保护测试 |
| 4 强制删除 Worktree | 移除 force；有更改或锁定时拒绝 | 真实 Git 临时仓库保护测试 |
| 5–6 错仓库、缺 cwd | 订阅标准会话/工作区源，明确 cwd 优先，未知会话拒绝猜测 | 多工作区解析测试；接口拒绝空路径 |
| 7–8 请求竞态 | 路径绑定、取消、请求代次、结果 key 遮蔽 | Hook/请求控制单元测试 |
| 9–11 Diff/SSE 漏更新 | branch/head/upstream/revision 依赖；脏文件内容指纹；完整状态去重 | 指纹与 SSE 测试 |
| 12 上游猜测错误 | Git 返回实际 upstream；未配置时显示错误 | 非 origin 上游测试 |
| 13 隐藏 Diff 错误 | 检查退出码，API 和界面显示失败，不保留假成功 | Git/API/路由失败测试 |
| 14 Worktree 没有会话 | 注册工作区后 await 打开该工作区；失败保留路径可重试 | 工作区创建/导航调用测试 |
| 15 focus 清空表单 | 后台刷新不清空已有状态、不进入初载卸载分支 | focus Hook 单元测试 |
| 16 错误变 object Object | 保留结构化错误消息与 code；不自动重试写操作 | API 测试 |
| 17 删除失败无反馈 | 明确错误、忙碌状态和确认步骤 | API 失败测试；交互需人工验收 |
| 18–20 未跟踪文件遗漏、中文路径、行数 | NUL 逐文件枚举、Git 路径解码、准确 LF 行计数 | 真实 Git 与解析器测试 |
| 21–22 状态误分类、假空白行 | 仅解析元数据头；不将输出结尾当代码 | 解析器测试 |
| 23–24 Worktree 路径/锁定/操作状态 | 平台规范化、锁定原因、实际 gitdir 检测 | 真实 Git 与解析器测试 |
| 25 日志分隔符 | NUL 字段/记录协议 | 真实 Git 含竖线标题和作者测试 |
| 26 深浅主题 | 全部使用当前主题 alias tokens，清理旧硬编码 | 主题 token 静态检查；视觉需人工验收 |

## 运行版本与重启

插件已通过 Profile 的插件管理器重新确认本地 link 安装。管理器明确返回 `application: restart-required`。

**请完整重启 DSH Desktop 后再测试，只有刷新页面不足以替换已加载的 Host JavaScript。** 不要把重启前仍然存在的旧行为当成新版本结果。

## 截图反馈的四项 UI 调整

- 空白会话：在原 `conversation.hero.agentPreset` seat 内有意包装原模式选择器，将分支胶囊作为同排兄弟组件。保留原 locale、inject 和标准 hooks；不移动其他插件 DOM，不再占独立 dock 行。若宿主未来为该 seat 增加子槽，则拒绝覆盖并保留宿主原控件。
- 检测与分析中的提示统一为“加载中…”。
- 图标统一 24px 坐标、1.7 圆角线条与 currentColor；创建分支、历史、工作树分别使用专用图标。
- 变更、提交记录、创建分支、创建工作树和管理工作树全部使用当前会话的原生右侧栏 tab。明确 `target: right`，不回退到居中弹窗或底部工作台；侧栏不可用时明确报错。
- **启动器只有一个 Git 入口**：五类页面共用同一个 `type: 'dsh-plugin-git'` 的 tab，页面切换由面板自身的 tab 条完成（变更 / 提交记录 / 工作树 为页面，创建分支 / 创建工作树 为图标动作）。`registerTab` 只调用一次，tab 标题固定为“Git”，不再随页面改名。
- **tab id 必须带插件命名空间**：`betterSidebar.registerTab` 对重复 id 直接抛 `tab type "..." already registered`，而侧栏自带的内置 tab 已占用 `editor` / `git` / `subagent` / `sidechat` / `terminal-bottom` / `diff`。曾把本插件的 tab 注册成 `git`（与内置“变更”页撞号），结果是五个旧入口消失、新的单一入口也没注册上——启动器里一个 Git 入口都不剩。`tests/sidebar-single-entry.test.mjs` 现在固定断言该 id 不属于内置 id 且以 `dsh-plugin-git` 开头。
- 窄侧栏采用上下文件列表/差异布局，无变更时居中显示“暂无文件更改”。表单在面板中不使用遮罩或模态焦点锁。

## 第二轮截图反馈（加载态、头部拥挤、外部编辑器）

- **加载态统一为组件**：新增 `src/client/loading-state.tsx` 的 `GitLoadingState`（图标 + 标题 + 说明 + 骨架条），变更面板、提交记录、工作树、非 Git 提示共用。此前的“管理 Git Worktrees / 提交记录下面一行光秃秃的加载中…”来自各处手写的裸文本。
- **提交记录顶部不再挤成一坨**：`.dsh-git-changes-header` 是纵排列（`flex-direction: column`），提交记录的标题行和刷新按钮因此变成上下两块、按钮被拉满整行。现在标题行是横排（标题 + 计数 + 方形刷新按钮，右对齐），列表本身才是纵排列。
- **会话头部控件留出间距**：`.dsh-git-header-controls` 之前没有任何样式规则，分支胶囊和「变更」按钮紧贴在一起；现在有 `gap: 8px`、`margin-left: 6px`，分支名过长时省略号截断而不是把整排撑开。
- **差异标题栏新增「在编辑器中打开」**：调用 `POST /dsh-git/open-in-editor`，Host 端按 `code` / `cursor` / `code-insiders` / `windsurf` / `zed` / `subl` 顺序探测 CLI（`zed` / `subl` 无 `-g` 时用 `路径:行号`），`DSH_GIT_EDITOR` 可覆盖；都找不到时先用 DSH 的 `sessionController.openWorkspacePath`，再退回系统默认应用（Windows `cmd /c start`、macOS `open`、Linux `xdg-open`）。安全约束：只允许仓库内路径，拒绝 `" ' \` % ^ & | < > ( )` 等元字符，进程以 `detached + stdio: ignore` 启动并 `unref()`，绝不把路径拼进 shell 字符串；文件不存在或超出仓库时明确报错，不假装成功。

重启后请重点核对：启动器里 Git 只占一行；项目/模式/分支是否同排；模式选择仍正常；点击变更和提交记录是否挤开聊天区并进入右侧栏且落在对应页面；创建/管理工作树是否也在右侧展示；不同会话打开的面板是否正确隔离。**本次新增 Host 路由 `/dsh-git/open-in-editor`，因此必须完整重启 DSH Desktop，刷新页面不足以加载新的 Host 代码。** 重启后额外核对：提交记录与工作树的加载态是否为骨架屏而非一行裸文本；会话头部四个控件之间是否有间距；差异标题栏右侧「在编辑器中打开」能否用本机编辑器打开当前文件（未安装上述编辑器时是否交给系统默认应用），以及打开失败时是否显示真实原因。当前没有浏览器交互能力，以上视觉与真实窗口行为尚待人工验收。

## 第三轮截图反馈（等宽字体）

- **不再使用裸 `monospace` 关键字**：`WorktreeDialogs.tsx` 的工作树路径、`ChangesTab.tsx` 文件列表的 `+n -n` 都是行内 `fontFamily: 'monospace'`。该关键字解析到系统默认等宽字体，中文 Windows 上通常是 NSimSun／宋体一类字面，拉丁字形又细又歪——这就是截图里“字体很怪”的来源。现在统一用 `src/client/styles.ts` 导出的 `CODE_FONT = var(--ds-font-family-code, Consolas, "Liberation Mono", Menlo, monospace)`：`--ds-font-family-code` 是 UI 主题在 `:root` 上声明的代码字体（宿主自己的包和 `dsh-better-sidebar` 都用它），带回退链，中文路径也不会掉字。
- 行内样式收敛成类：`.dsh-git-worktree-path`、`.dsh-git-file-name`、`.dsh-git-file-stats`（含 `font-variant-numeric: tabular-nums`，数字对齐）；面板内的裸 `<code>` / `<pre>` / `<kbd>` 也统一改用同一字体。
- `tests/theme.test.mjs` 新增回归：任何 `font-family: monospace` 或 `fontFamily: 'monospace'` 都会失败，并断言 `CODE_FONT` 仍基于 `--ds-font-family-code`；主题 token 白名单相应加入 `--ds-font-family-code`。
- 注意：本次为纯前端改动，刷新页面（Ctrl+R）即可生效；若之前那轮 Host 路由尚未重启加载过，仍需完整重启。

## 第四轮截图反馈（面板整体字体 ≠ 应用字体）

真正的原因不是等宽关键字，而是**整块面板的中文都没有字体可落**：

- 上游字体栈 `--dsw-font-family` 是 `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", …`。本机（Windows 11 中文环境）实测：`Microsoft YaHei` **未安装**（只有 `Microsoft YaHei UI`），`PingFang SC` / `Hiragino Sans GB` 是 macOS 专有，`Segoe UI` 不含中文字形——于是每个汉字都穿过整条链，落到浏览器默认的中文衬线字体上，看起来就是「宋体感的怪字体」；而应用自己的界面文字走的是 `:root` 上的 `"Noto Sans SC"`（本机已安装），所以只有我们的面板突兀。
- 修复：`UI_FONT` 改成**先列本机真实存在的 CJK 无衬线字体**（`"Noto Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC"`），再把应用 token 作为后续回退；同时在注入样式表时用 `appUiFont()` **镜像 `:root` 实际解析出的字体**（本机为 `"Noto Sans SC"`），追加一条同权重但更靠后的规则，保证面板与应用逐字一致，且换机器/换主题时自动跟随。
- 客户端包是**热更新**的：每次 `node scripts/build.mjs` 之后，运行中的窗口在数秒内就会执行新 bundle（自检文件里的 `build` 字段随构建变化可证）。只有 Host（`lib/index.js`）改动才需要完整重启 DSH Desktop；界面改动刷新即可。
- 自检：`src/client/diagnostics.ts` 会把运行中的 build 标记、样式表长度、面板真实元素的最终字体、`fontAvailability()` 的 canvas 实测结果 POST 到 `/dsh-git/client-report`，Host 写入临时目录 `dsh-plugin-git-client-report-<source>.json`。排查「改了没生效」时先读它，不要再靠肉眼看截图猜。
- `tests/styles-injection.test.mjs` 新增两条回归：字体链必须以已安装的 CJK 字体开头、应用 token 必须排在它们之后；注入的样式表必须镜像 `:root` 的字体。

## 需要人工完成的界面验收

当前工具没有已登录页面的浏览器交互/截图控制能力；自动测试不等于真实页面、焦点或主题验收。

建议在一个可丢弃的测试仓库中进行：

1. 打开两个不同仓库的会话，来回切换，核对分支名、变更路径和 Worktree 管理都属于当前会话，不跳到第一个工作区。
2. 编辑同一个已修改文件，脏文件数量不变；等约 3 秒，Diff 应更新。切换干净分支或提交后也应更新。
3. 快速切换“工作区/上游”比较，不能出现新标签下的旧内容；没有上游应明确报错，不显示假空结果。
4. 打开创建分支/Worktree 表单输入名字，切到终端再回来，输入应保留。检查 Escape、Tab、关闭后焦点恢复。
5. 创建 Worktree 后应实际打开该路径的工作区会话。若打开失败，应显示已创建路径，并可重试打开，不重复创建目录。
6. 在临时 Worktree 中留下未提交文件再删除：应该拒绝、显示错误且文件保留。锁定工作树的删除按钮应禁用。
7. 浅色/深色各检查分支浮层、创建对话框、变更面板、错误提示与增删行；检查窗口窄屏时浮层位置和滚动。

这些人工步骤不需要在真实项目上尝试危险参数或强制删除。
