import { createContext, useContext } from 'react'

import type { StudentApi } from './api'

const StudentApiContext = createContext<StudentApi | null>(null)

/** Usage: <StudentApiProvider value={api}>…</StudentApiProvider> */
export const StudentApiProvider = StudentApiContext.Provider

export function useStudentApi(): StudentApi {
  const api = useContext(StudentApiContext)
  if (!api) throw new Error('useStudentApi must be used inside <StudentApiProvider>')
  return api
}
