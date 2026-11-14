import type { AppEnv } from '@/lib/env'

import type { StudentApi } from './api'

/**
 * Picks the data source (B15). Dynamic imports keep supabase-js out of the mock build's
 * main chunk and the mock seed out of the Supabase build's main chunk.
 */
export async function loadStudentApi(env: AppEnv): Promise<StudentApi> {
  if (env.dataSource === 'supabase') {
    const { createSupabaseApi } = await import('./api.supabase')
    return createSupabaseApi()
  }
  const { createMockApi } = await import('./api.mock')
  return createMockApi({ latencyMs: 300 })
}
