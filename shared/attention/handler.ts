import { z } from 'zod'

export interface AttentionEnv {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  GEMINI_API_KEY?: string
  AI_GATEWAY_URL?: string
  AI_GATEWAY_KEY?: string
  AI_MODEL?: string
}

export interface AttentionDeps {
  fetch?: typeof fetch
}

const Evidence = z.object({
  status: z.enum([
    'not_joined',
    'not_started',
    'stuck',
    'inactive',
    'done',
    'on_track',
  ]),
  completion_pct: z.number().min(0).max(100),
  class_median_pct: z.number().min(0).max(100).nullable(),
  days_inactive: z.number().nonnegative().nullable(),
  wrong_attempts: z.number().nonnegative(),
  first_try_pct: z.number().min(0).max(100).nullable(),
  hints_total: z.number().nonnegative(),
  hints_per_attempt: z.number().nonnegative().nullable(),
  current_struggles: z.array(z.string().max(200)).max(5),
  focus_concepts: z
    .array(
      z.object({
        concept: z.string().max(100),
        mastery_pct: z.number().min(0).max(100),
        class_avg_pct: z.number().min(0).max(100).nullable(),
      }),
    )
    .max(5),
  slipped_questions: z.number().nonnegative(),
  slow_activities: z.number().nonnegative(),
})

export type AttentionEvidence = z.infer<typeof Evidence>

const Body = z.object({ evidence: Evidence }).strict()

const Insight = z.object({
  priority: z.enum(['immediate', 'watch', 'on_track']),
  summary: z.string().min(1).max(240),
  evidence: z.array(z.string().min(1).max(180)).min(1).max(3),
  suggested_action: z.string().min(1).max(240),
})

export type AttentionInsight = z.infer<typeof Insight>

const SYSTEM_PROMPT = `You help a coding instructor notice when a student may need support.

You receive anonymous learning analytics only. The student has no name or identity.

Use only the evidence provided. Do not diagnose disabilities, mental health conditions, motivation, intelligence, home circumstances, or anything else not directly measured.

Priority:
- immediate: clear evidence the instructor should check in now or today
- watch: a meaningful pattern worth monitoring or addressing soon
- on_track: no concerning pattern

Return ONLY valid JSON with exactly:
{
  "priority": "immediate" | "watch" | "on_track",
  "summary": "one short plain-language sentence",
  "evidence": ["1-3 factual observations from the supplied analytics"],
  "suggested_action": "one specific, supportive action the instructor could take"
}

Never recommend punishment, grading changes, removing access, or automatic intervention. The instructor makes the decision.`

const GATEWAY_MODEL = 'gpt-oss-120b'

export async function handleAttention(
  request: Request,
  env: AttentionEnv,
  deps: AttentionDeps = {},
): Promise<Response> {
  const f = deps.fetch ?? fetch
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID()

  const reply = (status: number, body: unknown) =>
    Response.json(body, {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'x-request-id': requestId,
      },
    })

  let raw: unknown

  try {
    raw = JSON.parse(await request.text())
  } catch {
    return reply(400, { error: 'invalid_request' })
  }

  const parsed = Body.safeParse(raw)

  if (!parsed.success) {
    return reply(400, { error: 'invalid_request' })
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return reply(503, { error: 'unavailable' })
  }

  const token =
    /^Bearer (.+)$/i.exec(
      request.headers.get('authorization') ?? '',
    )?.[1]

  if (!token) {
    return reply(401, { error: 'unauthorized' })
  }

  const base = env.SUPABASE_URL.replace(/\/$/, '')

  try {
    const meResponse = await f(`${base}/rest/v1/rpc/get_me`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    if (!meResponse.ok) {
      return reply(401, { error: 'unauthorized' })
    }

    const me = (await meResponse.json()) as {
      role?: string
    } | null

    if (
      !me ||
      !['instructor', 'cic_admin'].includes(me.role ?? '')
    ) {
      return reply(403, { error: 'forbidden' })
    }

    const prompt = JSON.stringify(parsed.data.evidence, null, 2)

    let text: string | null = null

    if (env.AI_GATEWAY_URL && env.AI_GATEWAY_KEY) {
      text = await askGateway(f, env, prompt)
    } else if (env.GEMINI_API_KEY) {
      text = await askGemini(f, env.GEMINI_API_KEY, prompt)
    }

    if (!text) {
      return reply(503, { error: 'ai_unavailable' })
    }

    const insight = parseInsight(text)

    if (!insight) {
      return reply(503, { error: 'ai_unavailable' })
    }

    return reply(200, insight)
  } catch {
    return reply(503, { error: 'unavailable' })
  }
}

function parseInsight(text: string): AttentionInsight | null {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')

  try {
    const parsed = Insight.safeParse(JSON.parse(cleaned))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

async function askGateway(
  f: typeof fetch,
  env: AttentionEnv,
  prompt: string,
): Promise<string | null> {
  const response = await f(
    `${env.AI_GATEWAY_URL!.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.AI_GATEWAY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AI_MODEL || GATEWAY_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(8000),
    },
  )

  if (!response.ok) return null

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null
      }
    }[]
  }

  return data.choices?.[0]?.message?.content ?? null
}

async function askGemini(
  f: typeof fetch,
  key: string,
  prompt: string,
): Promise<string | null> {
  const response = await f(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          thinkingConfig: { thinkingLevel: 'minimal' },
        },
      }),
      signal: AbortSignal.timeout(5000),
    },
  )

  if (!response.ok) return null

  const data = (await response.json()) as {
    candidates?: {
      content?: {
        parts?: {
          text?: string
          thought?: boolean
        }[]
      }
    }[]
  }

  return (
    data.candidates?.[0]?.content?.parts ?? []
  )
    .filter(
      (part) =>
        !part.thought && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join(' ')
}