import { createGitRunner } from './host/git-runner.js'
import { GitService } from './host/git-service.js'
import { registerRoutes } from './host/routes.js'

export const inject = ['webServer', 'workspaceRegistry']

export function apply(ctx: any): void {
  const runner = createGitRunner()
  const service = new GitService(runner)

  let disposeRoutes: (() => void) | undefined

  ctx.effect(() => {
    disposeRoutes = registerRoutes(ctx, service)
    return () => {
      disposeRoutes?.()
    }
  }, 'dsh-plugin-git: routes')
}
