// @vitest-environment jsdom
import '@/features/auth/test/setup'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { readPlayerMessage, useYouTubePlayer } from './useYouTubePlayer'

describe('readPlayerMessage', () => {
  it('reads the time (seconds -> ms) and whether the video is playing', () => {
    expect(readPlayerMessage(JSON.stringify({ event: 'infoDelivery', info: { currentTime: 12.34, playerState: 1 } }))).toEqual({ timeMs: 12_340, playing: true })
    expect(readPlayerMessage(JSON.stringify({ event: 'infoDelivery', info: { playerState: 2 } }))).toEqual({ playing: false })
  })

  it.each([
    ['not a string', { event: 'infoDelivery', info: { currentTime: 1 } }],
    ['not JSON', 'hello'],
    ['another event', JSON.stringify({ event: 'onReady', info: { currentTime: 1 } })],
    ['a bad time', JSON.stringify({ event: 'infoDelivery', info: { currentTime: -5 } })],
  ])('ignores %s', (_label, data) => {
    expect(readPlayerMessage(data)).toBeNull()
  })
})

function Probe() {
  const { frame, onLoad, seek, timeMs, playing } = useYouTubePlayer()
  return (
    <>
      <iframe ref={frame} onLoad={onLoad} title="video" src="https://www.youtube-nocookie.com/embed/Z1Yd7upQsXY?enablejsapi=1" />
      <p data-testid="time">{timeMs}</p>
      <p data-testid="playing">{String(playing)}</p>
      <button type="button" onClick={() => seek(65_000)}>seek</button>
    </>
  )
}
const deliver = (source: MessageEventSource | null, origin: string, currentTime: number) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { source, origin, data: JSON.stringify({ event: 'infoDelivery', info: { currentTime, playerState: 1 } }) }))
  })

describe('useYouTubePlayer', () => {
  it('follows the time reported by its own YouTube frame', () => {
    render(<Probe />)
    const frame = screen.getByTitle('video') as HTMLIFrameElement
    deliver(frame.contentWindow, 'https://www.youtube-nocookie.com', 7.5)
    expect(screen.getByTestId('time')).toHaveTextContent('7500')
    expect(screen.getByTestId('playing')).toHaveTextContent('true')
  })

  it('ignores messages from other origins or other windows (no spoofing the player)', () => {
    render(<Probe />)
    const frame = screen.getByTitle('video') as HTMLIFrameElement
    deliver(frame.contentWindow, 'https://evil.example', 99)
    deliver(window, 'https://www.youtube-nocookie.com', 99)
    expect(screen.getByTestId('time')).toHaveTextContent('0')
  })

  it('repeats "listening" until the player answers (its script starts after the frame loads), then stops', () => {
    vi.useFakeTimers()
    try {
      render(<Probe />)
      const frame = screen.getByTitle('video') as HTMLIFrameElement
      const post = vi.spyOn(frame.contentWindow!, 'postMessage')
      act(() => frame.dispatchEvent(new Event('load')))
      act(() => vi.advanceTimersByTime(1600))
      const hellos = () => post.mock.calls.filter(([m]) => String(m).includes('"event":"listening"')).length
      expect(hellos()).toBe(4) // on load, then every 500 ms
      deliver(frame.contentWindow, 'https://www.youtube-nocookie.com', 1)
      const after = hellos()
      act(() => vi.advanceTimersByTime(5000))
      expect(hellos()).toBe(after) // answered: no more hellos
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks the player to report on load, and seeks with a command to the YouTube origin only', () => {
    render(<Probe />)
    const frame = screen.getByTitle('video') as HTMLIFrameElement
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    act(() => frame.dispatchEvent(new Event('load')))
    expect(post).toHaveBeenCalledWith(expect.stringContaining('"event":"listening"'), 'https://www.youtube-nocookie.com')
    act(() => screen.getByText('seek').click())
    expect(post).toHaveBeenCalledWith(expect.stringContaining('"func":"seekTo","args":[65,true]'), 'https://www.youtube-nocookie.com')
    expect(screen.getByTestId('time')).toHaveTextContent('65000')
  })
})
