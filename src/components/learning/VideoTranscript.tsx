import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'

import { activeIndex, fetchTranscript, groupParagraphs, timestamp, type Paragraph } from './transcriptApi'

/**
 * "Read the transcript": the video's real transcript (its YouTube captions, fetched by
 * /api/transcript through Supadata and cached server-side), following the video as it plays.
 * - Loads only when opened, so closed transcripts cost nothing.
 * - The line being spoken is highlighted and kept in view by scrolling THIS box, never the page.
 * - Scrolling the transcript yourself pauses following; "Back to the current line" resumes it.
 * - Timestamps jump the video to that moment.
 * If it can't load (no captions, no key, offline, or `npm run dev`, which does not serve /api),
 * the author's written summary is shown instead.
 */

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

const ParagraphView = memo(function ParagraphView({ p, active, onSeek }: { p: Paragraph; active: number; onSeek?: (ms: number) => void }) {
  const at = timestamp(p.start_ms)
  return (
    <div className="grid grid-cols-[3.75rem_1fr] items-start gap-2">
      {onSeek ? (
        <button
          type="button"
          onClick={() => onSeek(p.start_ms)}
          aria-label={`Play from ${at}`}
          className="min-h-11 rounded-md px-1 text-left font-mono text-sm tabular-nums text-primary underline-offset-2 hover:underline"
        >
          {at}
        </button>
      ) : (
        <span className="min-h-11 content-center font-mono text-sm tabular-nums text-muted-foreground">{at}</span>
      )}
      <p className="py-2.5">
        {p.lines.map((l) => (
          <span
            key={l.index}
            data-line={l.index}
            aria-current={l.index === active ? 'true' : undefined}
            className={l.index === active ? 'rounded bg-tint-yellow px-0.5 text-foreground ring-1 ring-tint-yellow-edge' : undefined}
          >
            {l.text}{' '}
          </span>
        ))}
      </p>
    </div>
  )
})

export function VideoTranscript({
  videoId,
  fallback,
  timeMs = 0,
  playing = false,
  onSeek,
}: {
  videoId: string
  fallback?: string | null
  /** Where the video is now, from the embed (useYouTubePlayer). */
  timeMs?: number
  playing?: boolean
  onSeek?: (ms: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [follow, setFollow] = useState(true)
  const box = useRef<HTMLDivElement>(null)
  const transcript = useQuery({
    queryKey: ['video-transcript', videoId],
    queryFn: () => fetchTranscript(videoId),
    enabled: open,
    staleTime: Infinity, // captions don't change during a lesson
    retry: false, // the server already decided; a retry would only cost quota
    meta: { expectedFailure: true }, // "no transcript" is normal; fetchTranscript logs it at info
  })
  const segments = transcript.data?.segments
  const paragraphs = useMemo(() => (segments ? groupParagraphs(segments) : []), [segments])
  // Nothing is highlighted until the video has started.
  const active = segments && (playing || timeMs > 0) ? activeIndex(segments, timeMs) : -1
  // Only the paragraph holding the current line re-renders as the video plays.
  const activeParagraph = paragraphs.findIndex((p) => p.lines.some((l) => l.index === active))

  // Keep the current line about a third of the way down the box. Scrolls the box only, never the page.
  useEffect(() => {
    const el = box.current
    const line = el?.querySelector<HTMLElement>(`[data-line="${active}"]`)
    if (!open || !follow || !el || !line) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: Math.max(0, line.offsetTop - el.clientHeight / 3), behavior: reduce ? 'auto' : 'smooth' })
  }, [active, follow, open])

  const pauseFollowing = () => {
    if (follow && active >= 0) setFollow(false)
  }

  return (
    <details className="rounded-lg border bg-white p-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer content-center font-medium">Read the transcript</summary>
      <div className="mt-2">
        {open && transcript.isPending && <p role="status" className="text-muted-foreground">Loading the transcript…</p>}
        {transcript.isSuccess && (
          <>
            <div
              ref={box}
              role="region"
              aria-label="Video transcript"
              // Scrollable, so it must be focusable to scroll with the keyboard (axe: scrollable-region-focusable).
              tabIndex={0}
              // `relative` makes this the positioning box for its lines: offsetTop is measured from here, and
              // nothing inside can stretch the page (an absolutely positioned child once made it 21,000 px tall).
              className="relative flex max-h-80 flex-col gap-1 overflow-y-auto overscroll-contain pr-2 leading-relaxed"
              onWheel={pauseFollowing}
              onTouchMove={pauseFollowing}
              onKeyDown={(e) => {
                if (SCROLL_KEYS.has(e.key)) pauseFollowing()
              }}
            >
              {paragraphs.map((p, i) => (
                <ParagraphView key={p.start_ms} p={p} active={i === activeParagraph ? active : -1} onSeek={onSeek} />
              ))}
            </div>
            <div className="mt-2 flex min-h-11 flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {!follow && active >= 0 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setFollow(true)}>
                  Back to the current line
                </Button>
              ) : (
                <span>{playing ? 'Following the video.' : 'Play the video and the transcript follows along.'} Scroll the transcript to pause.</span>
              )}
            </div>
          </>
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
