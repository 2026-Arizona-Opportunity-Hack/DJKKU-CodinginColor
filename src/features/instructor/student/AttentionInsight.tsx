import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { StudentReport } from './report'

type Priority = 'immediate' | 'watch' | 'on_track'

interface Insight {
  priority: Priority
  summary: string
  evidence: string[]
  suggested_action: string
}

const PRIORITY: Record<Priority, string> = {
  immediate: 'Immediate attention',
  watch: 'Watch closely',
  on_track: 'On track',
}

export function AttentionInsight({ report }: { report: StudentReport }) {
  const [insight, setInsight] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function analyze() {
    setLoading(true)
    setError('')

    try {
      const { data } = await getSupabase().auth.getSession()

      if (!data.session) {
        throw new Error('Sign in to use AI instructor insights.')
      }

      const response = await fetch('/api/attention', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          evidence: buildEvidence(report),
        }),
      })

      if (!response.ok) {
        throw new Error('AI insight is unavailable right now.')
      }

      setInsight((await response.json()) as Insight)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'AI insight is unavailable right now.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="ai-attention-heading"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div>
        <h3 id="ai-attention-heading" className="text-xl font-semibold">
          AI instructor insight
        </h3>
        <p className="text-sm text-muted-foreground">
          AI reviews anonymous learning signals and suggests where your
          attention may help. It does not grade students or take action.
        </p>
      </div>

      {!insight ? (
        <div>
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={loading}
            className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Analyzing...' : 'Analyze learning signals'}
          </button>

          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error} The rule-based suggestions below still work.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-semibold">
            {PRIORITY[insight.priority]}
          </p>

          <p>{insight.summary}</p>

          <div>
            <p className="font-medium">Why this was flagged</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {insight.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <p className="text-sm">
            <span className="font-medium">Suggested action: </span>
            {insight.suggested_action}
          </p>

          <button
            type="button"
            onClick={() => void analyze()}
            disabled={loading}
            className="w-fit rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh insight'}
          </button>
        </div>
      )}
    </section>
  )
}

function buildEvidence(report: StudentReport) {
  return {
    status: report.status.kind,
    completion_pct: report.completion.pct,
    class_median_pct: report.completion.classMedianPct,
    days_inactive: report.daysSinceActive,
    wrong_attempts: report.accuracy.wrongAttempts,
    first_try_pct: report.accuracy.firstTryPct,
    hints_total: report.hints.total,
    hints_per_attempt: report.hints.perScoredAttempt,

    current_struggles: report.struggles.current
      .slice(0, 5)
      .map(
        (struggle) =>
          `${struggle.activity}: ${struggle.reasons.join(', ')}`,
      ),

    focus_concepts: report.mastery
      .filter((concept) => concept.band === 'focus')
      .slice(0, 5)
      .map((concept) => ({
        concept: concept.concept,
        mastery_pct: concept.masteryPct,
        class_avg_pct: concept.classAvgPct,
      })),

    slipped_questions: report.pairCounts.slipped,
    slow_activities: report.engagement.slowActivities.length,
  }
}