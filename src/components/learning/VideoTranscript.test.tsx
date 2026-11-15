// @vitest-environment jsdom
import '@/features/auth/test/setup'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VideoTranscript } from './VideoTranscript'
import { timestamp } from './transcriptApi'

const VIDEO = 'Z1Yd7upQsXY'
const fetchMock = vi.fn<typeof fetch>()

function renderTranscript(fallback?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { networkMode: 'always' } } })
  return render(
    <QueryClientProvider client={client}>
      <VideoTranscript videoId={VIDEO} fallback={fallback} />
    </QueryClientProvider>,
  )
}
const open = () => userEvent.click(screen.getByText('Read the transcript'))

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('VideoTranscript', () => {
  it('fetches nothing until the student opens it', () => {
    renderTranscript('Summary')
    expect(screen.getByText('Read the transcript')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the real transcript with timestamps, keyboard-scrollable, with no serious a11y issues', async () => {
    fetchMock.mockResolvedValue(Response.json({ video_id: VIDEO, lang: 'en', source: 'cache', segments: [
      { start_ms: 1200, text: 'A variable is a name for a value.' },
      { start_ms: 65_000, text: "It's like a labelled box." },
    ] }))
    const { container } = renderTranscript('Short summary')
    await open()
    expect(await screen.findByText('A variable is a name for a value.')).toBeInTheDocument()
    expect(screen.getByText('1:05')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Video transcript' })).toHaveAttribute('tabindex', '0')
    expect(screen.queryByText('Short summary')).toBeNull()
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`/api/transcript?videoId=${VIDEO}`)
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  })

  it("falls back to the teacher's summary when the transcript is unavailable", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'transcript_unavailable' }, { status: 404 }))
    renderTranscript('A variable is a name that points to a value.')
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
    renderTranscript('Summary text')
    await open()
    expect(await screen.findByText('Summary text')).toBeInTheDocument()
  })
})

describe('timestamp', () => {
  it.each([[0, '0:00'], [1200, '0:01'], [65_000, '1:05'], [3_723_000, '1:02:03']])('%i ms -> %s', (ms, want) => {
    expect(timestamp(ms)).toBe(want)
  })
})
