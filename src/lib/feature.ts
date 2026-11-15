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
  /** What this feature offers, for the Guide page (/guide). Each feature describes itself. */
  guide?: GuideEntry[]
}

/** Who a guide entry is for. 'author' is an instructor or admin with can_author; 'visitor' is signed out. */
export type GuideRole = 'visitor' | 'student' | 'instructor' | 'author' | 'cic_admin' | 'reviewer'

export interface GuideEntry {
  /** Unique across the app. */
  id: string
  title: string
  /** One sentence: what it is for, in the user's words. */
  summary: string
  /** Where "Go there" leads: an exact screen, or a /<feature>/go/<section> link the feature resolves. */
  to: string
  /** True for a static page outside the app (opened as a normal link). */
  external?: boolean
  roles: GuideRole[]
  /** Heading the entry sits under for its role, such as "Run a class". */
  group: string
  /** Position in "Your first steps" for the entry's FIRST role (1, 2, 3...); other roles list it without a number. */
  step?: number
  /** Extra steps once there, when the feature sits inside a screen. */
  howTo?: string
}
