import React from 'react'

export interface IconProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/** Shared geometry keeps small menu icons visually consistent. */
function Icon({ size = 14, className = '', style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function IconBranch(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 7v10M6 14h5a7 7 0 0 0 7-7" />
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
    </Icon>
  )
}

export function IconBranchPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 7v10M6 15h4a6 6 0 0 0 6-6M17 4h4M19 2v4" />
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="16" cy="7" r="2" />
    </Icon>
  )
}

export function IconChevronDown({ size = 12, ...props }: IconProps) {
  return <Icon size={size} {...props}><path d="m7 10 5 5 5-5" /></Icon>
}

export function IconChevronRight({ size = 12, ...props }: IconProps) {
  return <Icon size={size} {...props}><path d="m10 7 5 5-5 5" /></Icon>
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.1 15.1 4.9 4.9" />
    </Icon>
  )
}

export function IconCheck(props: IconProps) {
  return <Icon {...props}><path d="m5 12 4.5 4.5L19 7" /></Icon>
}

export function IconDiff(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 3v18M7.5 8v6M5 11h5M15 11h3" />
    </Icon>
  )
}

export function IconFile(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />
    </Icon>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10a8 8 0 0 1 13.7-3.7L20 9M20 4v5h-5M20 14a8 8 0 0 1-13.7 3.7L4 15M4 20v-5h5" />
    </Icon>
  )
}

export function IconClose(props: IconProps) {
  return <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6M12 7v5l3 2" />
    </Icon>
  )
}

/** Backwards-compatible name for the Git history menu icon. */
export function IconGraph(props: IconProps) {
  return <IconHistory {...props} />
}

export function IconFolderTree(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M8 12.5v3M8 15h5.5a2.5 2.5 0 0 0 2.5-2.5" />
      <circle cx="8" cy="11" r="1.5" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="11" r="1.5" />
    </Icon>
  )
}

/** Backwards-compatible name for the folder/git-fork menu icon. */
export function IconWorktree(props: IconProps) {
  return <IconFolderTree {...props} />
}

/** Opens content outside the app (external editor / system application). */
export function IconExternalLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4h6v6M20 4l-8.5 8.5M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" />
    </Icon>
  )
}

export function IconChevronUp({ size = 12, ...props }: IconProps) {
  return <Icon size={size} {...props}><path d="m7 14 5-5 5 5" /></Icon>
}

/** Adds the hovered path to the index. */
export function IconPlus(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
}

/** Removes the hovered path from the index. */
export function IconMinus(props: IconProps) {
  return <Icon {...props}><path d="M5 12h14" /></Icon>
}

/** Throws away working tree changes. */
export function IconUndo(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H10" />
    </Icon>
  )
}

export function IconCommit(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h6M15 12h6" />
      <circle cx="12" cy="12" r="3.2" />
    </Icon>
  )
}

export function IconStash(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />
    </Icon>
  )
}

export function IconTag(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.4 12.4 13 19.8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1-.6-1.7L4.2 5a1.4 1.4 0 0 1 1.3-1.3l7.1-.5a2 2 0 0 1 1.7.6l6 6a2 2 0 0 1 0 2.6Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </Icon>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v8.5A1.5 1.5 0 0 0 5 15h1.5" />
    </Icon>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10.5 11v6M13.5 11v6" />
    </Icon>
  )
}

export function IconWarning(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.3 4.3 2.6 17.6A1.9 1.9 0 0 0 4.3 20.5h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 16.6v.4" />
    </Icon>
  )
}

export function IconArrowUp(props: IconProps) {
  return <Icon {...props}><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></Icon>
}

export function IconArrowDown(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14M17.5 13.5 12 19l-5.5-5.5" /></Icon>
}

/** Uploads local commits to a remote. */
export function IconPush(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 17.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 9.4 4 4 0 0 1 17.6 17.5" />
      <path d="M12 21v-7M9.2 16.2 12 13.4l2.8 2.8" />
    </Icon>
  )
}

/** Downloads remote commits into the local branch. */
export function IconPull(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 17.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 9.4 4 4 0 0 1 17.6 17.5" />
      <path d="M12 13v7M9.2 17.2 12 20l2.8-2.8" />
    </Icon>
  )
}

/** Fetches remote refs without touching the working tree. */
export function IconCloudRefresh(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 18a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 10" />
      <path d="M20 6v4h-4M20 10a5.5 5.5 0 0 1-9.4 3.9M4 18v-4h4M4 14a5.5 5.5 0 0 1 9.4-3.9" />
    </Icon>
  )
}

/** Side-by-side diff. */
export function IconColumns(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="7.5" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="7.5" height="16" rx="1.5" />
    </Icon>
  )
}

export function IconImage(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m4 17 4.8-4.4a1.6 1.6 0 0 1 2.2 0L16 17.5M14.5 15l1.6-1.5a1.6 1.6 0 0 1 2.2 0L20 15" />
    </Icon>
  )
}

/** Blame / per-line authorship. */
export function IconInfo(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </Icon>
  )
}

export function IconTextCursor(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4h1.5A1.5 1.5 0 0 1 12 5.5v13A1.5 1.5 0 0 0 13.5 20H15M15 4h-1.5A1.5 1.5 0 0 0 12 5.5" />
    </Icon>
  )
}

/** Marks the AI-assisted actions (commit message, diff explanation). */
export function IconSparkle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" />
      <path d="M18 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" />
    </Icon>
  )
}
