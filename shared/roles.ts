// Code used by BOTH the browser (src/) and the Pages Functions (functions/).
// Keep it free of React, DOM and Workers-only APIs so either side can import it.
// Put zod schemas that forms and server endpoints both validate against here too.

/** The six roles in the design plan. One `role` column on `profiles`. */
export const ROLES = [
  'student',
  'independent_student',
  'mentor',
  'instructor',
  'admin',
  'reviewer',
] as const

export type Role = (typeof ROLES)[number]
