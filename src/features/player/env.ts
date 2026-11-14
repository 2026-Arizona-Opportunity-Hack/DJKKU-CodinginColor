import { z } from 'zod'

/**
 * Lane B's build-time public config. Everything here ships in the browser bundle, so it
 * never holds a secret. The Supabase URL and anon key are read by `@/lib/supabase`.
 */
const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_DATA_SOURCE: z.enum(['mock', 'supabase']).optional(),
  VITE_FEATURE_HINTS: z.enum(['true', 'false']).optional(),
  VITE_API_BASE: z.string().optional(),
})

export type AppEnv = {
  dataSource: 'mock' | 'supabase'
  hintsEnabled: boolean
  apiBase: string
}

export function readEnv(raw: Record<string, unknown>): AppEnv {
  // Empty strings from a copied .env.example mean "unset".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''))
  const parsed = EnvSchema.safeParse(cleaned)
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid VITE_ configuration: ${detail}`)
  }
  const e = parsed.data
  return {
    dataSource: e.VITE_DATA_SOURCE ?? (e.VITE_SUPABASE_URL ? 'supabase' : 'mock'),
    hintsEnabled: e.VITE_FEATURE_HINTS === 'true',
    apiBase: (e.VITE_API_BASE ?? '').replace(/\/$/, ''),
  }
}

export const env: AppEnv = readEnv(import.meta.env)
