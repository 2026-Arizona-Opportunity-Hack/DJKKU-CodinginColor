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
  /** Other top-level URLs this feature owns, such as '/join' for the auth feature. */
  extraPaths?: string[]
  /** Full-path routes, e.g. { path: '/learn/*', element: <PlayerPage /> }. */
  routes: RouteObject[]
  /**
   * Roles this feature is for. The nav hides the link and the layout shows "no access" for
   * other roles, but that is a courtesy only: row-level security is the real gate.
   */
  roles?: Role[]
  /** Nav only: 'also' keeps the link for signed-out visitors; 'only' shows it to them alone. */
  showSignedOut?: 'also' | 'only'
  /** Nav only: also needs `profiles.can_author` (CIC admins always pass). */
  needsAuthorFlag?: boolean
}
