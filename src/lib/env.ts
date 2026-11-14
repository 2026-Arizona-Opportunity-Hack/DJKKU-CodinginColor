import { z } from 'zod'

/**
 * Build-time public config. Everything here ends up in the browser bundle, so it
 * must never hold a secret. The Supabase publishable (anon) key is public by design;
 * Row Level Security protects the data.
 */
const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_DATA_SOURCE: z.enum(['mock', 'supabase']).optional(),
  VITE_FEATURE_HINTS: z.enum(['true', 'false']).optional(),
  VITE_API_BASE: z.string().optional(),
})

export type AppEnv = {
  supabaseUrl: string | undefined
  supabaseKey: string | undefined
  dataSource: 'mock' | 'supabase'
  hintsEnabled: boolean
  apiBase: string
}

export function readEnv(raw: Record<string, unknown>): AppEnv {
  // Empty strings from a copied .env.example mean "unset".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''))
  const parsed = EnvSchema.safeParse(cleaned)
  if (!parsed.success) {
    throw new Error(`Invalid VITE_ configuration: ${z.prettifyError(parsed.error)}`)
  }
  const e = parsed.data
  return {
    supabaseUrl: e.VITE_SUPABASE_URL,
    supabaseKey: e.VITE_SUPABASE_PUBLISHABLE_KEY,
    dataSource: e.VITE_DATA_SOURCE ?? (e.VITE_SUPABASE_URL ? 'supabase' : 'mock'),
    hintsEnabled: e.VITE_FEATURE_HINTS === 'true',
    apiBase: (e.VITE_API_BASE ?? '').replace(/\/$/, ''),
  }
}

export const env: AppEnv = readEnv(import.meta.env)
