// @vitest-environment node
// Every relative link in the markdown files must point at something that exists. Judges and new
// teammates read these files first, so a dead link is a bug.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const SKIP = new Set(['node_modules', '.git', 'dist', '.wrangler'])
// docs/progress.md is an append-only log: old entries may name files that were later renumbered.
const APPEND_ONLY = /docs[\\/]progress\.md$/

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) markdownFiles(path, out)
    else if (name.endsWith('.md')) out.push(path)
  }
  return out
}

/** Link targets in a markdown file, ignoring fenced code blocks and external or anchor-only links. */
function relativeLinks(text: string): string[] {
  const withoutCode = text.replace(/```[\s\S]*?```/g, '')
  const targets = [...withoutCode.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]!)
  return targets
    .map((t) => t.replace(/^<|>$/g, ''))
    .filter((t) => !/^([a-z]+:|#|\/\/)/i.test(t))
    .map((t) => decodeURIComponent(t.split('#')[0]!))
    .filter(Boolean)
}

describe('markdown links', () => {
  const files = markdownFiles(root).filter((f) => !APPEND_ONLY.test(f))

  it('finds the documents', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('every relative link resolves to a file or folder', () => {
    const broken: string[] = []
    for (const file of files) {
      for (const target of relativeLinks(readFileSync(file, 'utf8'))) {
        const path = target.startsWith('/') ? join(root, target) : resolve(dirname(file), target)
        if (!existsSync(path)) broken.push(`${relative(root, file)} -> ${target}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('has no em dashes in the docs we wrote', () => {
    const names = new Set(['SECURITY.md', 'README.md', 'deploy.md'])
    const wrote = files.filter((f) => names.has(basename(f)) && !f.includes('node_modules'))
    const offenders = wrote.filter((f) => readFileSync(f, 'utf8').includes('\u2014')).map((f) => relative(root, f))
    expect(offenders).toEqual([])
  })
})
