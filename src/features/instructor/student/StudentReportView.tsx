import type { ReactNode } from 'react'
import { ActivityCalendar, Bar } from './charts'
import { daysAgo, duration, pct, shortDate, signedPoints } from './format'
import type { ActivityRow, PairOutcome, StatusKind, StudentReport } from './report'

// Presentational only: renders a built report. Every visual has its number printed as text, and every
// list of numbers is a real table, so the page works with a screen reader and on paper.

const STATUS_TONE: Record<StatusKind, string> = {
  not_joined: 'border-border bg-muted text-foreground',
  not_started: 'border-warning/40 bg-warning-muted text-warning',
  stuck: 'border-destructive/40 bg-card text-destructive',
  inactive: 'border-warning/40 bg-warning-muted text-warning',
  done: 'border-success/40 bg-success-muted text-success',
  on_track: 'border-success/40 bg-success-muted text-success',
}
const SEVERITY: Record<StudentReport['nextSteps'][number]['severity'], string> = { high: 'Urgent', medium: 'Worth doing', info: 'Good to know' }
const STATE: Record<ActivityRow['state'], string> = { completed: 'Done', in_progress: 'In progress', not_started: 'Not started' }
const KIND: Record<ActivityRow['kind'], string> = { video: 'Video', reading: 'Reading', check: 'Check', worksheet: 'Worksheet', exit: 'Exit question', code: 'Code (Python)' }
const OUTCOME: Record<PairOutcome, string> = { learned: 'Learned', kept: 'Already knew', missing: 'Still missing', slipped: 'Slipped', incomplete: 'Incomplete' }

const th = 'border-b px-3 py-2 text-left font-semibold'
const td = 'border-b px-3 py-2 align-top'

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 break-inside-avoid">
      <div>
        <h3 id={id} className="text-xl font-semibold">{title}</h3>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border p-4 text-sm">{children}</p>
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  )
}

function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          <tr>{head.map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function StudentReportView({ report: r, actions }: { report: StudentReport; actions?: ReactNode }) {
  const g = r.gain[0]
  return (
    <article aria-labelledby="student-name" className="flex flex-col gap-10">
      {/* 1. Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="student-name" className="text-3xl font-bold">{r.name}</h2>
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${STATUS_TONE[r.status.kind]}`}>{r.status.label}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {r.className} · {r.joined ? `Joined ${shortDate(r.joinedAt)}` : 'Seat not claimed yet'} · Last active {daysAgo(r.daysSinceActive)}
          {r.current ? ` · Now on "${r.current.activity}" (${r.current.lesson})` : ''}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Completion" value={`${r.completion.pct}%`} detail={`${r.completion.completed} of ${r.completion.required} required${r.completion.classMedianPct !== null ? ` · class median ${r.completion.classMedianPct}%` : ''}`} />
          <Stat label="Learning gain" value={g ? signedPoints(g.gainPoints) : '–'} detail={g?.classGainPoints != null ? `class ${signedPoints(g.classGainPoints)}` : 'Needs both tests'} />
          <Stat label="Right on first try" value={pct(r.accuracy.firstTryPct)} detail={`${r.accuracy.scoredActivities} scored activities`} />
          <Stat label="Time on task" value={duration(r.engagement.totalTimeS)} detail={`${r.engagement.activeDays} active days`} />
          <Stat label="Hints used" value={String(r.hints.total)} detail={r.hints.perScoredAttempt !== null ? `${r.hints.perScoredAttempt} per try` : undefined} />
        </div>
        {actions}
      </header>

      {/* 2. Next steps */}
      <Section id="next-steps" title="Suggested next steps" intro="Rule-based suggestions from this student's activity. You decide what to do.">
        <ul className="flex flex-col gap-2">
          {r.nextSteps.map((s, i) => (
            <li key={i} className="rounded-lg border p-3">
              <span className="font-semibold">{SEVERITY[s.severity]}: </span>{s.text}
            </li>
          ))}
        </ul>
      </Section>

      {/* 3. Progress path */}
      <Section id="progress-path" title="Progress through the class" intro="Every assigned activity in class order. Time is compared with the class median.">
        {r.modules.length === 0 ? <Empty>No modules are assigned to this class yet.</Empty> : r.modules.map((m) => (
          <div key={m.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold">{m.title}</h4>
              <span className="text-sm">{m.pct}% ({m.completed} of {m.required})</span>
              <div className="max-w-xs flex-1"><Bar value={m.pct} /></div>
            </div>
            <Table caption={`Activities in ${m.title}`} head={['Lesson', 'Activity', 'Type', 'Status', 'Tries', 'First try', 'Hints', 'Time (class median)']}>
              {m.lessons.flatMap((l) => l.activities.map((a) => (
                <tr key={a.id}>
                  <td className={td}>{l.title}</td>
                  <td className={td}>{a.title}{a.required ? '' : ' (optional)'}{a.concept ? <span className="block text-xs text-muted-foreground">{a.concept}</span> : null}</td>
                  <td className={td}>{KIND[a.kind]}</td>
                  <td className={td}>{STATE[a.state]}</td>
                  <td className={td}>{a.attempts || '–'}</td>
                  <td className={td}>{a.firstTryCorrect === null ? '–' : a.firstTryCorrect ? 'Right' : 'Wrong'}</td>
                  <td className={td}>{a.hints || '–'}</td>
                  <td className={td}>{a.timeSpentS ? duration(a.timeSpentS) : '–'}{a.classMedianTimeS !== null ? ` (${duration(a.classMedianTimeS)})` : ''}</td>
                </tr>
              )))}
            </Table>
          </div>
        ))}
      </Section>

      {/* 4. Learning gain */}
      <Section id="learning-gain" title="Learning gain" intro="Post-test minus pre-test, in points. Missing tests are shown as incomplete, never as zero.">
        {r.gain.length === 0 ? <Empty>No pre-test or post-test results yet.</Empty> : (
          <>
            <Table caption="Learning gain by module" head={['Module', 'Pre', 'Post', 'Gain', 'Normalized gain', 'Class gain']}>
              {r.gain.map((x) => (
                <tr key={x.moduleId}>
                  <td className={td}>{x.module}</td>
                  <td className={td}>{pct(x.prePct)}</td>
                  <td className={td}>{pct(x.postPct)}</td>
                  <td className={td}>{x.complete ? signedPoints(x.gainPoints) : 'Incomplete'}</td>
                  <td className={td}>{x.normalizedGain === null ? '–' : x.normalizedGain.toFixed(2)}</td>
                  <td className={td}>{x.classGainPoints === null ? '–' : signedPoints(x.classGainPoints)}</td>
                </tr>
              ))}
            </Table>
            {r.gain.some((x) => x.concepts.length > 0) && (
              <Table caption="Learning gain by concept" head={['Module', 'Concept', 'Pre', 'Post', 'Gain']}>
                {r.gain.flatMap((x) => x.concepts.map((c) => (
                  <tr key={`${x.moduleId}-${c.concept}`}>
                    <td className={td}>{x.module}</td><td className={td}>{c.concept}</td>
                    <td className={td}>{pct(c.prePct)}</td><td className={td}>{pct(c.postPct)}</td><td className={td}>{signedPoints(c.gainPoints)}</td>
                  </tr>
                )))}
              </Table>
            )}
          </>
        )}
        {r.pairs.length > 0 && (
          <>
            <h4 className="font-semibold">Question by question</h4>
            <ul className="flex flex-wrap gap-2" aria-label="Pre-test and post-test pairs">
              {(Object.keys(OUTCOME) as PairOutcome[]).map((o) => (
                <li key={o} className="rounded-md border px-3 py-1 text-sm">{OUTCOME[o]}: <span className="font-semibold">{r.pairCounts[o]}</span></li>
              ))}
            </ul>
            <Table caption="Each pre-test question and its matching post-test question" head={['Concept', 'Post-test question', 'Pre-test', 'Post-test', 'Result']}>
              {r.pairs.map((p) => (
                <tr key={`${p.module}-${p.pairKey}`}>
                  <td className={td}>{p.concept}</td><td className={td}>{p.prompt}</td>
                  <td className={td}>{p.pre === null ? '–' : p.pre ? 'Right' : 'Wrong'}</td>
                  <td className={td}>{p.post === null ? '–' : p.post ? 'Right' : 'Wrong'}</td>
                  <td className={`${td} font-medium`}>{OUTCOME[p.outcome]}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Section>

      {/* 5. Concept mastery */}
      <Section id="mastery" title="Concept mastery" intro="Share of scored tries answered right, per concept. The black line on each bar is the class average.">
        {r.mastery.length === 0 ? <Empty>No scored tries yet.</Empty> : (
          <Table caption="Concept mastery compared with the class" head={['Concept', 'Mastery', '', 'Class average', 'Tries', 'Reading']}>
            {r.mastery.map((m) => (
              <tr key={m.concept}>
                <td className={td}>{m.concept}</td>
                <td className={td}>{m.masteryPct}%</td>
                <td className={`${td} w-40`}><Bar value={m.masteryPct} marker={m.classAvgPct} tone={m.band === 'focus' ? 'warning' : m.band === 'strength' ? 'success' : 'primary'} /></td>
                <td className={td}>{pct(m.classAvgPct)}</td>
                <td className={td}>{m.attempts}</td>
                <td className={td}>{m.band === 'focus' ? 'Focus here' : m.band === 'strength' ? 'Strength' : 'OK'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {/* 6. Accuracy */}
      <Section id="accuracy" title="Accuracy and mistakes" intro={`${r.accuracy.totalAttempts} scored tries, ${r.accuracy.wrongAttempts} wrong. Videos and readings are not scored.`}>
        {r.accuracy.mostMissed.length === 0 ? <Empty>No wrong answers so far.</Empty> : (
          <Table caption="Most missed activities" head={['Activity', 'Wrong tries', 'All tries', 'Solved']}>
            {r.accuracy.mostMissed.map((m) => (
              <tr key={m.activity}><td className={td}>{m.activity}</td><td className={td}>{m.wrong}</td><td className={td}>{m.attempts}</td><td className={td}>{m.solved ? 'Yes' : 'Not yet'}</td></tr>
            ))}
          </Table>
        )}
        {r.accuracy.wrongChoices.length > 0 && (
          <Table caption="Wrong choices this student picked, most often first" head={['Activity', 'Question', 'Wrong choice picked', 'Times']}>
            {r.accuracy.wrongChoices.map((w, i) => (
              <tr key={i}><td className={td}>{w.activity}</td><td className={td}>{w.prompt}</td><td className={td}>{w.choice}</td><td className={td}>{w.times}</td></tr>
            ))}
          </Table>
        )}
      </Section>

      {/* 7. Engagement */}
      <Section id="engagement" title="Engagement" intro="When this student works, and where they spend their time.">
        <p className="text-sm">
          {r.engagement.activeDays} active day{r.engagement.activeDays === 1 ? '' : 's'} · longest streak {r.engagement.longestStreak} day{r.engagement.longestStreak === 1 ? '' : 's'} · first active {shortDate(r.engagement.firstActiveAt)} · {duration(r.engagement.totalTimeS)} on task
        </p>
        <ActivityCalendar days={r.engagement.calendar} />
        {r.engagement.slowActivities.length > 0 && (
          <Table caption="Activities that took over twice the class median" head={['Activity', 'This student', 'Class median']}>
            {r.engagement.slowActivities.map((s) => (
              <tr key={s.activity}><td className={td}>{s.activity}</td><td className={td}>{duration(s.timeS)}</td><td className={td}>{duration(s.classMedianS)}</td></tr>
            ))}
          </Table>
        )}
      </Section>

      {/* 8. Hints */}
      <Section id="hints" title="Hints" intro="Which concepts and activities this student asked for help on.">
        {r.hints.total === 0 ? <Empty>No hints used.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2">
            <Table caption="Hints by concept" head={['Concept', 'Hints']}>
              {r.hints.byConcept.map((h) => <tr key={h.concept}><td className={td}>{h.concept}</td><td className={td}>{h.count}</td></tr>)}
            </Table>
            <Table caption="Hints by activity" head={['Activity', 'Hints']}>
              {r.hints.byActivity.map((h) => <tr key={h.activity}><td className={td}>{h.activity}</td><td className={td}>{h.count}</td></tr>)}
            </Table>
          </div>
        )}
      </Section>

      {/* 9. Struggles */}
      <Section id="struggles" title="Struggles" intro="Stuck now: 3 wrong tries, over 10 minutes on one activity, or 3 school days without activity.">
        {r.struggles.current.length === 0 && r.struggles.past.length === 0 ? <Empty>No struggles recorded.</Empty> : (
          <ul className="flex flex-col gap-2">
            {r.struggles.current.map((s, i) => (
              <li key={`now-${i}`} className="rounded-lg border border-destructive/40 p-3"><span className="font-semibold">Stuck now:</span> {s.activity} ({s.reasons.join(', ')})</li>
            ))}
            {r.struggles.past.map((s) => (
              <li key={`past-${s.activity}`} className="rounded-lg border p-3"><span className="font-semibold">Earlier:</span> {s.activity}, {s.wrong} wrong tries{s.solved ? ', then solved it' : ', not solved yet'}</li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  )
}
