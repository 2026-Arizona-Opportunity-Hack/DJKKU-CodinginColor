// @vitest-environment jsdom
import '@/features/auth/test/setup'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VideoTranscript } from './VideoTranscript'
import { activeIndex, groupParagraphs, timestamp } from './transcriptApi'

const VIDEO = 'Z1Yd7upQsXY'
const fetchMock = vi.fn<typeof fetch>()
const SEGMENTS = [
  { start_ms: 0, text: 'Hey everyone, my name is YK.' },
  { start_ms: 2500, text: 'A variable is a name for a value.' },
  { start_ms: 6000, text: "It's like a labelled box." },
  { start_ms: 65_000, text: 'Now let us try it in Python.' },
]
const ok = () => Response.json({ video_id: VIDEO, lang: 'en', source: 'cache', segments: SEGMENTS })

function renderTranscript(props: Partial<Parameters<typeof VideoTranscript>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { networkMode: 'always' } } })
  const view = (p: typeof props) => (
    <QueryClientProvider client={client}>
      <VideoTranscript videoId={VIDEO} {...p} />
    </QueryClientProvider>
  )
  const utils = render(view(props))
  return { ...utils, update: (p: typeof props) => utils.rerender(view(p)) }
}
const open = () => userEvent.click(screen.getByText('Read the transcript'))
const scrollTo = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  scrollTo.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
})
afterEach(() => vi.unstubAllGlobals())

describe('VideoTranscript', () => {
  it('fetches nothing until the student opens it', () => {
    renderTranscript({ fallback: 'Summary' })
    expect(screen.getByText('Read the transcript')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the real transcript in a keyboard-scrollable box that cannot stretch the page', async () => {
    fetchMock.mockResolvedValue(ok())
    const { container } = renderTranscript({ fallback: 'Short summary', onSeek: vi.fn() })
    await open()
    expect(await screen.findByText(/A variable is a name for a value\./)).toBeInTheDocument()
    const box = screen.getByRole('region', { name: 'Video transcript' })
    expect(box).toHaveAttribute('tabindex', '0')
    // The page-length bug: an absolutely positioned child escaped a box that was not `relative`.
    expect(box.className).toMatch(/\brelative\b/)
    expect(box.className).toMatch(/\bmax-h-80\b/)
    expect(box.querySelector('.sr-only')).toBeNull()
    expect(screen.queryByText('Short summary')).toBeNull()
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`/api/transcript?videoId=${VIDEO}`)
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  })

  it('highlights the line being spoken and scrolls only the transcript box to it', async () => {
    fetchMock.mockResolvedValue(ok())
    const { update } = renderTranscript({ timeMs: 0, playing: false })
    await open()
    await screen.findByText(/labelled box/)
    expect(document.querySelector('[aria-current="true"]')).toBeNull() // nothing before the video starts

    update({ timeMs: 3000, playing: true })
    expect(document.querySelector('[aria-current="true"]')).toHaveTextContent('A variable is a name for a value.')
    expect(screen.getByText(/Following the video/)).toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalled()
    expect(scrollTo.mock.contexts.at(-1)).toBe(screen.getByRole('region', { name: 'Video transcript' })) // the box, not window

    update({ timeMs: 66_000, playing: true })
    expect(document.querySelector('[aria-current="true"]')).toHaveTextContent('Now let us try it in Python.')
  })

  it('pauses following when the student scrolls, and resumes on "Back to the current line"', async () => {
    fetchMock.mockResolvedValue(ok())
    const { update } = renderTranscript({ timeMs: 3000, playing: true })
    await open()
    await screen.findByText(/labelled box/)
    fireEvent.wheel(screen.getByRole('region', { name: 'Video transcript' }))
    const back = screen.getByRole('button', { name: 'Back to the current line' })
    scrollTo.mockClear()
    update({ timeMs: 7000, playing: true })
    expect(scrollTo).not.toHaveBeenCalled() // paused: the student is reading elsewhere
    await userEvent.click(back)
    expect(scrollTo).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Back to the current line' })).toBeNull()
  })

  it('timestamps jump the video to that moment', async () => {
    fetchMock.mockResolvedValue(ok())
    const onSeek = vi.fn()
    renderTranscript({ onSeek })
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Play from 1:05' }))
    expect(onSeek).toHaveBeenCalledWith(65_000)
  })

  it("falls back to the teacher's summary when the transcript is unavailable", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'transcript_unavailable' }, { status: 404 }))
    renderTranscript({ fallback: 'A variable is a name that points to a value.' })
    await open()
    expect(await screen.findByText(/Here is your teacher's summary/)).toBeInTheDocument()
    expect(screen.getByText('A variable is a name that points to a value.')).toBeInTheDocument()
  })

  it('points to the captions when there is no transcript and no summary', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'unavailable' }, { status: 503 }))
    renderTranscript()
    await open()
    expect(await screen.findByText(/Turn on captions \(CC\)/)).toBeInTheDocument()
  })

  it('treats the dev server answering with the app page (no /api there) as unavailable, not a crash', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }))
    renderTranscript({ fallback: 'Summary text' })
    await open()
    expect(await screen.findByText('Summary text')).toBeInTheDocument()
  })
})

describe('transcript helpers', () => {
  it.each([[0, '0:00'], [1200, '0:01'], [65_000, '1:05'], [3_723_000, '1:02:03']])('timestamp(%i) is %s', (ms, want) => {
    expect(timestamp(ms)).toBe(want)
  })

  it('groups caption lines into paragraphs without splitting a line, numbering lines in order', () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({ start_ms: i * 1000, text: 'x'.repeat(100) }))
    const paragraphs = groupParagraphs(lines, 320)
    expect(paragraphs.map((p) => p.lines.length)).toEqual([3, 3, 3, 1])
    expect(paragraphs[1]!.start_ms).toBe(3000)
    expect(paragraphs.flatMap((p) => p.lines.map((l) => l.index))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('starts a new paragraph after 30 seconds of video, so a timestamp is never far from its lines', () => {
    const lines = [{ start_ms: 0, text: 'a' }, { start_ms: 20_000, text: 'b' }, { start_ms: 31_000, text: 'c' }, { start_ms: 65_000, text: 'd' }]
    expect(groupParagraphs(lines).map((p) => p.start_ms)).toEqual([0, 31_000, 65_000])
  })

  it('finds the line being spoken (the last one that has started)', () => {
    const s = [{ start_ms: 1000 }, { start_ms: 4000 }, { start_ms: 9000 }]
    expect(activeIndex(s, 0)).toBe(-1)
    expect(activeIndex(s, 1000)).toBe(0)
    expect(activeIndex(s, 8999)).toBe(1)
    expect(activeIndex(s, 60_000)).toBe(2)
  })
})
