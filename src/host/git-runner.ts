import { spawn } from 'node:child_process'

export interface GitRunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface GitRunner {
  run(argv: readonly string[], cwd: string, signal?: AbortSignal): Promise<GitRunResult>
}

/**
 * Native Git runner that resolves platform-specific git executable
 */
export function createGitRunner(): GitRunner {
  const gitBin = process.platform === 'win32' ? 'git.exe' : 'git'

  return {
    run(argv: readonly string[], cwd: string, signal?: AbortSignal): Promise<GitRunResult> {
      return new Promise<GitRunResult>((resolve, reject) => {
        let child: ReturnType<typeof spawn>
        try {
          child = spawn(gitBin, argv as string[], {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            signal,
          })
        } catch (err) {
          return reject(err)
        }

        const outChunks: Buffer[] = []
        const errChunks: Buffer[] = []

        child.stdout?.on('data', chunk => outChunks.push(Buffer.from(chunk)))
        child.stderr?.on('data', chunk => errChunks.push(Buffer.from(chunk)))

        child.on('error', err => reject(err))
        child.on('close', code => {
          resolve({
            stdout: Buffer.concat(outChunks).toString('utf-8'),
            stderr: Buffer.concat(errChunks).toString('utf-8'),
            exitCode: code ?? 0,
          })
        })
      })
    },
  }
}
