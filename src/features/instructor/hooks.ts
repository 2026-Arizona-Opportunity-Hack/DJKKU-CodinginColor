import { useQuery } from '@tanstack/react-query'
import { listInstructorClasses } from './api.supabase'

export const classesKey = ['instructor', 'classes'] as const

/** The classes this person teaches (row-level security; admins see all), sorted by name. */
export const useClasses = () =>
  useQuery({
    queryKey: classesKey,
    queryFn: async () => (await listInstructorClasses()).sort((a, b) => a.name.localeCompare(b.name)),
  })
