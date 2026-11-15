import type { RouteObject } from 'react-router'
import type { Role } from '@shared/roles'

/**
 * The contract every feature folder under src/features/ fulfils. A feature
 * exports one of these from its index.tsx; src/app/features.ts lists them.
 * The router and the nav bar are built from that list, so adding a feature
 * never means editing the router or the layout.
 */
export interface FeatureModule {
  /** Unique, lowercase, matches the folder name. */
  id: string
  /** Text of the nav link. */
  label: string
  /** Top-level URL, e.g. "/learn". Every route below must live under it. */
  path: string
  /** Full-path routes, e.g. { path: '/learn/*', element: <PlayerPage /> }. */
  routes: RouteObject[]
  /** Roles allowed in; the router checks these for navigation, and RLS remains authoritative. */
  roles?: Role[]
}
