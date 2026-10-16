import { createGitRunner } from './host/git-runner.js'
import { GitService } from './host/git-service.js'
import { registerRoutes } from './host/routes.js'
import { registerGitTools } from './host/agent-tools.js'

export const inject = ['webServer', 'workspaceRegistry']

export function apply(ctx: any): void {
  const runner = createGitRunner()
  const service = new GitService(runner)

  // The HTTP surface must not depend on optional agent tools being available.
  ctx.effect(() => registerRoutes(ctx, service), 'dsh-plugin-git: routes')

  // Cordis throws on undeclared service access, even with optional chaining.
  // A child injection owns the optional tools lifecycle without blocking routes.
  ctx.inject(['tools'], (toolsCtx: any) => {
    toolsCtx.effect(() => registerGitTools(toolsCtx, service), 'dsh-plugin-git: agent tools')
  })
}
