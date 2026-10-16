# 参与贡献

感谢你帮助改进 DSH Git Workbench！这是面向 DeepSeek Harness 的社区项目。

## 报告问题

请在 GitHub Issues 中提供：

- DSH、操作系统、Node.js（如相关）和 Git 版本；
- 安装方式、复现步骤、预期行为与实际行为；
- 脱敏后的日志、截图或最小复现仓库。

不要上传 token、凭据、完整私有代码或不必要的个人信息。安全漏洞请使用 [私密报告渠道](SECURITY.md)，不要直接创建公开 Issue。

## 本地开发

需要 Git、Node.js 24.2+ 和 pnpm 11。

```bash
git clone https://github.com/Yaronluo/dsh-plugin-git.git
cd dsh-plugin-git
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm build
```

插件需要 DSH 宿主，不能通过启动独立 Vite 服务代替真实集成。安装方法见 [README](README.md#安装)。修改 Host 后需要重新加载插件或重启 DSH；修改 Client 后先构建再刷新验证。

## 提交 Pull Request

1. Fork 仓库，创建主题分支；保持每个 PR 聚焦一个问题。
2. 修改源码并为行为变化补充测试，尤其关注仓库 / 会话隔离、路径与参数校验、请求竞态和草稿安全。
3. 运行类型检查、测试和构建，说明跳过测试的原因。浏览器与真实宿主测试需要额外本机环境，参见 [测试记录](TESTING.md)。
4. 本仓库跟踪 `lib/` 构建产物；源码变更后请一起提交对应产物，不要提交 `node_modules/` 或本地凭据。
5. 在 PR 中说明动机、变化、测试命令与已知限制。界面变化欢迎附脱敏截图。

所有写入型 Git 回归应使用独立临时仓库；不要在贡献者的真实工作仓库测试 reset、文件丢弃、工作树删除等操作。AI 草稿动作不得自动发送，错误不得伪装为成功。

提交贡献即表示你有权提交相关内容，并同意贡献按本项目 [MIT 许可证](LICENSE) 分发。请保持友善、尊重不同经验背景的贡献者。
