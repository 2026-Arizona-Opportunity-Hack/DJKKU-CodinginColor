import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

/**
 * The one shared Supabase client. Uses the public anon key; what a user can
 * actually read or write is decided by row-level security, not by this key.
 * Created lazily so pages that do not need data still render when .env is
 * missing, and the error says exactly what to fix.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
    )
  }
  client = createClient(url, anonKey)
  return client
}
