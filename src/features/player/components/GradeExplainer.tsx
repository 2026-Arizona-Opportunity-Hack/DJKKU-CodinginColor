import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { GraduationCap } from 'lucide-react'

import { Reading } from '@/components/learning/ActivityContent'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useStudentApi } from '../apiContext'
import { describeError } from '../errors'
import { InlineError } from './InlineError'

const GRADE_KEY = 'cic.grade'
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

// The grade is a reading-level setting for this device only: it is never sent anywhere except with the
// request to rewrite a lesson, and never stored in the database.
function savedGrade(): number | '' {
  try {
    const g = Number(window.localStorage.getItem(GRADE_KEY))
    return g >= 1 && g <= 12 ? g : ''
  } catch {
    return ''
  }
}

/**
 * "Explain it for my grade": the reading or video rewritten for grade 1 to 12, following the grade
 * rubric (shared/simplify/rubric.ts): simpler words, shorter sentences and everyday examples for young
 * students; precise terms and real-world uses for older ones. The original stays above it.
 */
export function GradeExplainer({ activityId }: { activityId: string }) {
  const id = useId()
  const api = useStudentApi()
  const [grade, setGrade] = useState<number | ''>(savedGrade)
  const [showAnswer, setShowAnswer] = useState(false)
  const explain = useMutation({ mutationFn: (g: number) => api.simplify(activityId, g), onMutate: () => setShowAnswer(false) })
  const r = explain.data

  function choose(value: string) {
    const g = value === '' ? '' : Number(value)
    setGrade(g)
    try {
      if (g === '') window.localStorage.removeItem(GRADE_KEY)
      else window.localStorage.setItem(GRADE_KEY, String(g))
    } catch { /* private mode: just not remembered */ }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 id={`${id}-h`} className="flex items-center gap-2 text-lg font-semibold">
        <GraduationCap aria-hidden="true" className="size-5" /> Explain it for my grade
      </h2>
      <p className="text-sm text-muted-foreground">Hard to follow? Get this lesson in words and examples for your grade.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-grade`}>My grade</Label>
          <select id={`${id}-grade`} value={grade} onChange={(e) => choose(e.target.value)} className="min-h-11 rounded-md border bg-background px-3 py-2">
            <option value="">Choose your grade</option>
            {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <Button type="button" disabled={grade === '' || explain.isPending} onClick={() => grade !== '' && explain.mutate(grade)}>
          {explain.isPending ? `Writing it for grade ${grade}…` : r && r.grade === grade ? 'Explain it again' : 'Explain it'}
        </Button>
      </div>

      <div aria-live="polite">
        {explain.isError && <InlineError error={describeError(explain.error)} />}
        {r && (
          <article aria-labelledby={`${id}-for`} className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
            <h3 id={`${id}-for`} className="font-semibold">For grade {r.grade}</h3>
            <p className="font-medium">{r.summary}</p>
            <Reading markdown={r.explanation} />
            <div>
              <h4 className="font-semibold">Example</h4>
              <Reading markdown={r.example} />
            </div>
            {r.keyTerms.length > 0 && (
              <div>
                <h4 className="font-semibold">Words to know</h4>
                <dl className="flex flex-col gap-1">
                  {r.keyTerms.map((t) => (
                    <div key={t.term}>
                      <dt className="inline font-medium">{t.term}: </dt>
                      <dd className="inline">{t.meaning}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="flex flex-col items-start gap-1">
              <h4 className="font-semibold">Check yourself</h4>
              <p>{r.checkQuestion.question}</p>
              <Button type="button" variant="outline" size="sm" aria-expanded={showAnswer} onClick={() => setShowAnswer((s) => !s)}>
                {showAnswer ? 'Hide the answer' : 'Show the answer'}
              </Button>
              {showAnswer && <p className="text-sm">{r.checkQuestion.answer}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              {r.source === 'demo' ? 'Sample in demo mode.' : 'Rewritten by AI from this lesson.'} If something here does not match the lesson above, trust the lesson.
            </p>
          </article>
        )}
      </div>
    </section>
  )
}
