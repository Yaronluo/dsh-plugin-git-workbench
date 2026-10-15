import type {
  BranchesView,
  DiffView,
  GitGraphCommit,
  RepoStatus,
  SwitchResult,
  WorktreeItem,
} from '../core/types.js'

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok && json.error && !json.code) {
    throw new Error(json.error)
  }
  return json.value !== undefined ? json.value : json
}

export const gitApi = {
  async getStatus(path: string): Promise<RepoStatus> {
    return postJson<RepoStatus>('/dsh-git/status', { path })
  },

  async getBranches(path: string): Promise<BranchesView> {
    return postJson<BranchesView>('/dsh-git/branches', { path })
  },

  async switchBranch(path: string, branch: string): Promise<SwitchResult> {
    return postJson<SwitchResult>('/dsh-git/switch', { path, branch })
  },

  async createBranch(path: string, name: string, base?: string): Promise<SwitchResult> {
    return postJson<SwitchResult>('/dsh-git/create-branch', { path, name, base })
  },

  async getDiff(path: string, base?: string, target?: string): Promise<DiffView> {
    return postJson<DiffView>('/dsh-git/diff', { path, base, target })
  },

  async getWorktrees(path: string): Promise<WorktreeItem[]> {
    return postJson<WorktreeItem[]>('/dsh-git/worktrees', { path })
  },

  async createWorktree(path: string, name: string, base?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    return postJson('/dsh-git/create-worktree', { path, name, base })
  },

  async removeWorktree(path: string, worktreePath: string): Promise<{ ok: boolean; error?: string }> {
    return postJson('/dsh-git/remove-worktree', { path, worktreePath })
  },

  async getLog(path: string, limit: number = 50): Promise<GitGraphCommit[]> {
    return postJson<GitGraphCommit[]>('/dsh-git/log', { path, limit })
  },

  subscribeEvents(path: string, onStatus: (status: RepoStatus) => void): () => void {
    if (typeof EventSource === 'undefined') return () => {}

    const source = new EventSource(`/dsh-git/events?path=${encodeURIComponent(path)}`)
    source.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        onStatus(data)
      } catch {
        // ignore parse error
      }
    })

    return () => {
      source.close()
    }
  },
}
