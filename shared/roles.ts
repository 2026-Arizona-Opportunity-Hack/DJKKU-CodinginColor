// Code used by BOTH the browser (src/) and the Pages Functions (functions/).
// Keep it free of React, DOM and Workers-only APIs so either side can import it.
// Put zod schemas that forms and server endpoints both validate against here too.

/** The six roles, exactly the values of the `profiles.role` CHECK constraint in the database. */
export const ROLES = [
  'student',
  'independent_student',
  'mentor',
  'instructor',
  'cic_admin',
  'reviewer',
] as const

export type Role = (typeof ROLES)[number]
