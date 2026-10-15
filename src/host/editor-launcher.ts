import { execFile, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
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
  /** Starts a detached process. Must never throw for a missing binary. */
  launch?: (command: string, args: string[]) => void
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
    return hits.find(hit => /\.exe$/i.test(hit)) ?? hits[0]
  } catch {
    return undefined
  }
}

function spawnDetached(command: string, args: string[]): void {
  // A .cmd/.bat shim (code.cmd on Windows) is not executable by itself.
  const child = spawn(command, args, {
    detached: true, stdio: 'ignore', shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(command),
  })
  // Never let a missing binary take the host down; the caller already reported success
  // only after resolving the command.
  child.on('error', () => {})
  child.unref()
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
    if (target.file && UNSAFE_TARGET.test(target.file)) return { error: '文件路径包含不支持用于外部编辑器的字符' }
    const repo = resolve(target.repo)
    if (!target.file) return { absolutePath: repo, display: repo }
    const absolutePath = resolve(repo, target.file)
    const rel = relative(repo, absolutePath)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return { error: '只能打开当前仓库内的文件' }
    if (!fileExists(absolutePath)) return { error: '文件已不存在，可能已被删除或重命名' }
    return { absolutePath, display: target.file }
  }

  const editorArguments = (candidate: EditorCandidate, absolutePath: string, line?: number): string[] => {
    if (isDirectory(absolutePath)) return [absolutePath]
    if (!candidate.goto) return [line ? `${absolutePath}:${line}` : absolutePath]
    return line ? ['-g', `${absolutePath}:${line}`] : ['-g', absolutePath]
  }

  const openWithSystemDefault = (absolutePath: string): void => {
    if (platform === 'win32') launch(env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'start', '', absolutePath])
    else if (platform === 'darwin') launch('open', [absolutePath])
    else launch('xdg-open', [absolutePath])
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
        launch(command, editorArguments(candidate, absolutePath, target.line))
        return { ok: true, editor: candidate.label, target: display }
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
      openWithSystemDefault(absolutePath)
      return { ok: true, target: display }
    },
  }
}
