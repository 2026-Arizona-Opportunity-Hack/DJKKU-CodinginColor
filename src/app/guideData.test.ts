import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { features } from './features'
import { allEntries, canUse, defaultRole, forRole, ROLE_ORDER, rolesOf, search } from './guideData'
import type { Me } from '@/lib/session'

const entries = allEntries(features)
const SHELL_PATHS = ['/', '/privacy', '/guide']
const INSTRUCTOR_GO = ['join-code', 'roster', 'assign', 'starting-point', 'dashboard', 'live', 'reteach', 'report']
const LEARN_GO = ['path', 'progress', 'notebook']
// The admin tabs that really exist, read from the page itself, so a guide link can never point at a missing tab.
const ADMIN_TABS = [...readFileSync(new URL('../features/admin/AdminPage.tsx', import.meta.url), 'utf8').matchAll(/\{ path: '([a-z-]+)', label:/g)].map((m) => m[1]!)
const me = (role: Me['role'], can_author = false) => ({ role, can_author, profile_id: 'p', display_name: 'X', class_id: null, class_name: null }) as Me

describe('guide entries', () => {
  it('have unique ids', () => {
    const ids = entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('read the real admin tabs', () => {
    expect(ADMIN_TABS).toEqual(expect.arrayContaining(['publish', 'overview', 'staff', 'keys']))
  })

  it('link only to real screens', () => {
    for (const e of entries) {
      if (e.external) { expect(e.to).toBe('/api/docs/'); continue }
      const path = e.to.split('#')[0]!
      const owner = features.find((f) => [f.path, ...(f.extraPaths ?? [])].some((p) => path === p || path.startsWith(`${p}/`)))
      expect(owner || SHELL_PATHS.includes(path), `${e.id} -> ${e.to}`).toBeTruthy()
      const ig = /^\/instructor\/go\/(.+)$/.exec(path)?.[1]
      if (ig) expect(INSTRUCTOR_GO, e.id).toContain(ig)
      const lg = /^\/learn\/go\/(.+)$/.exec(path)?.[1]
      if (lg) expect(LEARN_GO, e.id).toContain(lg)
      const at = /^\/admin\/(.+)$/.exec(path)?.[1]
      if (at) expect(ADMIN_TABS, e.id).toContain(at)
    }
  })

  it('give every role something, with first steps numbered 1, 2, 3 without gaps', () => {
    for (const role of ROLE_ORDER) {
      const { steps, groups } = forRole(entries, role)
      expect(steps.length + groups.length, role).toBeGreaterThan(0)
      expect(steps.map((s) => s.step), role).toEqual(steps.map((_, i) => i + 1))
    }
  })

  it('have short, plain text with no em dashes', () => {
    for (const e of entries) {
      expect(e.summary.length, e.id).toBeLessThan(160)
      expect(`${e.title} ${e.summary} ${e.howTo ?? ''}`).not.toContain('\u2014')
    }
  })
})

describe('group order', () => {
  it('puts the role work before the general groups', () => {
    const names = forRole(entries, 'author').groups.map((g) => g.name)
    expect(names.indexOf('Build a module')).toBeLessThan(names.indexOf('About this site'))
    expect(names.at(-1)).toMatch(/Get in|About this site/)
  })
})

describe('roles', () => {
  it('maps each account to the guide roles it can use', () => {
    expect(rolesOf(null)).toEqual(['visitor'])
    expect(rolesOf(me('independent_student'))).toEqual(['student'])
    expect(rolesOf(me('instructor'))).toEqual(['instructor'])
    expect(rolesOf(me('instructor', true))).toEqual(['instructor', 'author'])
    expect(rolesOf(me('cic_admin'))).toEqual(['cic_admin', 'instructor', 'author', 'reviewer'])
    expect(rolesOf(me('mentor'))).toEqual(['visitor']) // no mentor screens in this version
    expect(defaultRole(me('reviewer'))).toBe('reviewer')
    const draft = entries.find((e) => e.id === 'draft-tests')!
    expect(canUse(draft, rolesOf(me('instructor')))).toBe(false)
    expect(canUse(draft, rolesOf(me('instructor', true)))).toBe(true)
  })
})

describe('search', () => {
  it('finds features by any word in the title, summary or how-to, across roles', () => {
    expect(search(entries, 'notes').map((e) => e.id)).toEqual(expect.arrayContaining(['notes', 'notebook']))
    expect(search(entries, 'AI tests').map((e) => e.id)).toContain('draft-tests')
    expect(search(entries, 'reteach').map((e) => e.id)).toEqual(['reteach'])
    expect(search(entries, '   ')).toEqual([])
  })
})
