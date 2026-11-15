import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTranscript, timestamp } from './transcriptApi'

/**
 * "Read the transcript": the video's real transcript (its YouTube captions, fetched by
 * /api/transcript through Supadata and cached server-side). It loads only when a student opens it,
 * so closed transcripts cost nothing. If it can't load (no captions, no key, offline, or local
 * `npm run dev`, which does not serve /api), the author's written summary is shown instead.
 */

export function VideoTranscript({ videoId, fallback }: { videoId: string; fallback?: string | null }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const transcript = useQuery({
    queryKey: ['video-transcript', videoId],
    queryFn: () => fetchTranscript(videoId),
    enabled: open,
    staleTime: Infinity, // captions don't change during a lesson
    retry: false, // the server already decided; a retry would only cost quota
    meta: { expectedFailure: true }, // "no transcript" is normal; fetchTranscript logs it at info
  })

  return (
    <details className="rounded-lg border bg-white p-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer content-center font-medium">Read the transcript</summary>
      <div className="mt-2" aria-live="polite">
        {open && transcript.isPending && <p role="status" className="text-muted-foreground">Loading the transcript…</p>}
        {transcript.isSuccess && (
          <ol
            id={`${id}-transcript`}
            aria-label="Video transcript"
            // Scrollable, so it must be focusable to scroll with the keyboard (axe: scrollable-region-focusable).
            tabIndex={0}
            className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-2 leading-relaxed"
          >
            {transcript.data.segments.map((s) => (
              <li key={`${s.start_ms}-${s.text.slice(0, 12)}`} className="grid grid-cols-[3.5rem_1fr] gap-2">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  <span className="sr-only">At </span>
                  {timestamp(s.start_ms)}
                </span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        )}
        {transcript.isError &&
          (fallback ? (
            <>
              <p className="text-sm text-muted-foreground">The full transcript isn't available right now. Here is your teacher's summary.</p>
              <p className="mt-2 whitespace-pre-line">{fallback}</p>
            </>
          ) : (
            <p>This video has no transcript yet. Turn on captions (CC) in the video player instead.</p>
          ))}
      </div>
    </details>
  )
}
