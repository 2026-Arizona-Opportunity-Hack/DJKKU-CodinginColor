import { ROLES, type Role } from '@shared/roles'

export function appRoleFromDatabase(value: unknown): Role | null {
  if (value === 'cic_admin') return 'admin'
  return ROLES.find((role) => role === value) ?? null
}

export function roleLandingPath(role: Role): string | null {
  if (role === 'admin') return '/admin'
  if (role === 'instructor' || role === 'mentor') return '/instructor'
  if (role === 'reviewer') return '/review'
  return null
}
