// Shared by every Pages Function. Files in functions/ that export no onRequest*
// handler (like this one) are helpers, not routes, so put shared code in _lib/.

/**
 * Bindings available to every Pages Function. Set them in Cloudflare Pages >
 * Settings > Variables and Secrets; locally, in a `.dev.vars` file (gitignored).
 * Never log these or return them in a response.
 */
export interface Env {
  SUPABASE_URL: string
  /** The public anon key. Used to ask Supabase Auth who a student's token belongs to (not a secret). */
  SUPABASE_ANON_KEY: string
  /** Bypasses RLS. Functions using it must enforce their own access rules. */
  SUPABASE_SERVICE_ROLE_KEY: string
  /** Free-tier Gemini key for the hint proxy. Optional: hints fall back to written ones. */
  GEMINI_API_KEY?: string
  /** OpenAI-compatible AI gateway for hints (e.g. https://ai.ohack.dev/v1). With AI_GATEWAY_KEY, used instead of Gemini. */
  AI_GATEWAY_URL?: string
  AI_GATEWAY_KEY?: string
  /** Gateway model; defaults to gpt-oss-120b. */
  AI_MODEL?: string
  /** YouTube Data API v3 key for "Find material". Optional: without it only GitHub is searched. */
  YOUTUBE_API_KEY?: string
  /** GitHub token with no scopes for "Find material". Optional: 30 searches a minute instead of 10. */
  GITHUB_TOKEN?: string
  /** Supadata key for real video transcripts (/api/transcript). Optional: without it the author's summary shows. */
  SUPADATA_API_KEY?: string
}
