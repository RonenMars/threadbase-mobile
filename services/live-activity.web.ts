// Live Activities are an iOS surface with no web equivalent. Metro's platform
// extension resolution swaps this in for web so the reconciler's call sites do
// not need a platform check of their own.
//
// Only the impure entry points are stubbed — the pure helpers in the native
// module import nothing native, but a web bundle that reached them would still
// pull in `expo-widgets`, so they are re-declared here rather than re-exported.
import type { Session } from '@/types/api'

export async function reconcile(_serverId: string, _session: Session): Promise<void> {}

export function adoptRunningActivities(): void {}

export function resetLiveActivities(): void {}
