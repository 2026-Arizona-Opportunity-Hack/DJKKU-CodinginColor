import { useCallback, useEffect, useRef, useState } from 'react'

// The player script inside the frame starts after the frame's load event, so a single "listening"
// can arrive before anyone is there. Like YouTube's own API, repeat it until the player answers.
const HANDSHAKE_EVERY_MS = 500
const HANDSHAKE_TRIES = 30

/**
 * The current time of an embedded YouTube video, without loading YouTube's JS API: the embed gets
 * `enablejsapi=1`, we post {"event":"listening"} to the frame, and YouTube posts back
 * "infoDelivery" messages with `currentTime` and `playerState` while the video plays.
 * Only messages from THIS frame and from a YouTube origin are read; everything else is ignored.
 */
const YOUTUBE_ORIGINS = new Set(['https://www.youtube-nocookie.com', 'https://www.youtube.com'])
const PLAYING = 1

export type PlayerState = { timeMs: number; playing: boolean }

export function readPlayerMessage(data: unknown): Partial<PlayerState> | null {
  if (typeof data !== 'string') return null
  let msg: unknown
  try {
    msg = JSON.parse(data)
  } catch {
    return null
  }
  if (!msg || typeof msg !== 'object') return null
  const { event, info } = msg as { event?: unknown; info?: unknown }
  if ((event !== 'infoDelivery' && event !== 'initialDelivery') || !info || typeof info !== 'object') return null
  const { currentTime, playerState } = info as { currentTime?: unknown; playerState?: unknown }
  const out: Partial<PlayerState> = {}
  if (typeof currentTime === 'number' && Number.isFinite(currentTime) && currentTime >= 0) out.timeMs = Math.round(currentTime * 1000)
  if (typeof playerState === 'number') out.playing = playerState === PLAYING
  return Object.keys(out).length ? out : null
}

export function useYouTubePlayer() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<PlayerState>({ timeMs: 0, playing: false })
  const connected = useRef(false)
  const handshake = useRef<ReturnType<typeof setInterval> | null>(null)

  const post = useCallback((message: object) => {
    const target = frame.current?.contentWindow
    const origin = frame.current ? new URL(frame.current.src).origin : null
    if (target && origin && YOUTUBE_ORIGINS.has(origin)) target.postMessage(JSON.stringify(message), origin)
  }, [])

  const stopHandshake = useCallback(() => {
    if (handshake.current) clearInterval(handshake.current)
    handshake.current = null
  }, [])

  // Ask the player to report its time, repeating until it answers (see HANDSHAKE_EVERY_MS).
  const onLoad = useCallback(() => {
    stopHandshake()
    connected.current = false
    let tries = 0
    const hello = () => {
      if (connected.current || ++tries > HANDSHAKE_TRIES) return stopHandshake()
      post({ event: 'listening', id: 'cic-transcript', channel: 'widget' })
    }
    hello()
    handshake.current = setInterval(hello, HANDSHAKE_EVERY_MS)
  }, [post, stopHandshake])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !YOUTUBE_ORIGINS.has(e.origin)) return
      const next = readPlayerMessage(e.data)
      if (!next) return
      connected.current = true
      stopHandshake()
      setState((s) => ({ ...s, ...next }))
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      stopHandshake()
    }
  }, [stopHandshake])

  /** Jump the video to `ms` and play from there (used by the transcript's timestamps). */
  const seek = useCallback(
    (ms: number) => {
      post({ event: 'command', func: 'seekTo', args: [ms / 1000, true] })
      post({ event: 'command', func: 'playVideo', args: [] })
      setState((s) => ({ ...s, timeMs: ms }))
    },
    [post],
  )

  return { frame, onLoad, seek, ...state }
}
