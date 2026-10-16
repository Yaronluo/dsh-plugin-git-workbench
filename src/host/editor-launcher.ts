import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, dirname, join, relative, resolve, sep } from 'node:path'
import type { EditorChoice } from '../core/types.js'
import { createAppIcons, type AppIcons } from './app-icons.js'

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
  /**
   * Opens the target. `editor` is the picker's choice: a command from `listEditors()`,
   * or `SYSTEM_EDITOR` for the OS default application.
   */
  open(target: EditorTarget, editor?: string): Promise<OpenInEditorResult>
  /** Editors whose CLI was actually found on this machine, in preference order. */
  listEditors(): Promise<EditorChoice[]>
  /** Shows the file (or the repository folder) in the platform file manager. */
  reveal(target: EditorTarget): Promise<OpenInEditorResult>
}

/**
 * The picker's "let the OS decide" entry. It is deliberately not an editor command:
 * an explicit choice of it skips detection entirely, so a stale candidate list cannot
 * hijack a click that asked for the system default.
 */
export const SYSTEM_EDITOR = 'system'

/**
 * How a CLI takes the file and, when it supports one, the line. Three families are common
 * enough to name: VS Code's `-g <file>:<line>`, the bare `<file>:<line>` suffix Zed and
 * Sublime accept, and JetBrains' `--line <n> <file>`.
 */
type EditorArgumentStyle = 'goto' | 'colon' | 'jetbrains' | 'plain'

/**
 * Some products live at a version-dependent path — `Programs/IntelliJ IDEA/bin/idea64.exe`,
 * Toolbox's `apps/<product>/<channel>/<build>/bin`, plus whatever the next release is called —
 * so they are found by walking a root rather than by listing every version.
 */
interface EditorDiscovery {
  /**
   * Install roots that *contain* product folders, never a product itself. Each root carries
   * only the patterns that can actually occur below it — a deep wildcard is cheap under
   * Toolbox's fixed nesting and ruinous under a folder full of unrelated applications.
   */
  locations: Partial<Record<NodeJS.Platform, readonly EditorLocation[]>>
}

interface EditorLocation {
  /** Install root. `%NAME%` expands from the environment, a leading `~` from the home directory. */
  root: string
  /** `/`-separated paths below the root. `*` matches exactly one directory level. */
  patterns: readonly string[]
}

interface EditorCandidate {
  command: string
  label: string
  /** `true` for editors whose CLI takes `-g <file>[:line]`. */
  goto: boolean
  /** Overrides `goto` when the CLI takes the file and line some other way. */
  style?: EditorArgumentStyle
  /**
   * Install locations to try when the command is not on PATH. A GUI installer is free to
   * skip the "add to PATH" step — the VS Code user installer does by default — and a
   * PATH-only probe then claims there is no editor on a machine that plainly has one.
   * `%NAME%` expands from the environment, a leading `~` from the home directory.
   */
  paths?: Partial<Record<NodeJS.Platform, readonly string[]>>
  /** Version-dependent installs, searched when neither PATH nor `paths` matched. */
  discovery?: EditorDiscovery
  /**
   * Extra launcher names this product answers to, so a `DSH_GIT_EDITOR` pointing at the
   * real binary (`…/bin/idea64.exe`) still gets that product's line-number syntax.
   */
  aliases?: readonly string[]
}

interface JetBrainsProduct {
  label: string
  /** Command-line launcher name, which is what PATH and the picker use. */
  command: string
  winBinary: string
  macApps: readonly string[]
  linuxScript: string
}

/** Every JetBrains IDE shares the launcher layout, so one table covers the family. */
const JETBRAINS_PRODUCTS: readonly JetBrainsProduct[] = [
  { label: 'IntelliJ IDEA', command: 'idea', winBinary: 'idea64.exe', linuxScript: 'idea.sh', macApps: ['IntelliJ IDEA.app', 'IntelliJ IDEA Ultimate.app', 'IntelliJ IDEA Community Edition.app'] },
  { label: 'WebStorm', command: 'webstorm', winBinary: 'webstorm64.exe', linuxScript: 'webstorm.sh', macApps: ['WebStorm.app'] },
  { label: 'PyCharm', command: 'pycharm', winBinary: 'pycharm64.exe', linuxScript: 'pycharm.sh', macApps: ['PyCharm.app', 'PyCharm Professional Edition.app', 'PyCharm Community Edition.app'] },
  { label: 'PhpStorm', command: 'phpstorm', winBinary: 'phpstorm64.exe', linuxScript: 'phpstorm.sh', macApps: ['PhpStorm.app'] },
  { label: 'GoLand', command: 'goland', winBinary: 'goland64.exe', linuxScript: 'goland.sh', macApps: ['GoLand.app'] },
  { label: 'CLion', command: 'clion', winBinary: 'clion64.exe', linuxScript: 'clion.sh', macApps: ['CLion.app'] },
  { label: 'Rider', command: 'rider', winBinary: 'rider64.exe', linuxScript: 'rider.sh', macApps: ['Rider.app'] },
  { label: 'DataGrip', command: 'datagrip', winBinary: 'datagrip64.exe', linuxScript: 'datagrip.sh', macApps: ['DataGrip.app'] },
  { label: 'RubyMine', command: 'rubymine', winBinary: 'rubymine64.exe', linuxScript: 'rubymine.sh', macApps: ['RubyMine.app'] },
  { label: 'Android Studio', command: 'studio', winBinary: 'studio64.exe', linuxScript: 'studio.sh', macApps: ['Android Studio.app'] },
]

/**
 * Where a JetBrains IDE can live. The folder names are versionless but the nesting differs
 * per install kind, so each root gets exactly the patterns that fit it.
 */
const jetbrainsLocations = (product: JetBrainsProduct): EditorDiscovery['locations'] => ({
  win32: [
    // Standalone and zip installs: `%LOCALAPPDATA%\Programs\IntelliJ IDEA\bin\idea64.exe`.
    { root: '%LOCALAPPDATA%\\Programs', patterns: [`*/bin/${product.winBinary}`] },
    // Toolbox: `apps/<product>/<channel>/<build>/bin/idea64.exe`.
    { root: '%LOCALAPPDATA%\\JetBrains\\Toolbox\\apps', patterns: [`*/*/*/bin/${product.winBinary}`] },
    { root: '%ProgramFiles%\\JetBrains', patterns: [`*/bin/${product.winBinary}`] },
    { root: '%ProgramFiles%\\Android', patterns: [`Android Studio/bin/${product.winBinary}`] },
  ],
  darwin: ['/Applications', '~/Applications'].map(root => ({
    root,
    patterns: product.macApps.map(app => `${app}/Contents/MacOS/${product.command}`),
  })),
  linux: [
    { root: '~/.local/share/JetBrains/Toolbox/apps', patterns: [`*/*/*/bin/${product.linuxScript}`] },
    { root: '/opt', patterns: [`*/bin/${product.linuxScript}`] },
  ],
})

const JETBRAINS_EDITORS: readonly EditorCandidate[] = JETBRAINS_PRODUCTS.map(product => ({
  command: product.command,
  label: product.label,
  goto: false,
  style: 'jetbrains',
  aliases: [product.winBinary.replace(/\.exe$/i, '')],
  paths: { linux: [`/usr/bin/${product.command}`, `~/.local/bin/${product.command}`, `/snap/bin/${product.command}`] },
  discovery: { locations: jetbrainsLocations(product) },
}))

/** Preference order: the editor most likely to be installed and scriptable first. */
export const EDITOR_CANDIDATES: readonly EditorCandidate[] = [
  {
    command: 'code', label: 'VS Code', goto: true,
    paths: {
      win32: [
        '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\bin\\code.cmd',
        '%ProgramFiles%\\Microsoft VS Code\\bin\\code.cmd',
        '%ProgramFiles(x86)%\\Microsoft VS Code\\bin\\code.cmd',
      ],
      darwin: [
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
        '~/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      ],
      linux: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code', '~/.local/bin/code'],
    },
  },
  {
    command: 'cursor', label: 'Cursor', goto: true,
    paths: {
      win32: [
        '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd',
        '%ProgramFiles%\\Cursor\\resources\\app\\bin\\cursor.cmd',
      ],
      darwin: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
      linux: ['/usr/bin/cursor', '/usr/local/bin/cursor', '~/.local/bin/cursor'],
    },
  },
  {
    command: 'code-insiders', label: 'VS Code Insiders', goto: true,
    paths: {
      win32: [
        '%LOCALAPPDATA%\\Programs\\Microsoft VS Code Insiders\\bin\\code-insiders.cmd',
        '%ProgramFiles%\\Microsoft VS Code Insiders\\bin\\code-insiders.cmd',
      ],
      darwin: ['/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders'],
      linux: ['/usr/bin/code-insiders', '~/.local/bin/code-insiders'],
    },
  },
  {
    command: 'windsurf', label: 'Windsurf', goto: true,
    paths: {
      win32: [
        '%LOCALAPPDATA%\\Programs\\Windsurf\\bin\\windsurf.cmd',
        '%ProgramFiles%\\Windsurf\\bin\\windsurf.cmd',
      ],
      darwin: ['/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf'],
      linux: ['/usr/bin/windsurf', '~/.local/bin/windsurf'],
    },
  },
  {
    command: 'zed', label: 'Zed', goto: false,
    paths: {
      win32: ['%LOCALAPPDATA%\\Programs\\Zed\\zed.exe', '%ProgramFiles%\\Zed\\zed.exe'],
      darwin: ['/Applications/Zed.app/Contents/MacOS/cli'],
      linux: ['/usr/bin/zed', '/usr/bin/zeditor', '~/.local/bin/zed'],
    },
  },
  {
    command: 'subl', label: 'Sublime Text', goto: false,
    paths: {
      win32: [
        '%ProgramFiles%\\Sublime Text\\subl.exe',
        '%ProgramFiles%\\Sublime Text 3\\subl.exe',
        '%LOCALAPPDATA%\\Programs\\Sublime Text\\subl.exe',
      ],
      darwin: ['/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl'],
      linux: ['/usr/bin/subl', '/opt/sublime_text/sublime_text'],
    },
  },
  ...JETBRAINS_EDITORS,
]

export interface EditorLauncherOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  /** PATH lookup for a bare command name. */
  resolveCommand?: (command: string) => Promise<string | undefined>
  /** Existence check for the candidate install locations below (never for the target file). */
  pathExists?: (absolutePath: string) => boolean
  /** Names inside a directory, used to walk the version-dependent install roots. */
  listDirectory?: (absolutePath: string) => string[]
  /** Resolves once the process starts; rejects if it cannot be launched. */
  launch?: (command: string, args: string[]) => void | Promise<void>
  fileExists?: (absolutePath: string) => boolean
  isDirectory?: (absolutePath: string) => boolean
  /**
   * DSH's own path opener (`ctx.sessionController.openWorkspacePath`). Preferred over
   * spawning a shell: the host verifies the path and already knows the OS associations.
   */
  openNatively?: (absolutePath: string) => Promise<void> | void
  /** Reads each application's real icon; injectable so listing stays testable off-Windows. */
  appIcons?: AppIcons
}

/**
 * A shell would reinterpret these in a file name, and the value reaches a command
 * line through cmd.exe on Windows. Refusing them keeps a weird file name from
 * becoming an argument.
 */
const UNSAFE_TARGET = /["'`%^&|<>()\r\n\t\0]/

export interface PathLookupOptions {
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  /** Directory listing, injectable so the lookup is testable without touching the disk. */
  listDirectory?: (absolutePath: string) => string[]
  /** Executable-bit check, used only where the bit is what makes a file runnable. */
  isExecutable?: (absolutePath: string) => boolean
}

function readNamesByDefault(absolutePath: string): string[] {
  try {
    return readdirSync(absolutePath)
  } catch {
    return []
  }
}

function runnableByDefault(absolutePath: string): boolean {
  try {
    accessSync(absolutePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function pathDirectories(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const value = env.PATH ?? env.Path ?? env.path ?? ''
  return value
    .split(platform === 'win32' ? ';' : ':')
    .map(entry => entry.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean)
}

/**
 * `where` / `which` as a directory listing.
 *
 * Spawning the platform finder costs ~150 ms per candidate, and the picker asks about every
 * editor it knows — that is the difference between a menu that opens and one that stalls on
 * "正在检测…". Reading each PATH directory once answers all of them, and the probe order is
 * explicit: a real executable beats a batch shim, and within one kind the earlier PATH entry
 * wins, so a user shim is never shadowed by a later installation.
 */
export function findOnPath(command: string, options: PathLookupOptions): string | undefined {
  if (/[\\/]/.test(command)) return undefined
  const directories = pathDirectories(options.env, options.platform)
  const list = options.listDirectory ?? readNamesByDefault
  const runnable = options.platform === 'win32' ? () => true : options.isExecutable ?? runnableByDefault
  const suffixes = options.platform !== 'win32' || /\.[^\\/]+$/.test(command)
    ? ['']
    : [...new Set(['.exe', '.cmd', '.bat',
      ...(options.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map(entry => entry.toLowerCase()),
      ''])]
  for (const suffix of suffixes) {
    const wanted = `${command}${suffix}`
    for (const directory of directories) {
      const hit = list(directory).find(name => options.platform === 'win32'
        ? name.toLowerCase() === wanted.toLowerCase()
        : name === wanted)
      if (!hit) continue
      const candidate = join(directory, hit)
      if (runnable(candidate)) return candidate
    }
  }
  return undefined
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
  const resolveCommand = options.resolveCommand ?? ((command: string) =>
    Promise.resolve(findOnPath(command, { env, platform, listDirectory })))
  const pathExists = options.pathExists ?? existsSync
  const readDirectory = options.listDirectory ?? ((directory: string): string[] => {
    try {
      // Newest first: install folders carry a version, and the current one is the better guess.
      return readdirSync(directory).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    } catch {
      return []
    }
  })
  // Several candidates walk the same roots (`Programs`, Toolbox, `/Applications`); without
  // this the same directory is read once per product, which is what made the menu slow.
  const listings = new Map<string, string[]>()
  const listDirectory = (directory: string): string[] => {
    const cached = listings.get(directory)
    if (cached) return cached
    const names = readDirectory(directory)
    listings.set(directory, names)
    return names
  }
  const launch = options.launch ?? spawnDetached
  const fileExists = options.fileExists ?? existsSync
  const isDirectory = options.isDirectory ?? (target => { try { return statSync(target).isDirectory() } catch { return false } })
  const appIcons = options.appIcons ?? createAppIcons({ platform, fileExists, listDirectory })

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

  /** `goto` is the documented boolean; `style` names the family that spells it differently. */
  const argumentStyle = (candidate: EditorCandidate): EditorArgumentStyle =>
    candidate.style ?? (candidate.goto ? 'goto' : 'colon')

  const editorArguments = (candidate: EditorCandidate, absolutePath: string, line?: number): string[] => {
    if (isDirectory(absolutePath)) return [absolutePath]
    switch (argumentStyle(candidate)) {
      case 'goto': return line ? ['-g', `${absolutePath}:${line}`] : ['-g', absolutePath]
      case 'jetbrains': return line ? ['--line', String(line), absolutePath] : [absolutePath]
      case 'plain': return [absolutePath]
      default: return [line ? `${absolutePath}:${line}` : absolutePath]
    }
  }

  const openWithSystemDefault = async (absolutePath: string): Promise<void> => {
    if (platform === 'win32') await launch(env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'start', '', absolutePath])
    else if (platform === 'darwin') await launch('open', [absolutePath])
    else await launch('xdg-open', [absolutePath])
  }

  /** No known editor CLI: prefer DSH's own opener, then the platform shell, so a click on a machine with an exotic editor still opens something. */
  const openWithoutEditor = async (absolutePath: string, display: string): Promise<OpenInEditorResult> => {
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
  }

  // An explicit override wins over detection, so a user with an unusual editor is never
  // stuck with the built-in candidate list. A path to a known product keeps that product's
  // line-number syntax (and its install locations); anything else gets `file:line`.
  const detectedCandidates = (): EditorCandidate[] => {
    const override = env.DSH_GIT_EDITOR?.trim()
    if (!override) return [...EDITOR_CANDIDATES]
    const fallback: EditorCandidate = { command: override, label: override, goto: false, style: 'colon' }
    const base = override.split(/[\\/]/).pop()?.replace(/\.(exe|cmd|bat|sh)$/i, '').toLowerCase()
    const known = base
      ? EDITOR_CANDIDATES.find(candidate => [candidate.command, ...(candidate.aliases ?? [])]
        .some(name => name.toLowerCase() === base))
      : undefined
    return [known ? { ...known, command: override, label: override } : fallback]
  }

  /** Expands `%NAME%` and a leading `~`; an unresolved placeholder cannot name a real file. */
  const expandKnownPath = (template: string): string | undefined => {
    const expanded = template.replace(/%([^%]+)%/g, (match, name: string) => env[name] ?? env[name.toUpperCase()] ?? match)
    const home = env.USERPROFILE ?? env.HOME
    const absolute = expanded.startsWith('~') && home ? `${home}${expanded.slice(1)}` : expanded
    return absolute.includes('%') ? undefined : absolute
  }

  /**
   * Walks one install root for a `/`-separated pattern. `*` matches a single directory
   * level, so one pattern covers `Programs/IntelliJ IDEA/bin/idea64.exe` and another
   * covers Toolbox's `apps/<product>/<channel>/<build>/bin/idea64.exe`.
   */
  const searchPattern = (directory: string, segments: readonly string[]): string | undefined => {
    const [head, ...rest] = segments
    if (!head) return undefined
    if (head === '*') {
      for (const name of listDirectory(directory)) {
        const found = searchPattern(join(directory, name), rest)
        if (found) return found
      }
      return undefined
    }
    const candidate = join(directory, head)
    if (rest.length === 0) return pathExists(candidate) ? candidate : undefined
    return searchPattern(candidate, rest)
  }

  /** Version-dependent installs: no fixed path can name the next release's folder. */
  const discover = (candidate: EditorCandidate): string | undefined => {
    for (const location of candidate.discovery?.locations[platform] ?? []) {
      const root = expandKnownPath(location.root)
      if (!root) continue
      for (const pattern of location.patterns) {
        const found = searchPattern(root, pattern.split('/'))
        if (found) return found
      }
    }
    return undefined
  }

  /**
   * Where a candidate actually lives: PATH first, then its well-known install locations,
   * then the version-dependent roots. A value that is already a path (an override pointing
   * straight at a binary) is taken as-is, which is also how a user pins an editor the
   * installer never exposed.
   */
  const locate = async (candidate: EditorCandidate): Promise<string | undefined> => {
    if (/[\\/]/.test(candidate.command) && pathExists(candidate.command)) return candidate.command
    const onPath = await resolveCommand(candidate.command)
    if (onPath) return onPath
    for (const template of candidate.paths?.[platform] ?? []) {
      const absolute = expandKnownPath(template)
      if (absolute && pathExists(absolute)) return absolute
    }
    return discover(candidate)
  }

  /**
   * Every candidate this machine can really launch, in preference order. The lookups are
   * independent, so they run together: probing sixteen editors one after another is what
   * made the menu sit on "正在检测…".
   */
  const detect = async (): Promise<Array<{ candidate: EditorCandidate; command: string }>> => {
    const candidates = detectedCandidates()
    const located = await Promise.all(candidates.map(async candidate => ({ candidate, command: await locate(candidate) })))
    return located.filter((entry): entry is { candidate: EditorCandidate; command: string } => Boolean(entry.command))
  }

  /**
   * Reading the real application icons spawns the shell once (~0.7s). Nothing is waiting for
   * it here, so warm the cache while the user is still doing something else and the picker
   * opens with its icons already in hand. Only the default reader warms up: an injected one
   * belongs to the caller, which also keeps tests free of shells.
   */
  if (!options.appIcons) {
    void detect()
      .then(entries => appIcons.lookup(entries.map(entry => entry.command)))
      .catch(() => undefined)
  }

  return {
    async open(target: EditorTarget, editor?: string): Promise<OpenInEditorResult> {
      const resolved = resolveTarget(target)
      if ('error' in resolved) return { ok: false, error: resolved.error }
      const { absolutePath, display } = resolved

      const start = async (candidate: EditorCandidate, command: string): Promise<OpenInEditorResult> => {
        try {
          await launch(command, editorArguments(candidate, absolutePath, target.line))
          return { ok: true, editor: candidate.label, target: display }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : '无法启动编辑器' }
        }
      }

      // The picker asked for the OS association: probe nothing, so the entry keeps meaning
      // what it says even on a machine where an editor CLI is installed.
      const requested = editor?.trim()
      if (requested === SYSTEM_EDITOR) return openWithoutEditor(absolutePath, display)

      if (requested) {
        // An explicit choice is a promise: only that editor is tried, and a missing one is
        // reported instead of silently opening a different editor.
        const candidate = detectedCandidates().find(entry => entry.command === requested)
        if (!candidate) {
          const override = env.DSH_GIT_EDITOR?.trim()
          return { ok: false, error: override
            ? `已配置 DSH_GIT_EDITOR=${override}，只能用它打开，不能改用 ${requested}`
            : `找不到编辑器：${requested}` }
        }
        const command = await locate(candidate)
        if (!command) return { ok: false, error: `找不到编辑器：${candidate.label}（命令不在 PATH 中，也不在常见安装位置）` }
        return start(candidate, command)
      }

      const first = (await detect())[0]
      return first ? start(first.candidate, first.command) : openWithoutEditor(absolutePath, display)
    },

    /** What the picker offers: only the editors this machine has, in the documented order. */
    async listEditors(): Promise<EditorChoice[]> {
      const found: Array<{ entry: Omit<EditorChoice, 'icon'>; binary: string }> = []
      const seen = new Set<string>()
      for (const { candidate, command } of await detect()) {
        // One product can be installed twice (standalone plus Toolbox); list it once.
        if (seen.has(command.toLowerCase())) continue
        seen.add(command.toLowerCase())
        found.push({ entry: { command: candidate.command, label: candidate.label, goto: candidate.goto }, binary: command })
      }
      // The real application icons come from the installed binaries — not from the bare command
      // name, which is only what we hand back to `open`. A failure here costs the mark, never
      // the entry.
      const icons = await appIcons.lookup(found.map(item => item.binary))
      return found.map((item, index) => (icons[index] ? { ...item.entry, icon: icons[index] } : item.entry))
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
