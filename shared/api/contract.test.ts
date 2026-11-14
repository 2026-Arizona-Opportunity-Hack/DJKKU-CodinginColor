import { describe, expect, it } from 'vitest'
import { API_SCOPES, MIN_GROUP_SIZE } from './types'

// docs/openapi.yaml is what CIC's dashboard owner reads. If the code changes, the
// contract must change with it, so these checks fail when they drift apart.
const files = import.meta.glob<string>('../../docs/openapi.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const openapi = Object.values(files)[0] ?? ''

describe('docs/openapi.yaml', () => {
  it('is found', () => {
    expect(openapi.length).toBeGreaterThan(500)
  })

  it('states the same minimum group size as the code, everywhere it says one', () => {
    const mentions = [...openapi.matchAll(/fewer than (\d+) students/g)].map((m) => Number(m[1]))
    expect(mentions.length).toBeGreaterThan(0)
    for (const n of mentions) expect(n).toBe(MIN_GROUP_SIZE)
  })

  it('documents every error code a client has to handle', () => {
    for (const code of ['unauthorized', 'forbidden', 'invalid_parameter', 'unavailable']) {
      expect(openapi).toContain(code)
    }
  })

  it('documents both endpoints, their query parameters and every key scope', () => {
    for (const path of ['/api/v1/completion', '/api/v1/learning-gain']) {
      expect(openapi).toContain(path)
    }
    for (const param of ['group_by', 'cohort', 'format']) expect(openapi).toContain(`name: ${param}`)
    for (const scope of API_SCOPES) expect(openapi).toContain(`\`${scope}\``)
  })
})
