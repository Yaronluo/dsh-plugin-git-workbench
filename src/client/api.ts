import type { BranchesView, DiffView, GitGraphCommit, RepoStatus, SwitchResult, WorktreeItem } from '../core/types.js'

export function getEndpointUrl(endpoint: string): string {
  return `/dsh-git/${endpoint.replace(/^\/+/, '')}`
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Git 请求失败'
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  // Never retry mutations: a lost response does not mean Git did not execute them.
  const res = await fetch(getEndpointUrl(endpoint), {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  })
  let json: any
  try { json = await res.json() } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText || '服务器返回了无效响应'}`)
  }
  if (!res.ok || json?.ok === false) {
    const error = new Error(json?.error ? errorMessage(json.error) : `HTTP ${res.status}: ${res.statusText}`)
    if (json?.error?.code) Object.assign(error, { code: json.error.code })
    throw error
  }
  if (json === null || typeof json !== 'object') throw new Error('Git 服务器返回了无效响应')
  return json.value !== undefined ? json.value : json
}

export const gitApi = {
  getStatus(path: string, signal?: AbortSignal): Promise<RepoStatus> {
    return postJson('status', { path }, signal)
  },
  getBranches(path: string, signal?: AbortSignal): Promise<BranchesView> {
    return postJson('branches', { path }, signal)
  },
  switchBranch(path: string, branch: string): Promise<SwitchResult> {
    return postJson('switch', { path, branch })
  },
  createBranch(path: string, name: string, base?: string): Promise<SwitchResult> {
    return postJson('create-branch', { path, name, base })
  },
  getDiff(path: string, base?: string, target?: string, signal?: AbortSignal): Promise<DiffView> {
    return postJson('diff', { path, base, target }, signal)
  },
  getWorktrees(path: string, signal?: AbortSignal): Promise<WorktreeItem[]> {
    return postJson('worktrees', { path }, signal)
  },
  createWorktree(path: string, name: string, base?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    return postJson('create-worktree', { path, name, base })
  },
  removeWorktree(path: string, worktreePath: string): Promise<{ ok: boolean; error?: string }> {
    return postJson('remove-worktree', { path, worktreePath })
  },
  getLog(path: string, limit = 50, signal?: AbortSignal): Promise<GitGraphCommit[]> {
    return postJson('log', { path, limit }, signal)
  },
  subscribeEvents(path: string, onStatus: (status: RepoStatus) => void, onError?: (error: Error) => void): () => void {
    if (typeof EventSource === 'undefined') return () => {}
    let source: EventSource
    try {
      source = new EventSource(`${getEndpointUrl('events')}?path=${encodeURIComponent(path)}`)
    } catch (error) {
      onError?.(new Error(errorMessage(error)))
      return () => {}
    }
    source.addEventListener('status', (event: MessageEvent) => {
      try { onStatus(JSON.parse(event.data)) } catch (error) { onError?.(new Error(errorMessage(error))) }
    })
    source.addEventListener('status-error', (event: MessageEvent) => {
      try { onError?.(new Error(errorMessage(JSON.parse(event.data).error))) }
      catch { onError?.(new Error('Git 状态更新失败')) }
    })
    source.onerror = () => onError?.(new Error('Git 实时连接中断，正在重连'))
    return () => source.close()
  },
}
