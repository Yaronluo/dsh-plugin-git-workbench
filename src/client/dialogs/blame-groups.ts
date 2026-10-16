export type GroupedBlameLine<T> = {
  line: T
  continuation: boolean
}

export function groupBlameLines<T extends { shortHash: string; uncommitted?: boolean }>(lines: readonly T[]): GroupedBlameLine<T>[] {
  let previousKey: string | null = null
  return lines.map(line => {
    const key = line.uncommitted ? 'uncommitted' : `commit:${line.shortHash}`
    const continuation = key === previousKey
    previousKey = key
    return { line, continuation }
  })
}
