import { describe, expect, it } from 'vitest'
import { extractBearerToken } from './apiKey'

describe('extractBearerToken', () => {
  it('reads a Bearer token', () => {
    expect(extractBearerToken('Bearer oh_abc123')).toBe('oh_abc123')
  })

  it('accepts any case for the scheme and extra spaces', () => {
    expect(extractBearerToken('bearer   oh_abc123 ')).toBe('oh_abc123')
  })

  it('rejects other schemes, empty values and missing headers', () => {
    expect(extractBearerToken('Basic abc')).toBeNull()
    expect(extractBearerToken('Bearer')).toBeNull()
    expect(extractBearerToken('Bearer a b')).toBeNull()
    expect(extractBearerToken('')).toBeNull()
    expect(extractBearerToken(null)).toBeNull()
    expect(extractBearerToken(undefined)).toBeNull()
  })
})
