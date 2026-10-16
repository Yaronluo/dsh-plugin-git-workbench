import type { BranchItem } from '../../core/types.js'

/**
 * The name a remote-tracking branch would be checked out under, mirroring the host's
 * `switchBranch`: everything after the remote's first slash, so `origin/master` → `master`.
 */
export function remoteCheckoutName(name: string): string {
  return name.slice(name.indexOf('/') + 1)
}

/**
 * Drops remote rows the host can never act on. A click resolves in this order — an exact
 * local branch first, then a local branch named after the remote ref — and once a local
 * branch owns that name the host refuses to create it again, because Git rejects the
 * duplicate (`git switch --track -c master origin/master` while `master` exists). Such a
 * row is a duplicate of the local branch already listed, and every click ends in an error.
 *
 * Remote rows without a local counterpart stay: fetching a teammate's branch and checking
 * it out is the one thing this path is for.
 */
export function selectableBranches(branches: readonly BranchItem[]): BranchItem[] {
  const localNames = new Set(branches.filter(branch => !branch.isRemote).map(branch => branch.name))
  return branches.filter(branch => !branch.isRemote
    || (!localNames.has(branch.name) && !localNames.has(remoteCheckoutName(branch.name))))
}
