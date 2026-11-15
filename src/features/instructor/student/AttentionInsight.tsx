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

export function AttentionInsight({
  report,
  demo = false,
}: {
  report: StudentReport
  demo?: boolean
}) {
  const [insight, setInsight] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function analyze() {
    setLoading(true)
    setError('')

    try {
      if (demo) {
        setInsight(buildDemoInsight(report))
        return
      }

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
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="ai-attention-heading" className="text-xl font-semibold">
            AI instructor insight
          </h3>

          {demo && (
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              Demo
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          AI reviews anonymous learning signals and suggests where your
          attention may help. It does not grade students or take action.
        </p>

        {demo && (
          <p className="mt-1 text-xs text-muted-foreground">
            Demo mode uses a sample insight generated from this sample
            student&apos;s analytics. No AI service is called.
          </p>
        )}
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
          <p className="font-semibold">{PRIORITY[insight.priority]}</p>

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

          {!demo && (
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={loading}
              className="w-fit rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {loading ? 'Refreshing...' : 'Refresh insight'}
            </button>
          )}
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

function buildDemoInsight(report: StudentReport): Insight {
  const focus = report.mastery.find((concept) => concept.band === 'focus')
  const slow = report.engagement.slowActivities[0]

  const evidence: string[] = []

  if (report.daysSinceActive !== null && report.daysSinceActive >= 3) {
    evidence.push(
      `No recorded activity for ${report.daysSinceActive} days.`,
    )
  }

  if (focus) {
    evidence.push(
      `${focus.concept} mastery is ${focus.masteryPct}%${
        focus.classAvgPct !== null
          ? ` compared with ${focus.classAvgPct}% for the class`
          : ''
      }.`,
    )
  }

  if (slow) {
    evidence.push(
      `${slow.activity} took much longer than the class median.`,
    )
  }

  if (evidence.length === 0) {
    evidence.push('No urgent learning pattern is visible in the sample data.')
  }

  const priority: Priority =
    report.status.kind === 'stuck' ||
    report.status.kind === 'inactive' ||
    report.status.kind === 'not_started'
      ? 'immediate'
      : focus
        ? 'watch'
        : 'on_track'

  return {
    priority,
    summary:
      priority === 'immediate'
        ? `Multiple learning signals suggest this student may benefit from an instructor check-in.`
        : priority === 'watch'
          ? `One or more learning signals are worth monitoring.`
          : `The current learning signals do not show an urgent concern.`,
    evidence: evidence.slice(0, 3),
    suggested_action: focus
      ? `Check understanding of ${focus.concept} and work through one example together before the student continues.`
      : 'Continue normal instruction and monitoring.',
  }
}