# 修复与验收

## 最终范围复查（2026-10-16）

复查范围：HTTP/Cordis 启动接入、Git 写操作参数与路径、工作台会话隔离与详情竞态、工作树打开失败、AI 侧聊/新会话草稿降级。只修复可复现的问题，没有执行用户工作区的破坏性 Git 操作，没有提交或清理已有改动。

- **文件精确性**：选中的 `[a].txt` 曾被 Git 当作 pathspec glob，同时影响 `a.txt`。对接受 pathspec 的 stage/unstage/discard/conflict checkout/add 及文件 diff/history 使用 literal pathspec；blame 的文件参数不是 pathspec，仍直接传入已校验的字面文件名。
- **推送参数**：`branch: --force` 曾能变为 Git 选项并回退真实 bare remote 的上游分支。现在校验 push/pull 分支及已配置远程，保留显式 force-with-lease 流程。
- **Blame 兼容性**：某些 Git 版本将 `blame --no-color` 判为含糊选项。porcelain 本身无颜色，不再传该选项；新增正常文件和方括号文件正向回归。
- **详情竞态**：切换提交、仓库或文件时，立即按请求 identity 隐藏旧详情/补丁，避免在新文件名下闪现旧文件内容。
- **工作树与错误恢复**：创建并打开工作树时不再提前切走表单，打开失败可以看到错误并重试；AI 草稿请求抛错也有明确失败状态。
- **草稿交互**：textarea 会把 CRLF/CR 规范为 LF，现先规范提示词再判定是否被接受；修复 Windows 补丁误报失败。用户追加文字后的 effect 重放不重复粘贴；同一进行中请求合并，AI 按钮忽略指针双击的第二次点击，避免重复开会话/追加提示词。

关键复现采用临时真实 Git 仓库与 bare remote；浏览器回归使用真实 React 组件与受控侧聊夹具，验证 CRLF、用户编辑、effect 重放、双击以及零自动发送。没有假称已验收当前登录 GUI，也没有关闭 Desktop 访问认证。

本轮包含 Host 端修复，构建后需要重载 Git 插件或重启 DSH 才能加载新 GitService，再刷新客户端；只刷新页面不会替换运行中的 Host 对象。

最终复验：165 项测试，164 通过、0 失败、1 项 Windows FIFO 平台跳过。真实 Cordis/HTTP/SSE 与 Chromium 夹具均实际执行；TypeScript、Host/Client 构建、产物语法及 diff 空白检查通过。仍未将隔离浏览器夹具当作当前登录 GUI 的人工验收。

## 可选侧边栏：新建普通对话降级（2026-10-16）

- 未安装侧边栏、缺少侧边对话组件、接入已卸载或侧边对话停用时，使用宿主 `sessions.create({ cwd })` 新建普通对话，再通过原生 `conversation.input.for(sessionContext).setDraft` 填入提示词，最后 `uiWorkspace.openSession` 导航。
- 不使用工作区的空白会话复用逻辑，避免覆盖用户原有草稿；保留原主会话内容，不模拟输入，不调用 `session.prompt`，不自动发送、不复制。新会话的临时插件引用在主视图接管后释放。
- 原生接口缺失会在新建前报错；新建后发生填入/导航失败会明确返回已创建的会话 id，不自动重试新建。侧边对话已启动后的输入/关闭失败不会再降级创建第二个对话，避免重复。
- 新增原生草稿接口与生命周期顺序测试、侧边栏不存在/停用/卸载的降级测试，以及新建目标的反馈区分；原 Chromium 侧边对话草稿回归继续保留。完整回归、TypeScript、构建、产物语法与 diff 空白检查通过。新建普通对话目前为宿主公开接口协议回归，真实登录 GUI 仍需刷新后验证。

## 入口去重与侧边对话草稿（2026-10-16）

本节是最新行为，后文“返回按钮”“自动发送/复制提示词”均为历史描述。

- 普通 Git 工作台移除「返回对话」及提交详情「返回」按钮，使用原有页签导航；点历史记录的「提交」页签会清除选中提交、恢复列表。空白会话没有原生会话页签，因此只在该模式提供「对话 / Git」小页签，不使用返回按钮。
- 会话头部、Hero 中重复的「Git 工作台」按钮移除；保留顶部 Git 页签、分支胶囊及其动作。
- 四个 AI 动作改为右侧对话草稿：不调用主会话 `session.prompt`，不发送，不调用剪贴板。已有草稿追加而非覆盖。编写提交信息时独立取暂存区补丁；审查使用当前范围补丁。
- 通过侧边栏公开 `registerTab/getTab/openTab` 接口复用原侧边对话组件与关闭清理，Git 草稿页隐藏于启动器、每个父会话单实例，显式 `target: right` 与会话/cwd。没有改动已安装的侧边栏插件。
- 当前侧边栏未公开草稿 setter，因此兼容层仅在插件自己的该页根元素内等待 textarea、通过原生 setter + input 事件让 React 接受草稿；不查找全局输入框、不模拟 Enter/发送。浏览器回归验证受控 React 状态确实改变，重新渲染不丢失，StrictMode 与异步输入框挂载不重复插入。提示词只存内存队列，不进入 tab.meta/localStorage；关闭、卸载、停用和超时明确报错。

本轮 Chromium 回归使用真实 Git 工作台/侧边草稿接入代码与延迟挂载的受控 React 侧聊夹具，服务为模拟侧边栏，覆盖四个 AI 按钮、既有草稿保留、暂存区提示词、正确父会话与右侧目标、零自动发送。当前登录 GUI 的真实侧边对话仍需刷新后人工确认；不将夹具测试冒充该窗口验收。

最终验证：149 项测试，148 通过、0 失败、1 项 Windows FIFO 跳过；浏览器、类型检查、Host/Client 构建及语法/空白检查通过。

## 截图反馈：滚动、提交详情与三页重设计（2026-10-16）

本节为最新实现，下方各轮结果保留作历史记录。

- **整页无法滚动**：上一轮将父级链全部设为 `overflow: hidden`，没有给整页安排纵向滚动所有者。现在 `.dsh-git-view-content` 使用 `overflow: auto`，内容不再被强制收缩到一屏；文件列表和 Diff 保持各自有限高度与独立滚动，提交区可以通过整页滚动到达。窄屏上下排版也可滚动到底部。
- **点击提交后空白**：Graph 向函数组件传入提交 hash 字符串作为 React 保留属性 `ref`，客户端 reconcile 会失败。现在只使用必需的普通 `commitRef` 参数。详情区另有局部 ErrorBoundary，返回按钮位于边界外；模块加载失败、详情渲染异常均显示真实错误和重试，不再让整个原生 Git slot 崩溃。
- **页面重设计**：变更页将分支统计和对比选择压缩为命令栏；文件列表显示文件名/目录层次；文件标题栏只保留主操作，其余收进「更多操作」；下方提交区区分编辑和操作。储藏/工作树改为一致的页面标题、说明、操作栏、计数、卡片/空态，不再沿用工作台下的弹窗关闭/完成布局；强制移除仍需进入确认区，默认关闭。
- **字体**：优先镜像应用 `:root` 明确配置的 UI 字体（例如 Noto Sans SC），不选浏览器默认 Times New Roman；没有明确 UI 字体时继续使用宿主 token。

新增 [真实浏览器回归](tests/browser-workbench.test.mjs)：本机使用已安装的 Chrome 和 puppeteer-core，加载真实 React 组件与本机宿主 ConversationRoot CSS，仅 Git I/O 使用模拟数据。覆盖 80 个文件、250 行 Diff 的真实鼠标滚轮、整页到达提交区、提交点击→正文→返回、详情渲染异常→错误边界→重试→返回、储藏空态、30 棵工作树整页滚动、560×640 窄窗提交区可达。这是隔离浏览器场景，不是假称已控制或验收当前登录 GUI；未关闭 Desktop 认证，未启动替代 GUI 服务。

本轮最终结果：149 项测试，148 通过、0 失败、1 项 Windows FIFO 跳过。Chromium 交互、真实宿主 SlotCore/Cordis 接入测试均实际执行通过；类型检查、Host/Client 构建、产物语法与 diff 空白检查通过。已检查模拟场景的三页浏览器截图；当前登录 GUI 仍需刷新后确认。

浏览器回归默认自动发现 Windows 本机 Chrome/DSH Profile；其它环境可设置 `DSH_BROWSER_PATH`、`DSH_PUPPETEER_MODULE`、`DSH_DESKTOP_APP_ROOT`。没有该环境时测试明确跳过，不静默假报浏览器已验证。`DSH_WORKBENCH_SCREENSHOT_PATH` 可选，用于保存模拟场景截图。

## 整页 Git 工作台与会话标签（2026-10-15～16）

本节是当前 UI，下面关于「只使用右侧栏」的文字是旧轮次历史，不再代表当前接入方式。

- 注册原生 `conversation.view`，id 为 `dsh-plugin-git`、标签 `Git`、order 40，因此与对话 / 轨迹 / 上下文 / 编队同排。不覆盖原标签，不再调用 `betterSidebar.registerTab`。
- 头部「Git 工作台」与分支胶囊动作通过原生会话标签的同一个 Session store 导航；明确匹配会话与 cwd，不操作 localStorage、不移动宿主 DOM、不依赖 DOM 点击。
- 普通会话由原生 view 占满主内容区；空白会话的宿主 view 默认返回 null，因此仅在 blank + Git 选中时接入原生 composer chain，并保留宿主原草稿 fallback。退出 Git 或会话变为非空时清理该接入。
- 宽屏文件列表居左、Diff 居右，提交框位于底部；窄屏上下布局。隐藏聊天输入框的规则限定在实际包含 Git 工作台的会话内，不影响其它页面。
- `tests/conversation-workbench.test.mjs` 在本机实际执行宿主 SlotCore，覆盖标签注册、共享 Session store 的 scope 约束、Hero 自有子槽、保留原生侧栏开关及模式选择器、blank chain 会话隔离与 disposer 清理。另有导航、SSR 页面结构、主题与布局回归。其它机器可设置 `DSH_DESKTOP_APP_ROOT` 指向安装目录运行真实宿主测试，未安装时显式跳过。

- 切回聊天再返回 Git，按 `sessionId + cwd` 恢复变更页选中文件、对比目标/范围、单文件模式、提交草稿及两处滚动位置。仅缓存允许字段，内存最多 32 项 LRU；不保留 Diff 数据、错误、忙碌状态或 amend 等选项。

最终复验：139 项测试，138 通过、0 失败、1 项 Windows FIFO 跳过；真实宿主 SlotCore 与 Cordis/HTTP/SSE 测试均实际通过，TypeScript、构建及两端产物语法检查通过。

本次主要为客户端变更；构建后需在现有 DSH 窗口刷新验证。未启动替代 GUI 服务，也未关闭桌面访问认证。自动测试不等同于已完成当前登录窗口的视觉验收；需要确认截图位置出现 Git、主区宽度、两个会话切换、空白会话返回、草稿及文件选择/滚动位置保留。

## 截图反馈：HTTP 405 / Git 实时连接失败（2026-10-15）

**原因不是用户没重启。** 22:40 重启后的 Host 日志明确显示 `cannot get property "tools" without inject`：插件父作用域仅声明 `webServer` / `workspaceRegistry`，却直接访问 `ctx.tools`，启动在 HTTP 路由注册之前抛错。请求未命中 Git 路由，进入静态页面兜底；状态 POST 返回 405，SSE 也无法建立。

修复：先独立注册 HTTP 路由，agent 工具放入 `ctx.inject(['tools'], ...)` 子作用域，随 tools 服务独立注册和清理；缺少 tools 时仍可使用 Git 面板。没有修改 DSH 主程序、关闭访问认证或启动替代 GUI 服务。

原入口测试用普通对象直接提供 tools，未模拟 Cordis 的依赖访问限制，这是上一轮漏检原因。现在模拟上下文会拒绝未声明的 tools 访问，并新增 `tests/host-cordis.test.mjs`：加载本机安装的真实 Cordis/WebServer，使用实际 HTTP 验证 POST status 返回 200、SSE 收到 status、8 个工具随服务出现注册/消失清理、整个过程没有命中 405 兜底。该真实集成测试本机已通过；其它机器可用 `DSH_DESKTOP_APP_ROOT` 指定安装目录，否则明确跳过。

本轮验证：131 项测试，130 通过、0 失败、1 项 Windows FIFO 跳过；新增真实 Cordis/HTTP/SSE 集成测试实际执行通过（未跳过），类型检查、构建与产物语法检查通过。

现有 Desktop 禁止普通浏览器访问，外部探测会返回 403，不能据此假称已验收当前窗口。修复产物已构建；运行中 GUI 的恢复仍需加载新的 Host 代码后确认，不能把隔离 HTTP 测试等同于当前窗口已恢复。

## 本轮缺陷修复（2026-10-15）

- 外部打开不再吞掉进程启动错误：等待 `spawn` 或 `error` 后返回真实结果；编辑器、系统默认应用和文件管理器三条路径均覆盖。真实缺失可执行文件的回归确保不会假报成功。
- Windows 编辑器查找优先选择可执行的 `.exe` / `.cmd` / `.bat`，不误选无扩展名的 Unix shim；批处理启动时为程序及参数补齐引号，保留带空格的安装路径和文件路径。
- 路径检查不再把仓库内的 `..notes.txt` 误认为父目录，同时检查仓库路径中的 shell 元字符及已删除的仓库。
- 冲突解决必须显式指定 `side`，操作继续/中止/跳过必须显式指定 `step`；缺参、空值与非法枚举在进入 Git 服务前返回 400。
- 仓库图片响应添加 CSP sandbox 和 `nosniff`，防止直接打开恶意 SVG 时在 DSH 同源页面执行脚本。自动测试覆盖安全响应头，浏览器实际渲染尚需人工验收。
- 冲突详情请求绑定代次，快速切换冲突文件或关闭预览后，旧响应不再覆盖新选择或重新展开。
- 单文件聚焦绑定仓库路径，切仓库时不再将旧文件过滤条件发给新仓库，并关闭旧文件检查面板。
- hunk 补丁选择校验整数与边界、去重并排序，避免非法选择生成部分补丁或重复/倒序 hunk。

- Git 子进程提前关闭 stdin 时，处理预期的 EOF/EPIPE，避免大补丁或提交消息写入导致宿主进程崩溃。
- 图片读取解析真实路径后验证仓库边界，拒绝经符号链接父目录读取仓库外文件。
- 未跟踪文件差异跳过 FIFO 等非普通文件，并限制单文件读取大小；仅含换行的文件统一统计为新增一行。

本轮最终验证：129 项测试，128 通过、0 失败、1 跳过（Windows 无 FIFO）；TypeScript、Host/Client 构建与产物语法检查均通过。尚未完成真实 GUI 和外部编辑器窗口的人工验收。

本轮包含 Host 端修改，**需要完整退出并重启 DSH Desktop**，刷新页面不足以加载新 Host 代码。保留工作区已有未提交改动，Git 写操作回归仅在临时仓库运行。

## 自动验证

本轮修复前基线：112 项测试全部通过（0 失败、0 跳过）；本轮最终结果见上节，TypeScript 检查、Host/Client 构建及产物语法检查通过。新增「补丁只按需取」的回归：带 `paths` 的差异请求只返回指定文件、`staged`/`unstaged` 两个索引边界互不串味、`-U0` 不再带上下文行、`-w` 丢弃纯缩进改动。新增侧栏导航、Hero 模式选择器保留、面板无遮罩展示和图标 SVG 回归。新增「tab 注册被拒绝时报告真实原因」的回归：注册失败不再退化成「侧边栏插件未就绪」。新增接入回归覆盖 Host 工作区模型类方法的 `this` 绑定：直接把 `getSnapshot` / `subscribe` 传给 React 会丢失接收者，导致 Slot 崩溃并被框架退役；现已改成稳定闭包调用原对象方法。此前 39 项测试未覆盖该集成边界，不能作为页面已成功挂载的证明。新增外部编辑器能力的回归：编辑器探测顺序与 `-g` 参数形态、`DSH_GIT_EDITOR` 覆盖、宿主打开能力优先于 shell、拒绝仓库外路径与 shell 元字符、文件已删除、路由参数校验，以及前端按钮点击后如实展示宿主返回结果（失败不显示成功）。新增「只加载一次」的回归：提交记录必须等仓库状态就绪后再请求日志（否则同一 revision 会被请求两次，列表显示后又被清空重载），仓库状态尚未就绪时不发差异请求，且「等仓库状态」与「等差异」共用同一个加载文案，不再出现连续两个加载画面。

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

## 第五轮：写操作、图谱与 agent 集成（本次大改）

本轮把插件从「只读查看」扩到「日常 Git 操作 + 与 agent 协作」，**新增/修改的 Host 路由很多（commit、push/pull/fetch、stash、标签、reflog、blob 图片、冲突解决、操作继续/中止、agent 工具等），必须完整重启 DSH Desktop**，只刷新页面不会加载新的 Host 代码（客户端 bundle 仍是热更新的）。

新增回归覆盖：status 的 ahead/behind/stash/分离头指针与四类状态条目（含 rename 的 origPath）、reflog/stash/tag/blame/name-status 解析、变更分组与提交前置校验、hunk 切分与补丁拼装、词级 diff、lane 图谱布局、blame 分组、AI 提示词构建与「发给会话 / 复制到剪贴板」两条投递路径、blob 路由（内容类型、404、缺参 400、非 GET 405）、agent 工具注册与 disposer 清理、审批钩子对 amend 提交与 stash drop 的拦截。

需要人工验收的新交互（建议在可丢弃的测试仓库中）：

1. 变更页：暂存/取消暂存/撤销更改/删除未跟踪/加入 .gitignore 是否都能工作且失败时有真实原因；`Ctrl/Cmd+Enter` 是否能提交。
2. hunk 级暂存：改一个文件的两处，只暂存其中一块，检查暂存区与工作区各自的内容符合预期。
3. 冲突：制造一次合并冲突，检查横幅、冲突分组、「用当前版本 / 用传入版本」以及「中止」。
4. 提交记录页：lane 图连线是否与实际分支拓扑一致；点开提交详情、reflog 软重置是否生效。
5. 储藏页与工作树页：储藏/应用/弹出/删除；lock/unlock/prune（prune 先预演再确认）。
6. 分支胶囊：`拉取` / `推送` / `获取` 在无凭据时是否给出明确提示而不是静默失败。
7. AI 动作：四个按钮是否把提示词发进当前会话（没有会话时应复制到剪贴板并说明）。
8. 图片差异：改一张 png 后是否内联预览（`GET /dsh-git/blob`）。
9. agent 工具：让会话里的 agent 执行 `git_status`，确认返回结构与审批询问（`git_commit` + amend、`git_stash` + drop）都符合预期。

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

## 第六轮截图反馈（分支浮层的两行噪音）

- **与上游一致时不再打印「领先 0 个提交，落后 0 个提交」**：这一行来自 `# branch.ab +0 -0`（`src/core/git-command.ts:8-13` 解析成 `status.ahead/behind`），只要有上游就渲染，于是同步状态下占掉一整行却说零信息，也和 `BranchChip` 的 `↑/↓` 徽标（0 时不显示；第十三轮起这两个计数改成了图标箭头，第十四轮起连同计数一起包成带底色的小胶囊，见文末）行为不一致。现在 `src/client/chips/BranchPopover.tsx:54` 用 `diverged`（任一侧大于 0）才渲染该行；储藏徽标不受影响，`0/0` 但有储藏时那一行仍然显示。
- **不再列出点了必然报错的远程分支**：点 `origin/master` 触发的是 Host 守卫 `src/host/git-service.ts:303`（`Local branch "master" already exists; select it explicitly instead of remote "origin/master"`）——本地 `master` 与 `origin/master` 是同一条记录的两行，Host 拒绝执行 `git switch --track -c master refs/remotes/origin/master`（Git 本身也会拒绝重名）。新增 `src/client/chips/branch-list.ts` 的 `selectableBranches`：远程行的短名（`remoteCheckoutName`，即第一个斜杠之后的部分，与 Host 的取短名逻辑一致）已被本地分支占用时，或本地已存在完全同名分支时，该远程行不再渲染。**没有本地对应的远程分支仍然保留**——fetch 之后检出队友的分支正是这条路径唯一的用途。过滤只作用于浮层列表，Host 的 `branches()` 与 agent 工具仍返回完整引用列表，`src/host/git-service.ts:303` 的守卫保持原样以防直接 API 调用。
- 新增回归 `tests/client-branch-list.test.mjs`（7 条）：重复远程行被丢弃、短名被占用的远程行被丢弃、无本地对应的远程行保留、本地分支恰好叫 `origin/topic` 时保留自己的行、过滤后顺序与 current 标记不变、纯本地列表原样返回。

## 第七轮截图反馈（历史点了没反应、外部编辑器选择）

- **「更多操作 → 历史」看起来没反应，其实是渲染到了可视区之外**：面板模式下 `FileInspectDialog` 不是遮罩——`src/client/dialogs/DialogShell.tsx:8` 读 `GitPanelContext`，只有 `src/client/panels/GitSidebarPanel.tsx:126` 提供 `true`，而工作台也走这条路径，于是它渲染成内联的 `<section class="dsh-git-panel-form">`。原实现把它放在 `.dsh-git-changes-panel` 的最后一个子节点（提交框之后），而工作台的 `.dsh-git-view-content` 是滚动容器、`.dsh-git-changes-body` 又是固定高度，表单就被追加到视口之外；窄侧栏里则被 `overflow:hidden` 裁掉。现在 `src/client/diff/ChangesTab.tsx:570` 在 `inspectFile` 有值时让检查器**占据 `.dsh-git-changes-body` 槽位**（替换文件列表 + diff 两栏），关闭即回到 diff，提交框始终是最后一个子节点；`src/client/styles.ts` 追加 `.dsh-git-changes-body > .dsh-git-panel-form`（填充、`height:100%`、自身滚动）三条 workbench 覆盖。TESTING.md:181 的「表单在面板中不使用遮罩」约定不变。
- **「在编辑器中打开」不再落进 Windows「打开方式」弹窗**：宿主的探测链在 PATH 上找不到候选 CLI 时会 `openWithoutEditor`（DSH opener → `cmd /d /s /c start`），机器上没有任何编辑器 CLI 时点击就变成系统弹窗。现在按钮改为应用内浮层 `src/client/editor-menu.tsx`：打开时向新路由 `POST /dsh-git/editors` 询问本机真实可用的编辑器，列出「编辑器名 + 命令」与「系统默认应用」，并把选择显式传回宿主 `editor.open(target, editor)`。
  - `SYSTEM_EDITOR = 'system'`：选择系统默认时**不探测**，即使机器上装了编辑器 CLI 也仍然走系统关联。
  - 显式选择不回退：名字不在候选里报「找不到编辑器：X」，命令解析不到报「找不到编辑器：X（命令行不在 PATH 中）」；配置了 `DSH_GIT_EDITOR` 时它成为唯一候选，其它选择被明确拒绝。
  - 探测失败（`listEditors` 抛错）在浮层内以 `role="alert"` 显示，并保留「系统默认应用」；关闭再打开即重试。没有编辑器 CLI 时提示「没有检测到编辑器命令行」。
  - 同一个浮层也用在 `src/client/dialogs/FileInspectDialog.tsx` 的历史页工具栏，所以两处行为一致。
- **顺带修掉一个真实缺陷**：探测 effect 最初把 `probing` 放进依赖数组，React 会在它变成 `true` 时先执行上一次的清理函数（`cancelled = true`），结果列表永远到不了、浮层一直停在「正在检测…」。现在依赖只有 `[open, editors]`，失败时保留 `null` 以便重开重试。
- 新增/改写回归：`tests/editor-menu.test.mjs`（10 条，用桩 `gitApi` 驱动真实组件：只列出探测到的编辑器、按下的是哪一个就发哪一个、system 项、无 CLI 提示、宿主拒绝原因、请求抛错、探测失败可重试、每次打开只探测一次、请求进行中禁用按钮）；`tests/editor-launcher.test.mjs` 新增 9 条（`listEditors` 顺序/空列表/`DSH_GIT_EDITOR` 唯一候选、显式选择不回退、未知名字、PATH 缺失、`DSH_GIT_EDITOR` 拒绝其它选择、system 不探测、仓库外路径仍被拒）；`tests/routes.test.mjs` 新增 4 条（`/editors` 不需要仓库、选择透传、非法 `editor` 400、探测失败 500）；`tests/client-api.test.mjs` 新增 2 条；`tests/client-diff-state.test.mjs` 改写 2 条编辑器用例并新增「历史占据变更主体、提交框仍是最后一个子节点」1 条。
- 结果：`pnpm run typecheck` 通过；`pnpm test` 198 条 / 197 通过 / 1 跳过 / 0 失败；`pnpm run build` 成功。**本轮改了 Host（`src/host/editor-launcher.ts`、`src/host/routes.ts`）**，新路由 `/dsh-git/editors` 需要完整重启 DSH Desktop 才会加载；只改客户端部分时刷新页面即可。

## 第八轮截图反馈（识别不到编辑器、文件历史的提交点了没反应）

- **编辑器列表是空的，可机器上确实装了编辑器**：探测原先只看 PATH（`where code`）。**VS Code 的用户安装版默认不往 PATH 写任何东西**，它的命令行 shim 在 `%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd`；本机实测 `code` / `code-insiders` / `cursor` / `windsurf` / `zed` / `subl` 全部不在 PATH 上，而该 shim 存在——于是浮层只剩「系统默认应用」。
  - `src/host/editor-launcher.ts` 的候选表为每个编辑器补上**常见安装位置**（win32 / darwin / linux 三套；`%NAME%` 与开头的 `~` 会展开），新增 `locate()`：先 PATH、再常见位置。PATH 命中优先，所以用户自己的 shim 不会被忽略；模板里若还残留未展开的 `%...%`（环境变量缺失）就视为无效，绝不会把字面量当路径。
  - `DSH_GIT_EDITOR` 现在也接受**绝对路径**，用于安装程序从未注册过的编辑器；`EditorChoice` 的 `command` 仍原样回传，显式选择照旧不回退。
  - 找不到时的文案改为「找不到编辑器：X（命令不在 PATH 中，也不在常见安装位置）」。
- **文件历史的提交行是按钮却点了没反应**：行的 `onClick` 只调用可选的 `onOpenCommit?.()`，而 `src/client/diff/ChangesTab.tsx` 构造 `FileInspectDialog` 时没有传这个 prop（提交详情只在提交记录页里接上了），点击因此被静默丢弃。
  - 下钻改由对话框自己承担：`src/client/dialogs/FileInspectDialog.tsx` 点行后让历史列表**原位**让位给该提交的详情——复用 `SelectedCommitDetails` + 懒加载 `CommitDetailDialog` 分片，分片加载失败时显示错误与「重试加载详情」。
  - `SelectedCommitDetails` 新增可选 `showBackButton`（默认 `false`，提交记录页维持原有行为）；文件历史下钻传 `true`，详情顶部因此有「返回」，回到的是同一份文件历史。
  - 下钻以**文件**为键：对话框被复用去显示另一个文件时不会残留上一个文件的提交；切换「历史 / 责任」页签也会清掉下钻。`onOpenCommit` 仍照常回调，嵌入方不受影响。
- 回归：`tests/file-history-drill.test.mjs`（新，6 条：列表在未下钻时正常、点行后列表让位且分片加载完成、返回回到同一份历史、切页签清空下钻、换文件不残留、分片失败给出重试）；`tests/editor-launcher.test.mjs` 新增 6 条（常见位置命中、PATH 优先、`listEditors` 与选择值一致、未展开占位符不算路径、`DSH_GIT_EDITOR` 绝对路径、其它平台不匹配 Windows 位置），并给所有假 launcher 补上 `pathExists: () => false` 以保持密闭；`tests/history-detail-render.test.mjs` 新增 1 条（嵌套详情带「返回」）。
- 本机实测（PATH 上没有 `code`）：`createEditorLauncher().listEditors()` → `[{ command: 'code', label: 'VS Code', goto: true }]`。全量 `pnpm test` 211 条 / 210 通过 / 1 跳过 / 0 失败；`pnpm run typecheck` 与 `pnpm run build` 通过。
- **本轮再次改了 Host（`src/host/editor-launcher.ts`）**，需要完整重启 DSH Desktop 才会用上新的探测逻辑。

## 第九轮截图反馈（浮层里只认得出 VS Code）

- **症状**：上一轮的「常见安装位置」只覆盖按固定路径安装的产品，机器上装的 JetBrains 系列（IntelliJ IDEA、WebStorm、CLion、DataGrip）一个都没出现，浮层里孤零零一项 VS Code——而 Windows 的「打开方式」里明明列着 IntelliJ IDEA 和 WebStorm。
- **根因**：JetBrains 的安装路径带产品名但不带版本（`%LOCALAPPDATA%\Programs\IntelliJ IDEA\bin\idea64.exe`），Toolbox 还要再深三层（`…\JetBrains\Toolbox\apps\<产品>\<渠道>\<构建>\bin\idea64.exe`），**任何固定清单都穷举不了下一个版本的目录名**，而上一轮只有固定清单 + PATH。本机实测：`idea` / `webstorm` / `clion` / `datagrip` 都不在 PATH，四个 `.exe` 都在 `%LOCALAPPDATA%\Programs\<产品>\bin\` 下。
- **修法**：`src/host/editor-launcher.ts` 增加**目录遍历式探测**：候选可以带 `discovery: { roots, patterns }`，`patterns` 以 `/` 分隔、`*` 匹配一层目录，于是「产品目录 / Toolbox 三层嵌套 / macOS 的 `X.app/Contents/MacOS/x`」各用一条模式描述；遍历时逐层 `pathExists`，版本号变了也照样命中（同级多个版本按数字倒序，新版本优先）。
  - 新增 JetBrains 产品表（IntelliJ IDEA、WebStorm、PyCharm、PhpStorm、GoLand、CLion、Rider、DataGrip、RubyMine、Android Studio），共用同一套 Toolbox 布局；参数风格新增 `jetbrains`（`--line <n> <路径>`），因为 JetBrains 既不认 `-g`，也不认 `路径:行号`。
  - 探测顺序仍是 PATH → 固定位置 → 目录遍历；PATH 命中优先，用户自己的 shim 依然不被忽略。同一产品装两遍（独立安装 + Toolbox）只列一次。
  - `DSH_GIT_EDITOR` 指向某个已知产品的真实二进制（如 `…\bin\idea64.exe`）时会**继承该产品的参数风格**，不再退回 `路径:行号`。
- 本机实测（PATH 上什么都没有）：`listEditors()` → `VS Code / IntelliJ IDEA / WebStorm / CLion / DataGrip`，与 `%LOCALAPPDATA%\Programs` 下实际安装的一致。
- 回归：`tests/editor-launcher.test.mjs` 新增 5 条（`Programs\<产品>\bin` 命中、Toolbox 三层命中、JetBrains 选择收到 `--line`、macOS `.app` 命中、`DSH_GIT_EDITOR` 指向真实二进制仍用 `--line`），并给所有假 launcher 补 `listDirectory` 以保持密闭。全量 `pnpm test` 216 条 / 215 通过 / 1 跳过 / 0 失败；`pnpm run typecheck` 与 `pnpm run build` 通过。
- **本轮再次改了 Host（`src/host/editor-launcher.ts`）**，需要完整重启 DSH Desktop。

## 第十轮截图反馈（探测太慢、选项没有图标）

- **症状**：浮层打开后停在「正在检测已安装的编辑器…」数秒（本机 8–10 秒）才出结果，期间只有「系统默认应用」一项；同时用户要求每一项显示图标。
- **根因（探针实测，两层）**：
  - 每个候选都 spawn 一次平台查找器（`where code` / `where idea`）≈150ms，16 个候选就是约 2.4 秒——但只解释一部分：把这些换成进程内扫 PATH 后仍有 7.2–7.9 秒。
  - 真正的元凶是**深层通配套在大根目录上**：`*/*/*/bin/<exe>` 这类三层模式会对每个候选整棵遍历 `%LOCALAPPDATA%\Programs`，未安装的产品也不得不走完。实测单个未安装产品 = 511ms / 325 次目录列举 / 3142 次存在性检查；JetBrains 表里没装的六个产品再加上 `%ProgramFiles%\Android` 等根，合计约 7 秒。文件系统本身很快（`readdir` 全部 PATH 目录 23ms、`existsSync` 6 个名字 × 56 目录 48ms），是模式设计放大了成本。
- **修法**（`src/host/editor-launcher.ts`）：
  - PATH 查找改为进程内扫描（新导出 `findOnPath(command, { env, platform, listDirectory, isExecutable })`）：**每个 PATH 目录只列举一次**，按 `.exe` → `.cmd` → `.bat` → `PATHEXT` → 无扩展名 的顺序匹配，同一后缀内更早的 PATH 目录优先（用户自己的 shim 不被后来的安装遮住），POSIX 还要求可执行位；命令本身含路径分隔符时不查 PATH。删掉了 `execFile` + `promisify`。
  - 候选探测并发执行（`detect()` 用 `Promise.all`），并把本次探测内的目录列举结果缓存（多个 JetBrains 产品走同一批根目录，只读一次）。
  - 探测结构从「所有根 × 所有模式」改为「每个根只配它下面真会出现的模式」（`discovery: { locations: { win32: [{ root, patterns }] } }`）：三层通配只留在 Toolbox 这种固定层级上。
  - 图标（第二轮返工）：画出来的标记不是「软件的图标」，所以改成**读取真正的应用图标**。Windows 每个可执行文件自带图标资源（PE 资源），Node 读不了，于是 `src/host/app-icons.ts` 用一次 `powershell.exe -EncodedCommand` 批量调用 `[System.Drawing.Icon]::ExtractAssociatedIcon`，把结果作为 PNG data URL 放进 `EditorChoice.icon`——浮层显示的与资源管理器「打开方式」里的图标是同一个。图标只在 Windows 上取（其它平台没有该 API），读不到时保留客户端画的标记，所以永远不会出现空格子。`.cmd`/`.bat` shim 不是应用本身（`code.cmd` 带的是控制台图标），会按同名词干向上找 `Code.exe`（最多三层）再取图标。图标按可执行文件路径缓存在宿主的 launcher 实例里，并且在启动时**后台预热**：用户打开浮层时图标已在缓存中（预热实测约 0.7s，之后 `listEditors()` 仍是 ~150ms）。批处理是串行的，预热与手动打开不会重复起第二次 shell。
  - 客户端仍有 `src/client/editor-icons.tsx` 作为回退：VS Code / Insiders 内嵌官方缎带矢量（`fillRule="evenodd"`）、JetBrains 与 Cursor / Zed / Sublime / Windsurf 用品牌色方块、认不出来的编辑器用主题色调字母块。品牌色属于**产品身份**而不是主题决定，因此 `tests/theme.test.mjs` 显式豁免这一个文件，其余 `src/client` 依然只允许主题令牌。
  - 同时修掉两个显示缺陷：标记曾被 `.dsh-git-editor-option > span { flex: 1 }` 一起拉成整条横杠（补更高优先级的 `flex: 0 0 auto` 规则），浮层宽度由 230px 放宽到 268px，「IntelliJ IDEA」不再被截断。
  - CSS 注释里不能出现反引号：`src/client/styles.ts` 的样式是模板字符串，注释中的反引号会直接终止模板（`TS1005`）。
- 实测对比：`listEditors()` 由 8563ms / 10300ms 降到 **181ms / 97ms / 99ms**（约 85 倍），结果不变（VS Code、IntelliJ IDEA、WebStorm、CLion、DataGrip）。
- 回归：`tests/editor-launcher.test.mjs` 43 条（新增 5 条 PATH 查找：`.exe` 优先于 `.cmd`、更早的 PATH 目录优先、命令本身是路径时不查 PATH、POSIX 可执行位、端到端经 PATH 命中且不起查找进程；另有 2 条图标：拿到的图标随条目返回、读不到时条目仍在且不带空格子）；`tests/app-icons.test.mjs` 3 条（排除 console 脚本、shim 向上找应用、单次 shell 服务整批 + 缓存 + 失败只损失图标）；`tests/editor-menu.test.mjs` 13 条（真实图标优先于画出来的标记、未知命令的字母与色调稳定）。全量 `pnpm test` **229 条 / 228 通过 / 1 跳过 / 0 失败**；`pnpm run typecheck` 与 `pnpm run build` 通过。
- **本轮又改了 Host（`src/host/editor-launcher.ts`）**，需要完整重启 DSH Desktop。

## 第十一轮截图反馈（分支浮层的排版）

- **症状**：分支浮层里「已获取远程更新」竖排成一条贴在右边缘的文字；分支行下面留出一大块空白，浮层显得又高又空。
- **根因（两个独立的 CSS 问题）**：
  - 同步结果 `{notice && <div className='dsh-git-changes-notice'>}` 写在 `.dsh-git-popover-actions` **里面**，那一行是 `display: flex` 且三个按钮各占 `flex: 1`，结果文字只剩十几像素宽，每个字单独折行——视觉上就成了竖排。
  - `.dsh-git-branch-list` 用了 `flex: 1`（`flex-basis: 0`）在定高容器里抢空间，配合 `max-height: 240px`，于是只有一两个分支时也撑满 240px 的空白框。
- **修法**：
  - 同步结果改为 `.dsh-git-popover-notice`，渲染在分支列表与按钮行**之间**，独占整行（`margin: 6px 10px 0`、`overflow-wrap: anywhere`、成功态用 `state-success-primary` 令牌），按钮行里只剩三个按钮；错误提示同理改为 `.dsh-git-popover-error`（原来的内联 `fontSize/padding` 收进样式表）。
  - `.dsh-git-branch-list` 改成 `flex: 0 1 auto; min-height: 0`：列表按内容高度收缩，分支多时仍在 240px 处滚动。
- **回归**：新增 `tests/branch-popover-layout.test.mjs`（2 条：真实渲染浮层并断言三个同步按钮与页脚入口；按钮行里不得出现 `notice`、同步结果必须是 `dsh-git-popover-notice`，以及样式表里 `flex: 0 1 auto` 与整行位置的规则仍在）。全量 `pnpm test` **231 条 / 230 通过 / 1 跳过 / 0 失败**；`pnpm run typecheck` 与 `pnpm run build` 通过。
- 视觉自检：用 `sheetText()` 把**真实样式表**注入预览页（自带主题令牌），headless Edge 截图为 `%TEMP%\popover-preview.png`，确认列表贴合内容、绿色提示占满一行、按钮均匀分布。
- 只改了客户端（`BranchPopover.tsx` / `styles.ts`），刷新页面即可；Host 无改动，但上一轮的真图标仍需完整重启 DSH Desktop。

## 需要人工完成的界面验收

当前工具没有已登录页面的浏览器交互/截图控制能力；自动测试不等于真实页面、焦点或主题验收。

> 这 16 条已于 2026-10-17 由机器执行完毕（真实组件 + 真实宿主 + 本机真实探测），逐条结论、发现的一处真实差距与两处条文订正见文末「第十二轮」。机器证明不了的残余边界也列在那一轮里。第 10 条已在第十六轮按新版浮层重写；那一轮的浏览器断言同步改了，但本机缺验收前置文件没跑，详见该轮的观察项。

建议在一个可丢弃的测试仓库中进行：

1. 打开两个不同仓库的会话，来回切换，核对分支名、变更路径和 Worktree 管理都属于当前会话，不跳到第一个工作区。
2. 编辑同一个已修改文件，脏文件数量不变；等约 3 秒，Diff 应更新。切换干净分支或提交后也应更新。
3. 快速切换“工作区/上游”比较，不能出现新标签下的旧内容；没有上游应明确报错，不显示假空结果。
4. 创建分支/Worktree 表单是内联展开在面板里的：展开后焦点落在名称输入框；输入名称期间状态刷新（约 3 秒一次）不会清空已输入内容；Tab 按浏览器原生顺序移动，可以离开表单（这是内联表单的预期行为，不是缺陷）；Escape 不关闭表单，关闭请用「取消」或右上角 ×；表单没有遮罩、没有 `role="dialog"`、没有焦点陷阱；关闭表单后草稿不保留，也不跨视图切换保存。
5. 创建 Worktree 后应实际打开该路径的工作区会话。若打开失败，应显示已创建路径，并可重试打开，不重复创建目录。
6. 在临时 Worktree 中留下未提交文件再删除：应该拒绝、显示错误且文件保留。锁定工作树的删除按钮应禁用。
7. 浅色/深色各检查分支浮层、创建对话框、变更面板、错误提示与增删行；检查窗口窄屏时浮层位置和滚动。
8. 分支浮层：与上游完全同步时不再出现「领先 0 个提交，落后 0 个提交」；与本地同名的远程分支（已有本地 `master` 时的 `origin/master`）不再出现，而 `git fetch` 后新增的、无本地对应的远程分支仍能点击检出；有储藏时储藏徽标仍显示。
9. 变更面板点「更多操作 → 历史」：内联的文件历史视图应立刻占据变更面板主体（即变更面板正文里那层 `.dsh-git-panel-form`），窄侧栏里不被裁切，「历史 / 责任」页签可用，关闭后回到原来的文件列表 + diff，提交框始终贴在面板最下方。（注意：「提交记录」页签里的提交图面板是另一条路径，它会整页替换变更页、不显示提交框，不要拿它来对标本条。）
10. 点「在编辑器中打开」：应先展开应用内浮层，第一行是「系统默认应用（默认）」，其后是本机真实探测到的编辑器（只画应用图标与名称，命令名放进悬停 `title`），最后一行「显示文件位置」用系统文件管理器选中当前文件、而不是打开编辑器；选某个编辑器就用它打开，选「系统默认应用」才走系统关联。机器上没有任何编辑器 CLI 时，浮层应明确说明，并保留「系统默认应用」「显示文件位置」两项；diff 头部与历史对话框工具栏这两处浮层行为一致。
11. 编辑器没有加入 PATH 的机器（VS Code 用户安装版默认如此）：浮层里仍应列出该编辑器，选中后能用它打开当前文件并定位到行；PATH 里的同名 shim 优先于常见安装位置；`DSH_GIT_EDITOR` 设为绝对路径时，浮层只列这一个。
12. 变更面板 →「更多操作 → 历史」：点任意一条提交，历史列表应**原位**换成该提交的详情（顶部有「返回」回到同一份文件历史）；切换「历史 / 责任」页签或换一个文件后，不应残留上一条提交的详情；详情分片加载失败时显示错误与「重试加载详情」。
13. 浮层应列出机器上**实际装着**的编辑器：Windows 上装了 JetBrains 系列时（`%LOCALAPPDATA%\Programs\<产品>\bin`，Toolbox 安装则在 `…\JetBrains\Toolbox\apps` 下）应一并列出 IntelliJ IDEA / WebStorm 等；选 JetBrains 打开带行号的文件时用 `--line <n> <路径>` 定位；同一产品装两遍只出现一次。
14. 点开编辑器浮层应立即出结果（本机实测：重启后第一次即 ~150ms，图标在宿主启动时已后台预热），不再长时间停在「正在检测已安装的编辑器…」；每一项左侧是**该软件自己的图标**，应与 Windows「打开方式」里看到的一致（VS Code 蓝色的 X 缎带、IntelliJ IDEA / WebStorm / CLion / DataGrip 各自的彩色标记），图标不被拉伸成横条、不被截断；宿主读不到图标时才退回画出来的标记，「系统默认应用」是文档图标（右侧带灰色「（默认）」），底部的「显示文件位置」是文件夹图标。
15. 探测不应拖慢面板：反复打开、关闭浮层不应有卡顿；PATH 很长或装了多个 JetBrains 产品时也应同样快（探测结果在组件内缓存，同一次会话只问宿主一次）。
16. 分支浮层排版：分支只有一两个时列表贴合内容，不再留一大块空白；点「获取/拉取/推送」后的结果（如「已获取远程更新」）应**独占一整行横排**显示，不能竖排或贴在右边缘；长输出换行而不撑破浮层；错误提示同样占整行且带凭据提示。

这些人工步骤不需要在真实项目上尝试危险参数或强制删除。

## 第十二轮：16 条界面验收的机器执行（2026-10-17）

- **手段**：DSH Desktop 没有开 CDP 调试端口（`%APPDATA%\DSH Desktop\DevToolsActivePort` 不存在），所以不驱动真实 GUI，改用三路证据：
  - `tests/acceptance-ui.test.mjs`（10 条）：esbuild 打包**真实客户端组件**，注入抽取的宿主 CSS 与真实主题令牌（桌面兼容表 + `@deepseek-ai/dsh-client-ui-theme`），在 headless Chrome 里跑，覆盖真实焦点、几何与截图。
  - `tests/acceptance-host.test.mjs`（4 条）：真实 Cordis 宿主 + 真实 git 仓库（bare 上游、零远程仓库、真实 worktree、锁定工作树）+ 假编辑器 CLI 记录 argv。
  - 本机真实探测：默认 `createEditorLauncher({})` 的返回与耗时，以及真机 `git worktree remove` 的拒绝行为。
- **截图**：`%TEMP%\acc\changes-light.png`、`changes-dark.png`、`history-narrow.png`、`editor-menu.png`、`worktrees-guarded.png`。
- **逐条结论（16/16）**：
  1. **通过**。两个工作台实例同时挂载、来回切换，各自的分支/路径/变更列表/diff 互不串台；真实宿主侧同一会话解析器返回各自路径、视图键各自独立（`worktrees` vs `history`），未知会话解析为空。
  2. **通过**。按真机机制用**推送**驱动（不依赖窗口 focus）：宿主 3000ms 轮询推 status → 客户端按 revision 重取 diff；真实宿主实测改动已跟踪文件后 2.91s 事件到达，脏文件数不变时切分支也会刷新。
  3. **通过**。旧 HEAD 的延迟结果被丢弃（不出现新标签下的旧内容）；`main → origin/main` 切换后旧的 WORKING 哨兵值不复现；零远程仓库的 `remotes` 为 `[]`，宿主返回 `HTTP 500 fatal: Needed a single revision`，界面显示「当前分支未配置上游，无法对比。」（`src/client/diff/ChangesTab.tsx:211`）且 0 次 diff 请求，没有假空结果。
  4. **通过（条文已订正，见下）**。
  5. **通过**。真实创建目录；注入打开失败时界面显示已创建路径 +「（工作树已保留，可重试打开）」+「重试打开工作区」，重试不再创建目录（`createRequests: 1`）、同一路径再次交给工作区桥、`git worktree list` 仍为 2 棵。残余边界：工作区桥是捕获桩，已安装的 DSH 工作区控制器自身的持久化与幂等不在覆盖内。
  6. **通过（先发现真差距，已修，见下）**。
  7. **通过**。浅色/深色真实令牌下计算对比度 14.94–16.29 / 13.42–15.17；深色截图确认 `#181818` 底、`#232323` 次级按钮、`#ededed` 文字，增删行与错误提示可读；430px 窄栏无横向溢出、浮层不越界。
  8. **通过**。同步态不出现「领先 0 个提交，落后 0 个提交」；本地已有 `master` 时不再列 `origin/master`，而 fetch 后新增、无本地对应的远程分支仍可检出；储藏徽标仅在计数不为 0 时出现。
  9. **通过（条文已订正，见下）**。
  10. **通过**。diff 头部与历史工具栏两处入口行为一致：先展开应用内浮层，列出真实探测到的编辑器（名称 + 命令）与「系统默认应用」；没有任何编辑器 CLI 时显示「没有检测到编辑器命令行」并保留「系统默认应用」；Escape 关闭并把焦点还给触发器。
  11. **通过**。本机 PATH 的 56 个目录里一个编辑器都没有，浮层仍列出 5 个（VS Code + 4 个 JetBrains 产品）；注入 PATH 优先的同名 shim 后返回的是 shim；`DSH_GIT_EDITOR` 指向绝对路径时只列这一项；JetBrains 用 `--line <n> <路径>`。
  12. **通过**。点提交后列表**原位**换成详情（不是追加在下面：历史行数归零），详情按被点的 hash 请求，顶部「返回」回到同一份文件历史，切「历史 / 责任」页签或换文件都不残留，关闭后回到文件列表 + diff。残余边界：详情分片加载失败的「重试加载详情」分支在浏览器 fixture 里无法触发（esbuild 内联了动态 import），由 `tests/history-loading.test.mjs` 覆盖。
  13. **通过**。真实探测到本机实际安装的 5 个编辑器（VS Code + IntelliJ IDEA / WebStorm / CLion / DataGrip），同一产品只出现一次、各自带真实图标。残余边界：本机没有 Toolbox 安装，`…\JetBrains\Toolbox\apps` 的三层发现只有单测覆盖。
  14. **通过**。冷启动第一次 874ms（与后台图标预热并发，用户看不到），预热完成后的第一次 101.6ms、后续 95–106ms 且零 shell 启动；每一项左侧是该软件自己的图标（真实字节 1202–1658），正方形未被拉成横条，「系统默认应用」是文档图标。
  15. **通过（措辞修正）**。预热后约 100ms；200 条 PATH 时 40.7ms；反复开关浮层不会重新探测。注意缓存粒度是**每个浮层组件各一次**，不是整会话一次（diff 头部与历史工具栏各算一次），与原文「同一次会话只问宿主一次」的措辞不符。
  16. **通过**。只有一两个分支时列表贴合内容（`.dsh-git-branch-list { flex: 0 1 auto }`）；同步结果独占一整行（`.dsh-git-popover-notice`，`overflow-wrap: anywhere`）而不竖排、不贴右边缘；错误提示同为整行块（`.dsh-git-popover-error`，`src/client/styles.ts:480`）并带凭据提示（`src/client/chips/BranchPopover.tsx:57,125-127`）。凭据提示这一句只有源码级证据。
- **差距（第 6 条，已修）**：`src/client/dialogs/WorktreeDialogs.tsx:235` 的「移除工作树」按钮原先只按 `busy` 禁用，**没有锁定守卫**，锁定工作树那一行点下去只会走到 git 报错。真机证据：无 force 与**单个 `--force`** 都返回 `fatal: cannot remove a locked working tree, lock reason: …\nuse 'remove -f -f' to override or unlock first`，目录仍在（git 要求 `-f -f`；宿主 `src/host/git-service.ts:1076-1082` 也不做前置检查）。修法：`disabled={!!busy || !!worktree.locked}` + tooltip「已锁定的工作树需先解锁才能移除」。
- **订正 1（第 4 条）**：已发布的界面只有一条路径且恒为**内联面板**（`GitWorkbenchPage.tsx:44` → `GitSidebarPanel.tsx:126`），`DialogShell.tsx:16` 在内联时直接返回，所以旧条文里的「遮罩 / 焦点陷阱 / 切到终端再回来输入保留」描述的模态框早已不存在（`.dsh-git-modal-card` 是不可达代码，CI 反而断言它不出现）。条文已按真实行为重写。
- **订正 2（第 9 条）**：点「更多操作 → 历史」展开的是 `变更面板正文 > .dsh-git-panel-form` 里的内联文件检查视图；`.dsh-git-history-panel` 属于「提交记录」页签的提交图面板，两者不是同一条路径。条文已改写为指名路径并加了提醒。
- **观察项（不算失败）**：git 原文错误直接透出（锁、脏、缺上游都是英文原文，`src/` 里没有翻译层）；`@media (prefers-reduced-motion: reduce)` 没有关掉 `.dsh-git-btn` 的底色过渡（`src/client/styles.ts:157,206`）；第 16 条的凭据提示行没有断言覆盖。
- **回归**：`node --test tests/*.test.mjs` = **248 条 / 247 通过 / 1 跳过 / 0 失败 / 52.3s**（新增 10 + 4 条验收测试；跳过项是本机不支持的 POSIX FIFO 用例）；`npm run typecheck`、`npm run build` 通过。本轮只改客户端（`src/client/dialogs/WorktreeDialogs.tsx`），**刷新页面即可生效，无需重启 DSH Desktop**。

## 第十三轮截图反馈（输入框胶囊的「↑3」被读成「main 13」）（2026-10-18）

- **现象**：bili 工作区的新会话页里，输入框上方的分支胶囊被用户读成「main 13」，工作台仓库行也有同一个数字，用户判断是插件新引入的 bug。截图里被框住的有四处：胶囊、浮层的「领先 3 个提交，落后 0 个提交」、工作台仓库行、以及「工作区很干净」。
- **先核对数据：这些数字全对**。`D:\bili` 的 `git status --porcelain=v2` 给出 `# branch.ab +3 -0`，`git rev-list --left-right --count main...origin/main` = `3 0`；三个提交 `c8d0ba6`（00:38「美化遥测控制台界面：重写双样式表并微调图表表现」）、`0a79c21`（01:09「重做遥测控制台视觉：深色侧栏 + BILI 粉主题，重构概览排版」）、`6152345`（02:06「遥测服务端回收陈旧安装索引，避免渠道满额后永久拒收新设备」）确实还没推送——`git ls-remote origin refs/heads/main` 仍是 `c1f4d06`，不是本地引用过期。工作区也确实干净（`git status --porcelain` 空）：近一小时的改动全落在 `.gitignore:5:**/build/` 覆盖的构建产物里。所以「工作区很干净」与「领先 3」并不矛盾——那三个提交已经提交，只是没推。
- **为什么现在才看见**：胶囊上的 ahead 徽标来自 `42805d0`（2026-10-16「feat: 完善整页 Git 工作台并修复操作安全与会话草稿交互」），浮层的领先/落后行来自 `ceaab5e`（同日），构建产物 `lib/client.js` 生成于 2026-10-17 01:24——重启桌面端之后这批 UI 才第一次出现。
- **真正的缺陷是字形与画法不一致**：`src/client/chips/BranchChip.tsx` 原先直接写正文文本 `↑{ahead}` / `↓{behind}`（U+2191 / U+2193），13px 下笔画极细、紧贴数字、与分支名之间只隔一个 chip gap，读起来就是「main 13」；而同一个数字在工作台仓库行（`src/client/diff/ChangesTab.tsx:486-487`）用的是 `IconArrowUp` / `IconArrowDown` 的 SVG。
- **修法（用户点名的范围内：只改胶囊）**：
  - `src/client/chips/BranchChip.tsx:4,57-60`：分支名包进 `.dsh-git-chip-branch`；计数改用 `IconArrowUp` / `IconArrowDown`（12px，定义在 `src/client/icons.tsx:206,210`：24×24 viewBox、stroke 1.7），并补 `title`（「领先上游 N 个提交」/「落后上游 N 个提交」）。储藏徽标那一行没动。
  - `src/client/styles.ts:67`：截断规则从 `.dsh-git-chip > span` 收窄到 `.dsh-git-chip > .dsh-git-chip-branch`，否则 `max-width: 104px` / `text-overflow: ellipsis` 也会套到徽标上。
  - `src/client/styles.ts:474-476`：`.dsh-git-ahead, .dsh-git-behind` 改成 `display: inline-flex; gap: 2px; font-size: 11.5px; font-variant-numeric: tabular-nums`，颜色 token 不变（`brand-primary` / `state-warn-primary`）。数字与它自己的箭头绑在一起（2px）、与分支名隔开（chip 的 gap），层级才对。
- **刻意没改**（用户没勾选这两项，别顺手改）：`src/client/chips/BranchPopover.tsx:118` 在只有一侧非零时仍会写出「落后 0 个提交」；同一个 ahead 数字在输入框胶囊、浮层、工作台仓库行三处重复显示。
- **验证**：
  - `npm run typecheck` 通过；`npm run build` 重新生成 `lib/index.js` + `lib/client.js`。本轮只动客户端，按本文档第 205 行的约定**刷新页面即可生效，无需重启 DSH Desktop**。
  - 新增 `tests/branch-chip-badge.test.mjs`（3 条）：用 `node:module` 的 `registerHooks` + `ts.transpileModule` 直接对**真实组件**做 SSR（客户端桩只替换 `api.js` / `use-git-status.js` / `cwd-resolver.js` / `BranchPopover.js`，`.js` 仍解析到真实的 `icons.tsx`），断言分支名仍是 `main`、整块 markup 里不得出现 `↑`/`↓` 字符、徽标内是 24×24 的 svg 且数字在 `</svg>` 之后、`title` 文案、0/0 时什么都不渲染，以及样式表里不再有会误伤徽标的 `.dsh-git-chip > span {`。
  - `tests/acceptance-ui.test.mjs:849-863` 的浏览器断言同步改成 `textContent === '2'` / `'1'`，并新增「箭头必须是 svg（`viewBox` = `0 0 24 24`）」与「正文不得出现 `↑↓`」两条。
  - **这轮浏览器验收是真跑了的**：本机 profile 下没有 `puppeteer-core`（`C:\Users\luoya\.dsh\profiles\desktop\node_modules\puppeteer-core\...` 不存在，profile 的 `package.json` 也没声明它），所以默认的 `npm test` 会跳过这 10 条和 `acceptance-host` 的第 3 条。装到临时目录再把路径指过去即可：`npm install --prefix %TEMP%\dsh-puppeteer-core puppeteer-core@latest` + `$env:DSH_PUPPETEER_MODULE=%TEMP%\dsh-puppeteer-core\node_modules\puppeteer-core\lib\puppeteer\puppeteer-core.js`。这样跑 `tests/acceptance-ui.test.mjs` 是 **10/10 通过、`ACCEPTANCE_UI_ASSERTIONS=256`**，其中「Acceptance 8: branch chip and popover render only nonzero divergence and stash badges」就在真实 Chrome + 真实组件 + 真实令牌下验证了本轮改动。
  - 视觉对比（同一套样式表、同一个 Chrome，SSR 真实组件、两张图并排）：`%TEMP%\dsh-git-chip-preview\chip-variants.png`。改之前 `main ↑3`（细箭头贴数字）、改之后 `main ↑ 3`（图标箭头、与数字留 2px、数字降为 11.5px）。
- **观察项**：
  - 临时装 `puppeteer-core@25.14.0` 之后，全量跑会有一条宿主验收用例（`acceptance-host.test.mjs` 的「real Cordis host scopes two repos…」）在并行负载下出现 20.2s 超时（3 次运行里 1 次，单独重跑通过），并且进程结束后不退出、需要 `--test-force-exit`。与本轮改动无关（本轮只改客户端），留档待查。
  - 回归数字：默认 `npm test`（无 puppeteer）本机是 **248 条 / 235 通过 / 13 跳过 / 0 失败 / 63.3s**；配上临时 puppeteer + `--test-force-exit` 后是 **251 条 / 250 通过 / 1 跳过 / 0 失败 / 60.3s**（跳过的是本机不支持的 POSIX FIFO 用例）。

## 第十四轮截图反馈（浮层的分歧行重做，计数改成带底色的胶囊）（2026-10-18）

- **现象**：第二轮截图里被框住的是浮层打开时那行「领先 3 个提交，落后 0 个提交」，原话「这里也改一下，太丑了，而且那个图标也没变啊，你不是改了嘛？」。两件事要分开：(a) 浮层那行确实又丑又啰嗦；(b) 胶囊里的箭头看起来没变。
- **先验证第十三轮到底生效没有：生效了，只是看不出来**。运行中窗口的自检文件 `%TEMP%\dsh-plugin-git-client-report-client.json` 落盘于 2026-10-18 02:49:47（= 2026-10-17T18:49:46.819Z），`build: "font-cjk-3"`、`stylesLength: 70954`，晚于那次构建；像素级证据更直接：把用户那张截图里的胶囊放大到 2×/8× 后，箭头是**描边图标**（笔画有粗细变化、带圆头）且与数字之间有空隙——1.0.3 的正文 `↑3` 是等宽笔画、紧贴数字。所以问题是「改动幅度不够、1× 下看不出来」，不是热更新没生效。
- **改法（浮层这一行）**：`src/client/chips/BranchPopover.tsx:51-58` 把 `ahead`/`behind`/`stashCount` 一律归一成数字，`diverged = ahead > 0 || behind > 0`；`:118` 起用 `.dsh-git-diverged` 行替换原来那句固定文案——**只画真正非零的那一侧**，每一侧是一个「图标 + 文字」的胶囊（`领先 3 个提交` / `落后 2 个提交`），各自带 `title`；有储藏时同一行再补 `储藏 N` 徽标；与上游一致（0/0）时整行不渲染（第六轮的约定不变）。原来那行用 `.dsh-git-muted`（`src/client/styles.ts:214` 只有颜色、没有 padding），所以是贴着卡片左边缘的；现在 `src/client/styles.ts:479-480` 的 `.dsh-git-diverged { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 14px 8px }` 让它左右都有呼吸位，窄侧栏里换行也不挤。
- **改法（胶囊里的计数）**：`src/client/styles.ts:474-476` 把 `.dsh-git-ahead, .dsh-git-behind` 从「裸图标 + 数字」升级成**带底色的小胶囊**：`padding: 1px 6px 1px 5px; border-radius: 999px; font-size: 11px`，ahead 用 `brand-primary` 13% 底 + 品牌色字，behind 用 `state-warn-primary` 14% 底 + 警示色字。这样「↑ 3」在分支名后面是一个有硬边界的整体，不可能再被读成 `main 13` 的一部分。
- **三处统一**：工作台仓库行（`src/client/diff/ChangesTab.tsx:486-487`）的两个徽标补上 `dsh-git-ahead` / `dsh-git-behind` 类，于是它与输入框胶囊、浮层胶囊共用同一套画法；`src/client/styles.ts:540-544` 给 `.dsh-git-ahead-behind, .dsh-git-stash-badge` 同样的 `padding: 1px 6px 1px 5px; border-radius: 999px`，behind 一侧靠复合选择器 `.dsh-git-ahead-behind.dsh-git-behind` 换成警示色（特定度高于单类，不依赖书写顺序）。
- **测试**：
  - `tests/branch-chip-badge.test.mjs` 从 3 条加到 **5 条**：现在也 SSR 真实的 `BranchPopover`（只桩掉 `api.js`，`.js` 依次找 `.tsx`/`.ts`），断言 ahead-only 时浮层只画一个胶囊 `领先 3 个提交`、全行不得出现「落后」或 `↑↓`；两侧都分歧时两个胶囊；与上游一致时 `.dsh-git-diverged` 根本不出现。样式表断言同步换成新的胶囊 CSS。
  - `tests/acceptance-ui.test.mjs` 的 Acceptance 8 增加 **ahead-only 阶段**（ahead 3 / behind 0 / stash 0）：真实 Chrome 里断言胶囊里是 `3` + svg、没有 behind，浮层里恰好一个 `.dsh-git-diverged > span` 且文本是 `领先 3 个提交`、不含「落后」；0/0 阶段改为断言整行不存在。
  - `tests/branch-popover-layout.test.mjs` 的图标桩补上 `IconArrowUp`/`IconArrowDown`：桩的导出白名单缺这两个会让真实组件 import 失败（`SyntaxError: The requested module '../icons.js' does not provide an export named 'IconArrowDown'`）。**组件新增图标依赖时必须同步桩白名单**——这是本轮唯一一次回归失败，也是这类 SSR 测试的固定坑。
- **视觉对比**：`%TEMP%\dsh-git-chip-preview\pills-after.png`（1560x1440，2× 缩放）是同一套真实组件 + `sheetText()` + 应用真实令牌表渲染的「改之前 / 改之后」并排图：左边 `main ↑3` + 贴边的「领先 3 个提交，落后 0 个提交」，右边 `main [↑ 3]` + 带 14px 内边距的 `[↑ 领先 3 个提交]` 胶囊，且没有「落后 0」。
- **回归**：`node --test tests/*.test.mjs`（配临时 `puppeteer-core` + `--test-force-exit`）= **253 条 / 252 通过 / 0 失败 / 1 跳过 / 52.0s**，浏览器验收 `ACCEPTANCE_UI_ASSERTIONS=266`；`npm run typecheck`、`npm run build` 通过。本轮只改客户端，**刷新页面即可生效，无需重启 DSH Desktop**。

## 第十五轮：npm Trusted Publishing 上线（v1.0.5 首次带 provenance 发布）（2026-10-18）

- **背景**：v1.0.4 是用 granular token（仓库 secret `NPM_TOKEN`）发的；npm 从 2027-01 起取消用 token 直接发布，那个 bypass-2FA token 也恰好在 2027-01-16 到期。`publish.yml` 因此改成 OIDC（Trusted Publishing）：workflow 声明 `id-token: write`，由 npm CLI 拿 GitHub 的 ID token 换一次性发布凭据，仓库里不再保存长期凭据。
- **硬要求（读的是 npm 文档源码与 CLI 的 `lib/utils/oidc.js`）**：npm CLI ≥ **11.5.1**、Node ≥ **22.14.0**，只支持云托管 runner；workflow 需要 `permissions: id-token: write`；npmjs.com 的 Trusted Publisher 条目里 workflow 名必须与**文件名**完全一致（`publish.yml`，大小写敏感），Allowed actions 必须放行 `npm publish`（只放行 `npm stage publish` 会挡住直发）。npm **保存配置时不校验**，错误只在发布时暴露；**新建的配置必须在 2 天内成功发布一次才生效，否则过期且需删除重建**。公开仓库 + 公开包时 provenance 自动附带，不需要 `--provenance`。
- **探针**：新增 `scripts/npm-trusted-publisher-probe.sh`，做与 CLI 完全相同的交换（`POST /-/npm/v1/oidc/token/exchange/package/<name>`，ID token 作 Bearer），只打印 HTTP 状态与 npm 的 message，绝不回显凭据；`publish.yml` 把它同时挂在 `workflow_dispatch` 的 `verify_only` 输入上（`gh workflow run publish.yml -f verify_only=true`）和真正 `npm publish` 之前，让配置错误在重建 + 测试之前就报出来。
- **两次真实结果**：npm 侧尚未配置时是 `HTTP 404: OIDC token exchange error - package not found`（说明取 token、脚本、job 都通，只差信任关系）；配置好之后是 `HTTP 201` + 一次性 token，探针绿。**探针一开始只认 HTTP 200 为成功，于是把 201 的成功回包误报成失败，失败分支还会把响应体（含那个 token）打进日志**——已改成「响应里出现 `token` 字段即成功」，且任何分支都不打印响应体（提交 69571b7）。
- **v1.0.5**：为满足 npm 的 2 天生效规则做了一次真实发布，内容是 README 新增「校验发布来源」一节。Release run 39088335645 → Publish run 39088360136（`workflow_run` 跟随）全绿，Publish 日志关键三行：`trusted publisher OK (HTTP 201): …` → `npm notice publish Signed provenance statement with source and build information from GitHub Actions` → `Provenance statement published to transparency log: https://search.sigstore.dev/?logIndex=3304255932`，最后 `published dsh-plugin-git-workbench@1.0.5`。
- **线上核对**：`dist-tags.latest = 1.0.5`（`time['1.0.5'] = 2026-10-18T01:59:26.051Z`）；`npm view dsh-plugin-git-workbench@1.0.5 dist.attestations` → `provenance.predicateType = https://slsa.dev/provenance/v1`，attestation 端点 HTTP 200 / 15,639 字节；**1.0.4 及更早没有 attestation（端点 404）**，因为那些版本是 token 发布的。Release v1.0.5 两个 asset 各 284,746 字节；从 npm 拉下来的 tarball 里 manifest 是 1.0.5、README 含新一节、`lib/*` 各文件字节数与 1.0.4 完全一致（本轮没有代码改动）。
- **收尾**：仓库里已无引用的 `NPM_TOKEN` secret 已删除（`publish.yml` 里只剩一条解释为何不用它的注释）；npm 侧的 granular token 仍需在 Access Tokens 页撤销，并把该包的 Publishing access 改成「Require two-factor authentication and disallow tokens」。
- **回归**：`npm run typecheck` 通过；`node --test tests/*.test.mjs`（配临时 `puppeteer-core` + `--test-force-exit`）= **253 条 / 252 通过 / 0 失败 / 1 跳过 / 59.0s**，`ACCEPTANCE_UI_ASSERTIONS=266`。本轮没有 `src/` 改动，运行时行为与 1.0.4 相同。

## 第十六轮截图反馈（「在编辑器中打开」浮层改成 Windows 11「打开方式」的样子）（2026-10-21）

- **现象**：用户给出两张截图。图一是 Windows 11 资源管理器的「打开方式」菜单：第一行是当前默认应用并带「（默认）」，每行只有应用图标与名称，底部一条分隔线后是「显示文件位置」。图二是插件现在的浮层：每行图标 + 名称 + 右对齐的命令名（`code` / `idea` / `webstorm` …），底部是「系统默认应用」。要求「改为图一这种」。
- **范围**：用户在两个选项里选了「只对齐样式」——保留现有探测到的编辑器清单，**不**枚举注册表里的全部打开方式应用（网盘、播放器等不会出现）；只改浮层的条目顺序、每行信息量与底部动作。
- **修法**：
  - `src/client/editor-menu.tsx`：默认动作（系统关联）移到第一行，文档图标 + 「系统默认应用」+ 右侧 12px 灰色的「（默认）」；编辑器行删掉右对齐命令小字，命令移进 `title`（悬停可见），名称独占弹性宽度并按需省略；底部改成「显示文件位置」（文件夹图标），调 `gitApi.reveal(repo, file)`，成功后提示「已在文件管理器中显示：…」，失败原样透出宿主原因。加载中/探测失败/空列表三条提示与 Escape 关闭逻辑不变。
  - `src/client/styles.ts:124-142`：`.dsh-git-editor-option` 改 `gap: 10px; padding: 9px 10px`；删掉 `.dsh-git-editor-option > span`、`> small`、`> .dsh-git-editor-mark` 三条按元素定位的规则，换成 `.dsh-git-editor-label`（`flex: 1` + 省略号）与 `.dsh-git-editor-tag`（不收缩、12px、`label-secondary`）。菜单宽度、圆角、阴影、分隔线与其余控件未动。
- **测试**：
  - `tests/editor-menu.test.mjs` 扩到 16 条：条目顺序 `系统默认应用 → 各编辑器 → 显示文件位置`、「（默认）」标签、命令出现在 `title` 而不是可见文本、底部条目走 `reveal` 且不开编辑器、宿主拒绝时把原因原样显示；图标桩补 `IconFolderTree`——**首次运行就失败在这**（`SyntaxError: The requested module './icons.js' does not provide an export named 'IconFolderTree'`），与第十四轮同一个坑：组件新增图标依赖必须同步测试桩白名单。
  - `tests/acceptance-ui.test.mjs` 的 Acceptance 10/14 同步成 5 个条目、用 `title` 断言命令、断言「（默认）」标签、marks 过滤掉「显示文件位置」；但**本机没跑**（见观察项 1）。
- **视觉自检**：`%TEMP%\dsh-editor-menu-preview\compare-light.png`、`compare-dark.png`（1520×1160，2×）。做法：esbuild 打包 HEAD 版与当前版的**真实组件**（HEAD 源码用 `git show` 喂给 esbuild `stdin` + `resolveDir` 指到 `src/client`，旧的 `styles.ts` 同样处理），各自注入对应版本的 `sheetText()` 和从宿主样式里抄出的真实主题令牌，Chrome headless 双 iframe 并排截图。实测浮层 268×275、每行 35px，首项文本「系统默认应用（默认）」，编辑器行只有图标 + 名称，末行「显示文件位置」；深浅两个主题的分隔线、（默认）标签与图标都正确。
- **观察项**：
  1. 浏览器验收在本机继续跳过：`tests/acceptance-ui.test.mjs:13-15` 要 `%LOCALAPPDATA%\Programs\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-client-ui-conversation\lib\client.js` 与 `…\lib\native-ui\assets\compatibility-chrome-*.css`，本机装的是 `DeepSeek Harness\resources\app.asar`（已确认 asar 内路径为 `dsh\node_modules\…`），全盘也搜不到任何 `compatibility-chrome*.css`；不设 `DSH_DESKTOP_APP_ROOT` 时这 10 条保持跳过，没有伪造通过。
  2. 浅色主题里 `--dsw-alias-bg-layer-1` 与 `-2` 都是 `#fff`，所以列表行悬停底色（`bg-layer-2`）在浅色下没有可见变化。这是全插件列表行的既有约定，本轮沿用未改，只记录。
  3. 相对图一，浮层保持面板里的紧凑尺寸（268px 宽、13px 字、35px 行高；Windows 原生菜单约 450px 宽、14px 字、40px 行高），过长名称用省略号截断，完整命令仍在 tooltip 里。
- **回归**：`pnpm typecheck` 通过；`pnpm build` 重出 `lib/client.js`；`pnpm test` = **269 条 / 252 通过 / 17 跳过 / 0 失败 / 46.8s**（跳过项含上面 10 条浏览器验收与本机不支持的 POSIX FIFO 用例）。本轮只改客户端，**刷新页面即可生效，无需重启 DSH Desktop**。
