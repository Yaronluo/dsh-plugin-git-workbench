import React from 'react'

export function IconBranch({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="6" y1="3" x2="6" y2="13" />
      <circle cx="6" cy="3" r="2" />
      <circle cx="6" cy="13" r="2" />
      <circle cx="12" cy="7" r="2" />
      <path d="M6 9a4 4 0 0 0 4-4v0" />
    </svg>
  )
}

export function IconChevronDown({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 6 8 10 12 6" />
    </svg>
  )
}

export function IconSearch({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  )
}

export function IconCheck({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  )
}

export function IconDiff({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="5" y1="5" x2="5" y2="9" />
      <line x1="3" y1="7" x2="7" y2="7" />
      <line x1="9" y1="7" x2="13" y2="7" />
    </svg>
  )
}

export function IconFile({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z" />
      <polyline points="9 2 9 6 13 6" />
    </svg>
  )
}

export function IconRefresh({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 8a5.5 5.5 0 0 1 9.3-3.9L13.5 6" />
      <polyline points="13.5 2 13.5 6 9.5 6" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.3 3.9L2.5 10" />
      <polyline points="2.5 14 2.5 10 6.5 10" />
    </svg>
  )
}

export function IconClose({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

export function IconGraph({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="5" cy="4" r="2" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="11" cy="8" r="2" />
      <path d="M5 6v4" />
      <path d="M5 6c0 2 6 0 6 2" />
    </svg>
  )
}

export function IconWorktree({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="5" height="4" rx="1" />
      <rect x="9" y="3" width="5" height="4" rx="1" />
      <rect x="5.5" y="10" width="5" height="4" rx="1" />
      <line x1="4.5" y1="7" x2="4.5" y2="8.5" />
      <line x1="11.5" y1="7" x2="11.5" y2="8.5" />
      <line x1="4.5" y1="8.5" x2="11.5" y2="8.5" />
      <line x1="8" y1="8.5" x2="8" y2="10" />
    </svg>
  )
}
