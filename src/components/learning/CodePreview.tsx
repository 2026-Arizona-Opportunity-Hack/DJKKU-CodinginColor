import { Reading } from './ActivityContent'

export type CodeContent = { prompt: string; starter: string; predict?: string | null; tests: string[] }

/** Read-only view of a code activity (studio preview, reviewer): what the student is asked, and the checks. */
export function CodePreview({ content }: { content: CodeContent }) {
  return (
    <div className="flex flex-col gap-3">
      {content.prompt.trim() ? <Reading markdown={content.prompt} /> : <p>Write the task to preview it.</p>}
      {content.predict?.trim() && (
        <p>
          <span className="font-medium">1. Predict: </span>
          {content.predict}
        </p>
      )}
      <figure>
        <figcaption className="mb-1 text-sm font-medium">Starter code (Python)</figcaption>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm whitespace-pre">{content.starter || '(empty: the student starts from a blank editor)'}</pre>
      </figure>
      <div>
        <p className="text-sm font-medium">Checks the student must pass ({content.tests.length})</p>
        {content.tests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checks: the activity completes after any run.</p>
        ) : (
          <ul className="list-disc pl-5">
            {content.tests.map((t, i) => (
              <li key={`${t}-${i}`}>
                <code className="font-mono text-sm">{t}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
