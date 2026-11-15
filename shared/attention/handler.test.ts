import { describe, expect, it, vi } from 'vitest'

import { handleAttention, type AttentionEnv } from './handler'

const evidence = {
  status: 'stuck' as const,
  completion_pct: 35,
  class_median_pct: 68,
  days_inactive: 0,
  wrong_attempts: 4,
  first_try_pct: 40,
  hints_total: 5,
  hints_per_attempt: 1.25,
  current_struggles: ['Variables check: 4 wrong tries'],
  focus_concepts: [
    {
      concept: 'Variables',
      mastery_pct: 42,
      class_avg_pct: 71,
    },
  ],
  slipped_questions: 2,
  slow_activities: 1,
}

const env: AttentionEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  AI_GATEWAY_URL: 'https://ai.example.test/v1',
  AI_GATEWAY_KEY: 'gateway-key',
  AI_MODEL: 'test-model',
}

function request(
  body: unknown = { evidence },
  token = 'staff-token',
) {
  return new Request('https://app.test/api/attention', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AI student attention', () => {
  it('rejects a request without a staff token', async () => {
    const req = new Request('https://app.test/api/attention', {
      method: 'POST',
      body: JSON.stringify({ evidence }),
    })

    const fetchMock = vi.fn()

    const response = await handleAttention(req, env, {
      fetch: fetchMock as typeof fetch,
    })

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows instructors and returns structured insight', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/rest/v1/rpc/get_me')) {
        return jsonResponse({
          role: 'instructor',
        })
      }

      if (url.includes('/chat/completions')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  priority: 'immediate',
                  summary:
                    'The student is showing repeated difficulty with variables.',
                  evidence: [
                    'Completion is 35% compared with a class median of 68%.',
                    'Variables mastery is 42% compared with 71% for the class.',
                  ],
                  suggested_action:
                    'Check understanding of variable assignment before the student continues.',
                }),
              },
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const response = await handleAttention(request(), env, {
      fetch: fetchMock as typeof fetch,
    })

    expect(response.status).toBe(200)

    expect(await response.json()).toEqual({
      priority: 'immediate',
      summary:
        'The student is showing repeated difficulty with variables.',
      evidence: [
        'Completion is 35% compared with a class median of 68%.',
        'Variables mastery is 42% compared with 71% for the class.',
      ],
      suggested_action:
        'Check understanding of variable assignment before the student continues.',
    })
  })

  it('refuses student accounts before calling the model', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/rest/v1/rpc/get_me')) {
        return jsonResponse({
          role: 'student',
        })
      }

      throw new Error('The model should not be called')
    })

    const response = await handleAttention(request(), env, {
      fetch: fetchMock as typeof fetch,
    })

    expect(response.status).toBe(403)

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/chat/completions'),
      ),
    ).toBe(false)
  })

  it('sends anonymous analytics to the model, not student identity', async () => {
    let modelBody = ''

    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url = String(input)

        if (url.includes('/rest/v1/rpc/get_me')) {
          return jsonResponse({
            role: 'cic_admin',
            profile_id: 'secret-profile-id',
            display_name: 'Secret Teacher',
          })
        }

        if (url.includes('/chat/completions')) {
          modelBody = String(init?.body ?? '')

          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    priority: 'watch',
                    summary: 'Several learning signals are worth monitoring.',
                    evidence: ['The student is behind the class median.'],
                    suggested_action:
                      'Check in during the next class activity.',
                  }),
                },
              },
            ],
          })
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    )

    const response = await handleAttention(request(), env, {
      fetch: fetchMock as typeof fetch,
    })

    expect(response.status).toBe(200)

    const modelRequest = JSON.parse(modelBody) as {
  messages: { role: string; content: string }[]
}

const userPrompt =
  modelRequest.messages.find((message) => message.role === 'user')
    ?.content ?? ''

const sentEvidence = JSON.parse(userPrompt) as Record<string, unknown>

expect(sentEvidence.completion_pct).toBe(35)
expect(sentEvidence.focus_concepts).toEqual([
  {
    concept: 'Variables',
    mastery_pct: 42,
    class_avg_pct: 71,
  },
])

expect(userPrompt).not.toContain('secret-profile-id')
expect(userPrompt).not.toContain('Secret Teacher')
expect(userPrompt).not.toContain('staff-token')
expect(userPrompt).not.toContain('display_name')
expect(userPrompt).not.toContain('email')
expect(userPrompt).not.toContain('student_id')
expect(userPrompt).not.toContain('class_id')
  })

  it('rejects malformed model output instead of trusting it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/rest/v1/rpc/get_me')) {
        return jsonResponse({
          role: 'instructor',
        })
      }

      if (url.includes('/chat/completions')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: 'This student definitely needs help!',
              },
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const response = await handleAttention(request(), env, {
      fetch: fetchMock as typeof fetch,
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'ai_unavailable',
    })
  })

  it('marks responses private and non-cacheable', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/rest/v1/rpc/get_me')) {
        return jsonResponse({
          role: 'instructor',
        })
      }

      if (url.includes('/chat/completions')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  priority: 'on_track',
                  summary: 'No concerning pattern is visible.',
                  evidence: ['Progress is consistent with the class.'],
                  suggested_action:
                    'Continue normal instruction and monitoring.',
                }),
              },
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const response = await handleAttention(request(), env, {
      fetch: fetchMock as typeof fetch,
    })

    expect(response.headers.get('cache-control')).toBe(
      'private, no-store',
    )
  })
})