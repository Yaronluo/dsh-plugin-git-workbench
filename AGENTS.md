# DSH Git Workbench 协作规则

本文件面向所有协作者，包括接手的 AI 会话。用户当前明确要求优先于本文件；文档与实现冲突时，以源码、测试和 `package.json` 为准。

## 项目边界

- 这是面向 DeepSeek Harness 的社区开源插件，不是官方项目；它依赖宿主接口，不能当作独立网页运行。
- 两个入口：Host 是 `src/index.ts`，Client 是 `src/client/index.tsx`；构建产物在 `lib/`，随源码一起入库。
- 零运行时依赖：Host 只用 `node:*` 和 `cordis`，Client 只外部化 `react` / `react-dom`。要加依赖先问用户。

## 环境与检查

- Node.js 24.2+，pnpm 11.8.0（`packageManager` 已固定）。安装依赖用 `pnpm install --frozen-lockfile --ignore-scripts`。
- 代码改动必须过三条：`pnpm typecheck`、`pnpm test`、`pnpm build`；纯文档改动检查内容、路径和 `git diff --check` 即可。CI（[ci.yml](.github/workflows/ci.yml)）在 ubuntu 和 windows 上跑同一套，另查 bundle 语法与空白。
- 测试用 Node 内置 runner，直接加载 `src/` 里的 TS（`tests/helpers/load-ts.mjs` 借 `node:module` 钩子剥类型）。不要为了跑测试引入编译步骤、ts-node 或新依赖。
- 测试里的路径用 `join` / `resolve` 拼，不硬编码盘符和分隔符；涉及 Git 写操作的用例必须在临时仓库里跑。

## 产物与提交

- 改了 `src/` 就执行 `pnpm build`，把 `lib/index.js`、`lib/client.js`、`lib/index.d.ts` 及 map 一起提交。Release 会比对产物，不一致只给 warning，但源码安装拿到的会是陈旧包。
- 客户端 bundle 靠 `window.__ModuleLoader__.load({ id: <package.json 的 name> })` 注册；`cordis.patch.yml` 的 `name`、仓库地址和 homepage 都与包名绑定（`tests/package-identity.test.mjs` 会拦）。不要随手改包名。
- 提交信息用英文祈使句标题，≤72 字符，可带 `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:` 前缀；正文讲“为什么”和边界，不逐条复述 diff。一个提交只做一件事。
- 不提交 `node_modules/`、日志、凭据、`dist/`（`.gitignore` 已覆盖）；提交前确认没有夹带无关改动。

## 验证边界

- Host 改动要重新加载插件或重启 DSH 才生效；Client 改动 `pnpm build` 后刷新页面。不要假设热更新。
- 自动测试不等于真实宿主验收。涉及真实 DSH 的交互、主题、焦点和宿主版本差异，写进 [TESTING.md](TESTING.md) 的“需要人工完成的界面验收”，说明机器覆盖了什么、哪些边界没覆盖。
- 真实仓库的写操作（reset、丢弃文件、删储藏、删工作树）只在临时仓库里做；优先复用 `tests/` 现成的临时仓库夹具。
- 外部编辑器探测依赖 `DSH_GIT_EDITOR`、`PATH` 和 JetBrains 安装目录；测试用注入的探测函数，不依赖本机装了什么。

## 交互红线

- AI 草稿（写提交信息、审查改动、解释文件、注入 Git 上下文）只准备、填进侧边对话：**不自动发送、不自动提交、不调用模型**；失败要如实报错，不能伪装成功。
- 8 个 agent Git 工具都要求显式 `cwd`；路径必须落在目标仓库内，危险操作（丢弃、reset、删储藏、删工作树）先确认再执行。
- 日志、错误信息和草稿里不输出 token、Cookie 或完整私有补丁；示例和截图先脱敏。

## 发布

- 版本只改 `package.json`。打 `v<version>` tag 触发 [release.yml](.github/workflows/release.yml)（typecheck / test / build / 打包），随后 [publish.yml](.github/workflows/publish.yml) 用 OIDC 发布到 npm。不要本地 `npm publish`，也不要打与 `package.json` 不一致的 tag；tag 不匹配时 Release 会直接失败。
- 公开 Release 和 npm 发布都需要用户明确授权。

## 未完成任务

任务没做完就要停（例如需要在真实 DSH 里人工验收，或要换环境接续）时，在 TESTING.md 对应轮次或“需要人工完成的界面验收”里补一条：目标、已完成、待办、验证限制。不要另开一份流水账；做完就删，长期规则写回本文件。
