// "Find material": the two Pages Functions in functions/api/sources/. They check that the caller is
// an author, so this sends the signed-in author's token. Errors become sentences an author can act on.
import type { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { ReadmeResponse, SearchResponse, type SearchRequest } from '@shared/sources/catalog'

const TIMEOUT_MS = 20000
const NOT_RUNNING = "Find material needs the site's server functions, and they are not running here. It works on the deployed site (or with wrangler pages dev)."
const MESSAGES: Record<number, string> = {
  400: 'Check the topic and pick at least one source.',
  401: 'Your sign-in has run out. Sign in again.',
  403: 'Only authors can search for material. Ask a CIC admin.',
  404: 'That repository has no README to import.',
  422: 'That repository is not under an open license, so its text cannot be copied into a lesson.',
  429: 'GitHub is busy. Wait a minute and try again.',
}

const apiBase = () => String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

async function post<S extends z.ZodTypeAny>(path: string, body: unknown, schema: S): Promise<z.infer<S>> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error(MESSAGES[401])
  let res: Response
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new Error("Couldn't reach the search service. Check your connection and try again.")
  }
  const json: unknown = await res.json().catch(() => null)
  if (json === null) throw new Error(NOT_RUNNING) // an HTML page or nothing: no Functions here
  if (!res.ok) throw new Error(MESSAGES[res.status] ?? 'The search service is not working right now. Try again in a few minutes.')
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new Error('The search service sent something unexpected. Try again.')
  return parsed.data
}

export const searchSources = (request: SearchRequest): Promise<SearchResponse> => post('/api/sources/search', request, SearchResponse)
export const importReadme = (repo: string): Promise<ReadmeResponse> => post('/api/sources/readme', { repo }, ReadmeResponse)
