// Shared by every Pages Function. Files in functions/ that export no onRequest*
// handler (like this one) are helpers, not routes, so put shared code in _lib/.

/**
 * Bindings available to every Pages Function. Set them in Cloudflare Pages >
 * Settings > Variables and Secrets; locally, in a `.dev.vars` file (gitignored).
 * Never log these or return them in a response.
 */
export interface Env {
  SUPABASE_URL: string
  /** Bypasses RLS. Functions using it must enforce their own access rules. */
  SUPABASE_SERVICE_ROLE_KEY: string
  /** Free-tier Gemini key for the hint proxy. Optional: hints fall back to written ones. */
  GEMINI_API_KEY?: string
}
