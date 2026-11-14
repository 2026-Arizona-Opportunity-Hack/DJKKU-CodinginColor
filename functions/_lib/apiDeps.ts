import type { ApiDeps } from '../../shared/api/handler'
import { createSupabaseSource } from '../../shared/api/supabaseSource'
import type { Env } from './env'

/**
 * What the read API handlers need, built from the Cloudflare environment. Null when the
 * Supabase settings are missing, so a misconfigured deploy answers 503 instead of
 * guessing or serving made-up data.
 */
export function apiDeps(env: Env): ApiDeps | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  return {
    data: createSupabaseSource({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    }),
  }
}

export function notConfigured(): Response {
  return Response.json(
    { error: { code: 'unavailable', message: 'The API is not configured on this server.' } },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
