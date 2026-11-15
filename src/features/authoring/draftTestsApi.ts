// "Draft with AI" for the pre-test and post-test: POST /api/draft-tests with the module as it is on
// screen. The function checks the caller is an author; the AI provider is set by the deployment.
import { getSupabase } from '@/lib/supabase'
import type { DraftTestsRequest } from '@shared/authoring/draftTests'
import type { AuthoredAssessment } from '@shared/authoring/schemas'
import { authoredAssessment } from '@shared/authoring/schemas'
import type { ModuleFV } from './formTypes'

const MESSAGES: Record<number, string> = {
  400: 'Give the module a title and at least one lesson with some material first.',
  401: 'Your sign-in has run out. Sign in again.',
  403: 'Only authors can draft tests. Ask a CIC admin.',
  413: 'This module is too long to send in one go. Draft the tests for a shorter module.',
  502: "The AI didn't give usable questions this time. Try again.",
  503: 'AI drafting is not set up on this site yet. Write the tests by hand, or ask the site admin.',
}
const NOT_RUNNING = "AI drafting needs the site's server functions, and they are not running here. It works on the deployed site (or with wrangler pages dev)."
const apiBase = () => String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

/** The text the AI reads for one activity: whatever material it has. Answer keys are never sent. */
function activityText(a: ModuleFV['lessons'][number]['activities'][number]): string {
  switch (a.kind) {
    case 'reading': return a.body ?? ''
    case 'video': return a.transcript ?? ''
    case 'code': return [a.prompt, a.starter ? `Starter code:\n${a.starter}` : '', ...(a.tests ?? [])].filter(Boolean).join('\n')
    default: return (a.questions ?? []).map((q) => q.content.prompt).join('\n')
  }
}

export function toDraftRequest(values: ModuleFV, concepts: { id: string; name: string }[], pairs: number): DraftTestsRequest {
  return {
    title: values.title.trim(),
    summary: values.summary ?? '',
    lessons: values.lessons.map((l) => ({
      title: l.title,
      activities: l.activities.map((a) => ({ kind: a.kind, title: a.title, conceptId: a.conceptId ?? null, text: activityText(a), youtubeUrl: a.youtubeUrl ?? null })),
    })),
    concepts,
    pairs,
  }
}

export type DraftedTests = { pre: AuthoredAssessment; post: AuthoredAssessment; dropped: number; usedTranscripts: number }

export async function draftTests(request: DraftTestsRequest): Promise<DraftedTests> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error(MESSAGES[401])
  let res: Response
  try {
    res = await fetch(`${apiBase()}/api/draft-tests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new Error("Couldn't reach the drafting service. Check your connection and try again.")
  }
  const json = (await res.json().catch(() => null)) as { pre?: unknown; post?: unknown; dropped?: number; usedTranscripts?: number } | null
  if (json === null) throw new Error(NOT_RUNNING)
  if (!res.ok) throw new Error(MESSAGES[res.status] ?? 'The drafting service is not working right now. Try again in a few minutes.')
  const pre = authoredAssessment.safeParse(json.pre)
  const post = authoredAssessment.safeParse(json.post)
  if (!pre.success || !post.success) throw new Error(MESSAGES[502])
  return { pre: pre.data, post: post.data, dropped: json.dropped ?? 0, usedTranscripts: json.usedTranscripts ?? 0 }
}
