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
