import { execFile, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { isAbsolute, dirname, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

/** `execFile` is promise-aware only through `promisify`, which also types `stdout` as text. */
const execFileAsync = promisify(execFile)

/**
 * Opens the file a user is looking at in their own editor, outside the app.
 *
 * The panel is a viewer, not an IDE: the diff header offers this so a change can be
 * edited where the user already works. Nothing here is Git-specific — it only needs a
 * repository root and a path inside it.
 */
export interface EditorTarget {
  /** Repository root. The opened path must stay inside it. */
  repo: string
  /** Repository-relative file. Omitted to open the repository itself. */
  file?: string
  line?: number
}

export interface OpenInEditorResult {
  ok: boolean
  /** Human-readable editor name, when a known CLI was found. */
  editor?: string
  /** Absolute path that was opened. */
  target?: string
  error?: string
}

export interface EditorLauncher {
  open(target: EditorTarget): Promise<OpenInEditorResult>
  /** Shows the file (or the repository folder) in the platform file manager. */
  reveal(target: EditorTarget): Promise<OpenInEditorResult>
}

interface EditorCandidate {
  command: string
  label: string
  /** `true` for editors whose CLI takes `-g <file>[:line]`. */
  goto: boolean
}

/** Preference order: the editor most likely to be installed and scriptable first. */
export const EDITOR_CANDIDATES: readonly EditorCandidate[] = [
  { command: 'code', label: 'VS Code', goto: true },
  { command: 'cursor', label: 'Cursor', goto: true },
  { command: 'code-insiders', label: 'VS Code Insiders', goto: true },
  { command: 'windsurf', label: 'Windsurf', goto: true },
  { command: 'zed', label: 'Zed', goto: false },
  { command: 'subl', label: 'Sublime Text', goto: false },
]

export interface EditorLauncherOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  /** PATH lookup for a bare command name. */
  resolveCommand?: (command: string) => Promise<string | undefined>
  /** Resolves once the process starts; rejects if it cannot be launched. */
  launch?: (command: string, args: string[]) => void | Promise<void>
  fileExists?: (absolutePath: string) => boolean
  isDirectory?: (absolutePath: string) => boolean
  /**
   * DSH's own path opener (`ctx.sessionController.openWorkspacePath`). Preferred over
   * spawning a shell: the host verifies the path and already knows the OS associations.
   */
  openNatively?: (absolutePath: string) => Promise<void> | void
}

/**
 * A shell would reinterpret these in a file name, and the value reaches a command
 * line through cmd.exe on Windows. Refusing them keeps a weird file name from
 * becoming an argument.
 */
const UNSAFE_TARGET = /["'`%^&|<>()\r\n\t\0]/

async function whichCommand(command: string): Promise<string | undefined> {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const { stdout } = await execFileAsync(finder, [command], { windowsHide: true, timeout: 5000 })
    const hits = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    // `where code` also lists the extensionless shell shim; an .exe starts directly.
    return hits.find(hit => /\.exe$/i.test(hit))
      ?? (process.platform === 'win32' ? hits.find(hit => /\.(cmd|bat)$/i.test(hit)) : undefined)
      ?? hits[0]
  } catch {
    return undefined
  }
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Node joins shell arguments without quoting. Quote the shim and each argument
    // explicitly so a normal installation/repository path containing spaces works.
    const batch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)
    const child = spawn(batch ? `"${command}"` : command, batch ? args.map(arg => `"${arg}"`) : args, {
      detached: true, stdio: 'ignore', shell: batch,
    })
    child.once('error', reject)
    child.once('spawn', () => { child.unref(); resolve() })
  })
}

export function createEditorLauncher(options: EditorLauncherOptions = {}): EditorLauncher {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const resolveCommand = options.resolveCommand ?? whichCommand
  const launch = options.launch ?? spawnDetached
  const fileExists = options.fileExists ?? existsSync
  const isDirectory = options.isDirectory ?? (target => { try { return statSync(target).isDirectory() } catch { return false } })

  /** Keeps the editor inside the repository the user opened; rejects flag-like input. */
  const resolveTarget = (target: EditorTarget): { absolutePath: string; display: string } | { error: string } => {
    if (!target.repo?.trim()) return { error: '缺少仓库路径' }
    if (UNSAFE_TARGET.test(target.repo) || (target.file && UNSAFE_TARGET.test(target.file))) return { error: '文件路径包含不支持用于外部编辑器的字符' }
    const repo = resolve(target.repo)
    if (!fileExists(repo)) return { error: '仓库路径已不存在' }
    if (!target.file) return { absolutePath: repo, display: repo }
    const absolutePath = resolve(repo, target.file)
    const rel = relative(repo, absolutePath)
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return { error: '只能打开当前仓库内的文件' }
    if (!fileExists(absolutePath)) return { error: '文件已不存在，可能已被删除或重命名' }
    return { absolutePath, display: target.file }
  }

  const editorArguments = (candidate: EditorCandidate, absolutePath: string, line?: number): string[] => {
    if (isDirectory(absolutePath)) return [absolutePath]
    if (!candidate.goto) return [line ? `${absolutePath}:${line}` : absolutePath]
    return line ? ['-g', `${absolutePath}:${line}`] : ['-g', absolutePath]
  }

  const openWithSystemDefault = async (absolutePath: string): Promise<void> => {
    if (platform === 'win32') await launch(env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'start', '', absolutePath])
    else if (platform === 'darwin') await launch('open', [absolutePath])
    else await launch('xdg-open', [absolutePath])
  }

  return {
    async open(target: EditorTarget): Promise<OpenInEditorResult> {
      const resolved = resolveTarget(target)
      if ('error' in resolved) return { ok: false, error: resolved.error }
      const { absolutePath, display } = resolved

      // An explicit override wins over detection, so a user with an unusual editor is
      // never stuck with the built-in candidate list.
      const override = env.DSH_GIT_EDITOR?.trim()
      const candidates: EditorCandidate[] = override
        ? [{ command: override, label: override, goto: false }]
        : [...EDITOR_CANDIDATES]

      for (const candidate of candidates) {
        const command = await resolveCommand(candidate.command)
        if (!command) continue
        try {
          await launch(command, editorArguments(candidate, absolutePath, target.line))
          return { ok: true, editor: candidate.label, target: display }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : '无法启动编辑器' }
        }
      }

      // No known editor CLI: prefer DSH's own opener, then the platform shell, so a click
      // on a machine with an exotic editor still opens something.
      if (options.openNatively) {
        try {
          await options.openNatively(absolutePath)
          return { ok: true, target: display }
        } catch {
          // The host refused (no desktop, or a path it cannot map); the shell may still work.
        }
      }
      try {
        await openWithSystemDefault(absolutePath)
        return { ok: true, target: display }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '无法打开默认应用' }
      }
    },

    /**
     * "Show in file manager" is a different intent from "open": the user wants the
     * surrounding folder, and on Windows even a successful `explorer` exits non-zero,
     * so the exit code is deliberately never inspected here.
     */
    async reveal(target: EditorTarget): Promise<OpenInEditorResult> {
      const resolved = resolveTarget(target)
      if ('error' in resolved) return { ok: false, error: resolved.error }
      const { absolutePath, display } = resolved
      const isFile = Boolean(target.file) && !isDirectory(absolutePath)
      try {
        if (platform === 'win32') await launch('explorer.exe', [isFile ? `/select,${absolutePath}` : absolutePath])
        else if (platform === 'darwin') await launch('open', isFile ? ['-R', absolutePath] : [absolutePath])
        else await launch('xdg-open', [isFile ? dirname(absolutePath) : absolutePath])
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '无法打开文件管理器' }
      }
      return { ok: true, target: display }
    },
  }
}
