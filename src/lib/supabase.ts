import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from './env'

let client: SupabaseClient | null = null

/**
 * The one Supabase client. Sessions persist on the device (ADR 0004: "enter your code
 * once, stay signed in"); supabase-js keeps them in localStorage under `storageKey`.
 * Only the publishable key is used here; RLS and security-definer functions guard data.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set when VITE_DATA_SOURCE=supabase')
  }
  client = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cic.auth' },
  })
  return client
}
