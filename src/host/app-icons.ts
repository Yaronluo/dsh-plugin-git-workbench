/**
 * The real application icons. Windows already knows them — every executable carries its own
 * icon as a PE resource — but Node cannot read that resource, so we ask the shell once for a
 * whole batch and hand back PNG data URLs. The picker shows exactly the icon Explorer would
 * show; on other platforms (or when the shell is unavailable) there is simply no icon and the
 * client falls back to its own mark.
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

export interface AppIcons {
  /** One entry per command, same order; `undefined` when no icon could be read. */
  lookup(commands: readonly string[]): Promise<Array<string | undefined>>
}

export interface AppIconOptions {
  platform?: NodeJS.Platform
  /** Existence check for the executable itself. */
  fileExists?: (absolutePath: string) => boolean
  /** Directory listing, reused from the launcher's cache when one is passed in. */
  listDirectory?: (absolutePath: string) => string[]
  /** Runs the extraction script; resolves with one base64 PNG per requested path ('' = failed). */
  runShell?: (script: string) => Promise<string[]>
  /** Survives between menu openings, so the shell runs at most once per executable. */
  cache?: Map<string, string>
  timeoutMs?: number
}

/**
 * A shim is not the application: `code.cmd` carries the console icon, while the product's own
 * `Code.exe` sits one directory up. Walk a couple of levels looking for an executable with the
 * same stem, and take the closest match.
 */
const SHIM_EXTENSIONS = new Set(['.cmd', '.bat', '.sh'])
const ICON_SOURCE_DEPTH = 3
const DEFAULT_TIMEOUT_MS = 8000

const stem = (name: string): string => basename(name, extname(name)).toLowerCase().replace(/\d+$/, '')

function readNamesByDefault(absolutePath: string): string[] {
  try {
    return readdirSync(absolutePath)
  } catch {
    return []
  }
}

/** The file whose icon should be shown for `command`, or `undefined` when we cannot know one. */
export function iconSource(command: string, options: Pick<AppIconOptions, 'fileExists' | 'listDirectory'> = {}): string | undefined {
  const fileExists = options.fileExists ?? existsSync
  const listDirectory = options.listDirectory ?? readNamesByDefault
  const extension = extname(command).toLowerCase()
  if (extension === '.exe') return fileExists(command) ? command : undefined
  if (!SHIM_EXTENSIONS.has(extension)) return undefined
  const wanted = stem(command)
  let directory = dirname(command)
  for (let depth = 0; depth < ICON_SOURCE_DEPTH; depth += 1) {
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
    const match = listDirectory(directory).find(name =>
      extname(name).toLowerCase() === '.exe' && stem(name) === wanted)
    if (match) return join(directory, match)
  }
  return undefined
}

/** `-EncodedCommand` keeps paths with spaces, quotes and backslashes out of every shell's hands. */
function extractionScript(paths: readonly string[]): string {
  const list = paths.map(path => `'${path.replace(/'/g, "''")}'`).join(',')
  return [
    'Add-Type -AssemblyName System.Drawing;',
    `$paths = @(${list});`,
    'foreach ($p in $paths) {',
    'try {',
    '$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($p);',
    "if ($null -eq $icon) { [Console]::Out.WriteLine(''); continue }",
    '$stream = New-Object System.IO.MemoryStream;',
    '$icon.ToBitmap().Save($stream, [System.Drawing.Imaging.ImageFormat]::Png);',
    '[Console]::Out.WriteLine([Convert]::ToBase64String($stream.ToArray()));',
    "} catch { [Console]::Out.WriteLine('') }",
    '}',
  ].join(' ')
}

function runPowerShell(script: string, timeoutMs: number): Promise<string[]> {
  return new Promise(resolve => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true })
    let output = ''
    let settled = false
    const finish = (lines: string[]): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(lines)
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* already gone */ }
      finish([])
    }, timeoutMs)
    child.stdout?.on('data', chunk => { output += String(chunk) })
    // A shell that cannot start (or is missing) is not an error the user needs to see: the
    // picker just shows its own mark instead.
    child.on('error', () => finish([]))
    child.on('close', () => finish(output.split(/\r?\n/).map(line => line.trim())))
  })
}

export function createAppIcons(options: AppIconOptions = {}): AppIcons {
  const platform = options.platform ?? process.platform
  const cache = options.cache ?? new Map<string, string>()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const runShell = options.runShell ?? ((script: string) => runPowerShell(script, timeoutMs))
  let running: Promise<unknown> = Promise.resolve()

  const extract = async (commands: readonly string[]): Promise<Array<string | undefined>> => {
    const icons = commands.map((): string | undefined => undefined)
    if (platform !== 'win32') return icons
    const pending = new Map<string, number[]>()
    commands.forEach((command, index) => {
      const source = command ? iconSource(command, options) : undefined
      if (!source) return
      const cached = cache.get(source)
      if (cached) {
        icons[index] = cached
        return
      }
      pending.set(source, [...(pending.get(source) ?? []), index])
    })
    if (pending.size === 0) return icons
    const sources = [...pending.keys()]
    const lines = await runShell(extractionScript(sources)).catch((): string[] => [])
    sources.forEach((source, index) => {
      const line = lines[index]?.trim()
      if (!line) return
      const icon = `data:image/png;base64,${line}`
      cache.set(source, icon)
      for (const target of pending.get(source) ?? []) icons[target] = icon
    })
    return icons
  }

  return {
    lookup(commands: readonly string[]): Promise<Array<string | undefined>> {
      // One batch at a time. A warmup and a menu opening ask for the same binaries, and the
      // second must read the cache the first filled instead of spawning the shell again.
      const task = running.then(() => extract(commands))
      running = task.then(() => undefined, () => undefined)
      return task
    },
  }
}
