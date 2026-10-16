import { spawn } from 'node:child_process'

export interface GitRunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface GitRunOptions {
  /** Text piped to Git's stdin, for `git apply -` and `git commit -F -`. */
  stdin?: string
  /**
   * Kills the child after this many milliseconds. Network commands (`fetch`, `push`,
   * `pull`) get one so a dead remote cannot leave the panel spinning forever.
   */
  timeoutMs?: number
}

export interface GitRunner {
  run(argv: readonly string[], cwd: string, signal?: AbortSignal, options?: GitRunOptions): Promise<GitRunResult>
}

/**
 * Native Git runner that resolves platform-specific git executable
 */
export function createGitRunner(): GitRunner {
  const gitBin = process.platform === 'win32' ? 'git.exe' : 'git'

  return {
    run(argv: readonly string[], cwd: string, signal?: AbortSignal, options?: GitRunOptions): Promise<GitRunResult> {
      return new Promise<GitRunResult>((resolve, reject) => {
        let child: ReturnType<typeof spawn>
        const stdin = options?.stdin
        try {
          child = spawn(gitBin, argv as string[], {
            cwd,
            stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
            windowsHide: true,
            signal,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0',
              // `cherry-pick --continue` and friends open an editor. There is no terminal
              // here, so accept the prepared message instead of hanging on one.
              GIT_EDITOR: 'true',
              GIT_SEQUENCE_EDITOR: 'true',
              GIT_PAGER: 'cat',
            },
          })
        } catch (err) {
          return reject(err)
        }

        const outChunks: Buffer[] = []
        const errChunks: Buffer[] = []
        let timedOut = false
        const timer = options?.timeoutMs
          ? setTimeout(() => { timedOut = true; child.kill() }, options.timeoutMs)
          : undefined
        if (timer && typeof timer === 'object' && 'unref' in timer) timer.unref()

        // Git can reject a patch/message before consuming all of stdin. On Windows
        // the pipe reports that normal early close as `EOF` (POSIX uses `EPIPE`);
        // without a listener Node treats it as an uncaught stream error and crashes
        // the host process.
        child.stdin?.on('error', err => {
          const code = (err as NodeJS.ErrnoException).code
          if (code !== 'EPIPE' && code !== 'EOF') {
            if (timer) clearTimeout(timer)
            reject(err)
          }
        })
        if (stdin !== undefined) child.stdin?.end(stdin)

        child.stdout?.on('data', chunk => outChunks.push(Buffer.from(chunk)))
        child.stderr?.on('data', chunk => errChunks.push(Buffer.from(chunk)))

        child.on('error', err => { if (timer) clearTimeout(timer); reject(err) })
        child.on('close', code => {
          if (timer) clearTimeout(timer)
          resolve({
            stdout: Buffer.concat(outChunks).toString('utf-8'),
            stderr: timedOut
              ? `${Buffer.concat(errChunks).toString('utf-8')}\n操作超时，已中止（可能是远程不可达或需要凭据）`.trim()
              : Buffer.concat(errChunks).toString('utf-8'),
            // A signal-terminated child is never a successful Git command.
            exitCode: code ?? -1,
          })
        })
      })
    },
  }
}
