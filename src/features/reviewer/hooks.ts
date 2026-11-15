import { useQuery } from '@tanstack/react-query'
import { fetchConcepts, fetchModule, fetchModules } from './api'

export const useModules = () => useQuery({ queryKey: ['review', 'modules'], queryFn: fetchModules })

export const useModule = (moduleId: string) =>
  useQuery({ queryKey: ['review', 'module', moduleId], queryFn: () => fetchModule(moduleId) })

/** Concept names are only labels: if they fail to load, the page still works without them. */
export const useConcepts = () =>
  useQuery({ queryKey: ['review', 'concepts'], queryFn: fetchConcepts, staleTime: 5 * 60_000 })
