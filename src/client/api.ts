import type {
  BranchesView,
  DiffView,
  GitGraphCommit,
  RepoStatus,
  SwitchResult,
  WorktreeItem,
} from '../core/types.js'

function getEndpointUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.replace(/^\/+/, '')
  // Document-relative to work across sub-paths and electron custom schemes
  return `dsh-git/${cleanEndpoint}`
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const url = getEndpointUrl(endpoint)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    // Fallback to root-relative if document-relative failed
    res = await fetch(`/${getEndpointUrl(endpoint)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const json = await res.json()
  if (!json.ok && json.error && !json.code) {
    throw new Error(json.error)
  }
  return json.value !== undefined ? json.value : json
}

export const gitApi = {
  async getStatus(path: string): Promise<RepoStatus> {
    return postJson<RepoStatus>('status', { path })
  },

  async getBranches(path: string): Promise<BranchesView> {
    return postJson<BranchesView>('branches', { path })
  },

  async switchBranch(path: string, branch: string): Promise<SwitchResult> {
    return postJson<SwitchResult>('switch', { path, branch })
  },

  async createBranch(path: string, name: string, base?: string): Promise<SwitchResult> {
    return postJson<SwitchResult>('create-branch', { path, name, base })
  },

  async getDiff(path: string, base?: string, target?: string): Promise<DiffView> {
    return postJson<DiffView>('diff', { path, base, target })
  },

  async getWorktrees(path: string): Promise<WorktreeItem[]> {
    return postJson<WorktreeItem[]>('worktrees', { path })
  },

  async createWorktree(path: string, name: string, base?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    return postJson('create-worktree', { path, name, base })
  },

  async removeWorktree(path: string, worktreePath: string): Promise<{ ok: boolean; error?: string }> {
    return postJson('remove-worktree', { path, worktreePath })
  },

  async getLog(path: string, limit: number = 50): Promise<GitGraphCommit[]> {
    return postJson<GitGraphCommit[]>('log', { path, limit })
  },

  subscribeEvents(path: string, onStatus: (status: RepoStatus) => void): () => void {
    if (typeof EventSource === 'undefined') return () => {}

    const url = `${getEndpointUrl('events')}?path=${encodeURIComponent(path)}`
    let source: EventSource
    try {
      source = new EventSource(url)
    } catch {
      source = new EventSource(`/${url}`)
    }

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
