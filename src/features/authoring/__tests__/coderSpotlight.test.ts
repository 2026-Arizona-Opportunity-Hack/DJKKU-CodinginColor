import { describe, expect, it } from 'vitest'
import { coderSpotlight } from '../formTypes'

describe('Coder spotlight template', () => {
  it('the Coder spotlight template is an optional reading, clearly marked as a placeholder', () => {
    const a = coderSpotlight()
    expect(a).toMatchObject({ kind: 'reading', title: 'Coder spotlight', required: false })
    expect(a.body).toMatch(/^## Coder spotlight/)
    expect(a.body).toMatch(/Placeholder: replace every \[bracket\]/)
  })
})
