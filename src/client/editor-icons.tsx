import React from 'react'

/**
 * Brand marks for the editors the picker can offer.
 *
 * Every other file in this folder draws its colours from the host theme, and `tests/theme.test.mjs`
 * enforces that. Brand identity is the one thing a token cannot express — "VS Code blue" is a fact
 * about the product, not a theme decision — so this module keeps the literal colours and is the
 * single file that test exempts. Editors we have no mark for still get a monogram in theme tones,
 * so an unknown editor never looks like a missing image.
 */
export interface EditorMarkSpec { initials: string; color?: string; path?: string; tone?: 'quiet' | 'outline' }

/** The official VS Code ribbon (256×254): one silhouette path stays crisp at 16px. */
const VSCODE_RIBBON = 'M180.828 252.605a15.87 15.87 0 0 0 12.65-.486l52.5-25.263a15.94 15.94 0 0 0 9.026-14.363V41.197a15.94 15.94 0 0 0-9.025-14.363L193.477 1.57a15.88 15.88 0 0 0-18.114 3.084L74.857 96.35l-43.78-33.232a10.614 10.614 0 0 0-13.56.603L3.476 76.494c-4.63 4.211-4.635 11.495-.012 15.713l37.967 34.638l-37.967 34.637c-4.623 4.219-4.618 11.502.012 15.714l14.041 12.772a10.614 10.614 0 0 0 13.56.604l43.78-33.233l100.506 91.695a15.9 15.9 0 0 0 5.465 3.571m10.464-183.65l-76.262 57.89l76.262 57.888z'

const MARKS: Record<string, EditorMarkSpec> = {
  code: { initials: 'VS', color: '#007ACC', path: VSCODE_RIBBON },
  'code-insiders': { initials: 'VI', color: '#24BFB2', path: VSCODE_RIBBON },
  cursor: { initials: 'CU', color: '#1F2937' },
  windsurf: { initials: 'WI', color: '#0FA47F' },
  zed: { initials: 'Z', color: '#084CCF' },
  subl: { initials: 'S', color: '#FF9800' },
  // JetBrains marks really are a coloured square with a two-letter monogram; these are their hues.
  idea: { initials: 'IJ', color: '#FE2858' },
  webstorm: { initials: 'WS', color: '#07C3F2' },
  pycharm: { initials: 'PC', color: '#21D789' },
  phpstorm: { initials: 'PS', color: '#B45EF6' },
  goland: { initials: 'GL', color: '#2FB4F5' },
  clion: { initials: 'CL', color: '#31D0AA' },
  rider: { initials: 'RD', color: '#F97A12' },
  datagrip: { initials: 'DG', color: '#8B6BF2' },
  rubymine: { initials: 'RM', color: '#FF4A5A' },
  studio: { initials: 'AS', color: '#3DDC84' },
}

/** The product a command refers to: folders and launcher suffixes dropped, lowercased. */
export function editorKey(command: string): string {
  const base = command.split(/[\\/]/).pop() ?? command
  return base.replace(/\.(exe|cmd|bat|sh)$/i, '').toLowerCase()
}

export function editorMark(command: string, label: string): EditorMarkSpec {
  const key = editorKey(command)
  // `idea64`/`webstorm64` are the same product as `idea`/`webstorm`.
  return MARKS[key] ?? MARKS[key.replace(/\d+$/, '')] ?? unknownMark(key, label)
}

function unknownMark(key: string, label: string): EditorMarkSpec {
  const words = label.trim().split(/\s+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase()
  let hash = 0
  for (const character of key || label) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 1000003
  return { initials: initials || '?', tone: hash % 2 === 0 ? 'quiet' : 'outline' }
}

export function EditorMark({ command, label, size = 16 }: { command: string; label: string; size?: number }) {
  const mark = editorMark(command, label)
  const box = { width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.44)) }
  if (mark.path) {
    return <svg className="dsh-git-editor-mark dsh-git-editor-mark-glyph" viewBox="0 0 256 254"
      aria-hidden="true" style={box}>
      <path d={mark.path} fill={mark.color} fillRule="evenodd" />
    </svg>
  }
  const style = mark.color ? { ...box, background: mark.color, color: '#fff' } : box
  return <span className={`dsh-git-editor-mark dsh-git-editor-mark-${mark.tone}`} aria-hidden="true" style={style}>
    {mark.initials}
  </span>
}
