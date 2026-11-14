/**
 * The app's one client logger.
 *
 * - Levels: debug < info < warn < error.
 * - Development: info and up go to the console. Production: warn and error only.
 * - Debug is off by default. Turn it on with `localStorage.debug = 'cic'` or `?debug=1`.
 * - Context is redacted: codes, answers, names, tokens and emails never reach the console.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogContext = Record<string, unknown>

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// Keys whose values must never be logged (matched case-insensitively, as substrings).
const REDACT_KEYS = [
  'code',
  'answer',
  'response',
  'name',
  'token',
  'password',
  'email',
  'secret',
  'authorization',
  'cookie',
  'text',
  'hint',
]
// Keys that look sensitive by substring but are safe diagnostics.
const SAFE_KEYS = new Set(['errorcode', 'status', 'requestid', 'event', 'duration_ms', 'path', 'method'])

function isDebugFlagOn(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true
    return window.localStorage.getItem('debug') === 'cic'
  } catch {
    return false // storage can throw in private mode; debug just stays off
  }
}

export function minLevel(): LogLevel {
  if (isDebugFlagOn()) return 'debug'
  return import.meta.env.DEV ? 'info' : 'warn'
}

function describeCause(cause: unknown): unknown {
  if (cause instanceof Error) return { name: cause.name, message: cause.message }
  return cause
}

export function redact(ctx: LogContext): LogContext {
  const out: LogContext = {}
  for (const [key, value] of Object.entries(ctx)) {
    const k = key.toLowerCase()
    if (!SAFE_KEYS.has(k) && REDACT_KEYS.some((r) => k.includes(r))) {
      out[key] = '[redacted]'
    } else if (key === 'cause') {
      out[key] = describeCause(value)
    } else {
      out[key] = value
    }
  }
  return out
}

function emit(level: LogLevel, event: string, ctx: LogContext = {}): void {
  if (ORDER[level] < ORDER[minLevel()]) return
  const record = { ts: new Date().toISOString(), level, event, ...redact(ctx) }
  const sink = level === 'debug' ? console.debug : console[level]
  sink(`[cic] ${event}`, record)
}

export const log = {
  debug: (event: string, ctx?: LogContext) => emit('debug', event, ctx),
  info: (event: string, ctx?: LogContext) => emit('info', event, ctx),
  warn: (event: string, ctx?: LogContext) => emit('warn', event, ctx),
  error: (event: string, ctx?: LogContext) => emit('error', event, ctx),
}

let installed = false
/** Global handlers for errors nothing else caught. Call once at startup. */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (e) => {
    log.error('app.unhandled_error', { cause: e.error ?? e.message })
  })
  window.addEventListener('unhandledrejection', (e) => {
    log.error('app.unhandled_rejection', { cause: e.reason })
  })
}
