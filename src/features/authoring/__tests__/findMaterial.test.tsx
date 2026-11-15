// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchResponse, SourceResult } from '@shared/sources/catalog'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({
  listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(),
  searchSources: vi.fn(), importReadme: vi.fn(),
}))
vi.mock('../api', () => ({
  listMyModules: m.listMyModules, loadModule: m.loadModule, saveDraft: m.saveDraft, newVersion: m.newVersion,
  listConcepts: m.listConcepts, upsertConcept: m.upsertConcept,
}))
vi.mock('../sourcesApi', () => ({ searchSources: m.searchSources, importReadme: m.importReadme }))
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'cic_admin', can_author: false }, isPending: false }), isDemoMode: () => false }))

const ID = '30000000-0000-4000-8000-000000000001'
const VIDEO: SourceResult = {
  source: 'youtube', kind: 'video', id: 'dQw4w9WgXcQ', title: 'For loops in 5 minutes', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', by: 'Code Club',
  description: 'Loops, step by step.', license: { id: 'CC-BY', name: 'Creative Commons (CC BY)', open: true }, durationS: 300, stars: null,
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: null,
}
const REPO: SourceResult = {
  source: 'github', kind: 'reading', id: 'cic/loops', title: 'cic/loops', url: 'https://github.com/cic/loops', by: 'cic',
  description: 'Practice loops', license: { id: 'MIT', name: 'MIT License', open: true }, durationS: null, stars: 1234, thumbnail: null, publishedAt: null,
}
const FOUND: SearchResponse = { results: [VIDEO, REPO], problems: [{ source: 'cs50', error: 'not_configured' }] }

const module = () => ({
  id: ID, slug: 'loops', version: 1, keysHidden: false, pre: null, post: null,
  module: { title: 'Loops', summary: '', status: 'draft', lessons: [{ title: 'For loops', activities: [{ kind: 'reading', title: 'Intro', required: true, body: 'Hi' }] }] },
})

async function openPanel() {
  const view = renderAt(<AuthoringPage />, { url: `/author/${ID}` })
  await userEvent.click(await screen.findByRole('button', { name: 'Find material' }))
  return { ...view, panel: screen.getByRole('region', { name: 'Find material for lesson 1' }) }
}
const titles = () => screen.getAllByLabelText('Title').map((e) => (e as HTMLInputElement).value)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  m.listConcepts.mockResolvedValue([])
  m.loadModule.mockResolvedValue(module())
  m.searchSources.mockResolvedValue(FOUND)
})

describe('find material', () => {
  it('opens under a lesson with the lesson title as the topic, and Enter searches instead of saving', async () => {
    const { panel } = await openPanel()
    expect(screen.getByRole('button', { name: 'Find material' })).toHaveAttribute('aria-expanded', 'true')
    const topic = within(panel).getByLabelText('Topic')
    expect(topic).toHaveValue('For loops')
    await userEvent.selectOptions(within(panel).getByLabelText('Programming language'), 'python')
    await userEvent.selectOptions(within(panel).getByLabelText('Language of the material'), 'es')
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'freeCodeCamp (YouTube)' }))
    await userEvent.type(topic, '{Enter}')
    await waitFor(() => expect(m.searchSources).toHaveBeenCalledTimes(1))
    expect(m.searchSources.mock.calls[0]![0]).toEqual({
      topic: 'For loops', sources: ['youtube', 'freecodecamp', 'github'], spokenLanguage: 'es', programmingLanguage: 'python', creativeCommonsOnly: false,
    })
    expect(m.saveDraft).not.toHaveBeenCalled()
  })

  it('checks the search before sending it', async () => {
    const { panel } = await openPanel()
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'YouTube' }))
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'GitHub (READMEs as readings)' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    expect(within(panel).getByRole('alert')).toHaveTextContent('Pick at least one source.')
    expect(m.searchSources).not.toHaveBeenCalled()
  })

  it('shows results by source with their license, and says which sources could not answer', async () => {
    const { panel, container } = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    expect(await within(panel).findByRole('status')).toHaveTextContent('Found 2 results.')
    const youtube = within(panel).getByRole('region', { name: 'YouTube (1)' })
    expect(within(youtube).getByRole('link', { name: 'For loops in 5 minutes (opens in a new tab)' })).toHaveAttribute('target', '_blank')
    expect(within(youtube).getByText('Code Club · 5 min')).toBeInTheDocument()
    expect(within(youtube).getByText('Creative Commons (CC BY)')).toBeInTheDocument()
    const github = within(panel).getByRole('region', { name: 'GitHub (READMEs as readings) (1)' })
    expect(within(github).getByText('cic · 1,234 stars')).toBeInTheDocument()
    expect(within(github).getByText('MIT License')).toBeInTheDocument()
    expect(within(panel).getByText(/Harvard CS50 \(YouTube\): not set up on this site yet/)).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('adds a video to the lesson draft, and it saves like any other video', async () => {
    m.saveDraft.mockResolvedValue(ID)
    const { panel } = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    await userEvent.click(await within(panel).findByRole('button', { name: 'Add as video: For loops in 5 minutes' }))
    expect(within(panel).getByRole('status')).toHaveTextContent('Added "For loops in 5 minutes" to lesson 1 as a video. Save the draft to keep it.')
    expect(within(panel).getByRole('button', { name: 'Added: For loops in 5 minutes' })).toBeDisabled()
    expect(titles()).toEqual(['Intro', 'For loops in 5 minutes'])
    expect(screen.getByLabelText('YouTube link')).toHaveValue(VIDEO.url)

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1))
    expect(m.saveDraft.mock.calls[0]![0].lessons[0].activities[1]).toMatchObject({
      kind: 'video', title: 'For loops in 5 minutes', required: true, content: { embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
    })
  })

  it('imports an openly licensed README as a reading', async () => {
    m.importReadme.mockResolvedValue({ title: 'loops (GitHub)', body: '> From [cic/loops](https://github.com/cic/loops) on GitHub, under the MIT License.\n\n# Loops', url: REPO.url, license: REPO.license })
    const { panel } = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    await userEvent.click(await within(panel).findByRole('button', { name: 'Add README as reading: cic/loops' }))
    expect(m.importReadme).toHaveBeenCalledWith('cic/loops')
    expect(await within(panel).findByRole('status')).toHaveTextContent('Added "cic/loops" to lesson 1 as a reading.')
    expect(titles()).toEqual(['Intro', 'loops (GitHub)'])
    expect(screen.getAllByLabelText('Reading (markdown)')[1]).toHaveValue('> From [cic/loops](https://github.com/cic/loops) on GitHub, under the MIT License.\n\n# Loops')
  })

  it('says why a README could not be imported, and adds nothing', async () => {
    m.importReadme.mockRejectedValue(new Error('That repository is not under an open license, so its text cannot be copied into a lesson.'))
    const { panel } = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    await userEvent.click(await within(panel).findByRole('button', { name: 'Add README as reading: cic/loops' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('not under an open license')
    expect(titles()).toEqual(['Intro'])
  })

  it('shows a search that failed, and an empty result', async () => {
    m.searchSources.mockRejectedValueOnce(new Error('Only authors can search for material. Ask a CIC admin.'))
    const { panel } = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Only authors can search for material.')
    m.searchSources.mockResolvedValueOnce({ results: [], problems: [] })
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }))
    expect(await within(panel).findByText('Nothing found for "For loops". Try fewer words, another language, or more sources.')).toBeInTheDocument()
  })
})
