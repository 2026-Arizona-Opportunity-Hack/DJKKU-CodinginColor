// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredAssessment, AuthoredModule } from '@shared/authoring/schemas'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({
  listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(),
  me: { data: { role: 'cic_admin', can_author: false } as { role: string; can_author: boolean } | undefined, isPending: false },
}))
vi.mock('../api', () => ({
  listMyModules: m.listMyModules, loadModule: m.loadModule, saveDraft: m.saveDraft, newVersion: m.newVersion,
  listConcepts: m.listConcepts, upsertConcept: m.upsertConcept,
}))
vi.mock('@/lib/session', () => ({ useMe: () => m.me, isDemoMode: () => false }))

const ID = '30000000-0000-4000-8000-000000000001'
const row = (over: object = {}) => ({ id: ID, slug: 'loops', title: 'Loops', version: 1, status: 'draft', created_by: null, created_at: '2026-11-14T00:00:00Z', published_at: null, ...over })
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const mcq = {
  content: { type: 'mcq', id: 'q1', prompt: 'What does a loop do?', conceptId: 'loops', choices: [{ id: 'a', text: 'Repeats' }, { id: 'b', text: 'Stops' }] },
  key: { type: 'mcq', correctChoiceId: 'a', hints: ['Think repeat'] },
}
const loaded = (over: Partial<AuthoredModule> = {}, extra: object = {}) => ({
  id: ID, slug: 'loops', version: 1, keysHidden: false, pre: null as AuthoredAssessment | null, post: null as AuthoredAssessment | null,
  module: {
    title: 'Loops', summary: 'About loops', status: 'draft',
    lessons: [{ title: 'Basics', activities: [
      { kind: 'video', title: 'Watch', required: true, youtubeUrl: YT },
      { kind: 'check', title: 'Check', required: true, conceptId: 'loops', questions: [mcq] },
    ] }],
    ...over,
  },
  ...extra,
})

const open = (url = '/author') => renderAt(<AuthoringPage />, { url })
const activityCards = () => screen.getAllByRole('heading', { level: 4 }).map((h) => h.closest('li') as HTMLElement)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  m.me.data = { role: 'cic_admin', can_author: false }
  m.me.isPending = false
  m.listConcepts.mockResolvedValue([{ id: 'loops', name: 'Loops' }, { id: 'variables', name: 'Variables' }])
  m.listMyModules.mockResolvedValue([])
})

describe('who can use the studio', () => {
  it('blocks a signed-in person without authoring rights', () => {
    m.me.data = { role: 'instructor', can_author: false }
    open()
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have authoring access. Ask a CIC admin.")
    expect(m.listMyModules).not.toHaveBeenCalled()
  })

  it.each([
    ['a CIC admin', { role: 'cic_admin', can_author: false }],
    ['an instructor with authoring rights', { role: 'instructor', can_author: true }],
  ])('lets %s in', async (_who, me) => {
    m.me.data = me
    open()
    expect(await screen.findByRole('heading', { name: 'My modules' })).toBeInTheDocument()
  })
})

describe('My modules', () => {
  it('shows an empty state with a way to start', async () => {
    const { container } = open()
    expect(await screen.findByText(/No modules yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start one.' })).toHaveAttribute('href', '/author/new')
    await expectNoSeriousA11yViolations(container)
  })

  it('lists title, version and status, with Edit for drafts and New version for published', async () => {
    m.listMyModules.mockResolvedValue([row(), row({ id: 'x2', title: 'Functions', status: 'published', published_at: '2026-11-14T00:00:00Z' }), row({ id: 'x3', title: 'Lists', status: 'submitted' })])
    const { container } = open()
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent).slice(0, 2))).toEqual([['1', 'Draft'], ['1', 'Published'], ['1', 'Submitted']])
    expect(screen.getByRole('link', { name: 'Edit Loops, version 1' })).toHaveAttribute('href', `/author/${ID}`)
    expect(screen.getByRole('link', { name: 'View Functions, version 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New version of Loops' })).toBeNull()
    await expectNoSeriousA11yViolations(container)
  })

  it('makes a new version of a published module and opens the copy', async () => {
    m.listMyModules.mockResolvedValue([row({ status: 'published' })])
    m.newVersion.mockResolvedValue('30000000-0000-4000-8000-000000000009')
    m.loadModule.mockResolvedValue(loaded({ title: 'Loops copy' }))
    const { router } = open()
    await userEvent.click(await screen.findByRole('button', { name: 'New version of Loops' }))
    expect(m.newVersion).toHaveBeenCalledWith(ID)
    await waitFor(() => expect(router.state.location.pathname).toBe('/author/30000000-0000-4000-8000-000000000009'))
  })

  it("shows the database's reason when a new version is refused", async () => {
    m.listMyModules.mockResolvedValue([row({ status: 'published' })])
    m.newVersion.mockRejectedValue(new Error('There is already a draft of the next version of this module'))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'New version of Loops' }))
    expect(await screen.findByText('There is already a draft of the next version of this module')).toBeInTheDocument()
  })

  it('shows an error with Try again', async () => {
    m.listMyModules.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([row()])
    open()
    expect(await screen.findByText(/We could not load your modules/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('the editor', () => {
  it('builds a module: lessons, activities, a live video check, and saves the right payload', async () => {
    m.saveDraft.mockResolvedValue(ID)
    m.loadModule.mockResolvedValue(loaded({ title: 'My Module', summary: '' }))
    const { container, router } = open('/author/new')
    await userEvent.type(await screen.findByLabelText('Module title'), 'My Module')
    await userEvent.type(screen.getByLabelText('Lesson 1 title'), 'Basics')

    await userEvent.click(screen.getByRole('button', { name: 'Add activity' })) // video is the default kind
    const video = activityCards()[0]!
    await userEvent.type(within(video).getByLabelText('Title'), 'Watch')
    const link = within(video).getByLabelText('YouTube link')
    await userEvent.type(link, 'https://example.com/nope')
    expect(within(video).getByText(/not a YouTube link we can use/)).toBeInTheDocument()
    await userEvent.clear(link)
    await userEvent.type(link, YT)
    expect(within(video).getByText(/Video found \(dQw4w9WgXcQ\)/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'reading')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    const reading = activityCards()[1]!
    await userEvent.type(within(reading).getByLabelText('Title'), 'Read')
    await userEvent.type(within(reading).getByLabelText('Reading (markdown)'), 'Some text')
    await userEvent.click(within(reading).getByRole('switch', { name: 'Required' }))
    await expectNoSeriousA11yViolations(container)

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1))
    expect(m.saveDraft.mock.calls[0]![0]).toMatchObject({
      module_id: null, slug: 'my-module', title: 'My Module', summary: '',
      lessons: [{ title: 'Basics', activities: [
        { kind: 'video', title: 'Watch', required: true, concept_id: null, content: { embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }, keys: [] },
        { kind: 'reading', title: 'Read', required: false, content: { body: 'Some text' }, keys: [] },
      ] }],
      assessments: [],
    })
    await waitFor(() => expect(router.state.location.pathname).toBe(`/author/${ID}`))
    expect(await screen.findByLabelText('Module title')).toHaveValue('My Module') // reopened from the saved copy
  }, 20000)

  it('validates before saving: it shows what is wrong and never calls the database', async () => {
    open('/author/new')
    await userEvent.click(await screen.findByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Some fields need attention. Fix them and save again.')).toBeInTheDocument()
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
    expect(screen.getByText('Add at least one activity to this lesson.')).toBeInTheDocument()
    expect(m.saveDraft).not.toHaveBeenCalled()
  })

  it('adds, renames, reorders and deletes lessons and activities (position is array order)', async () => {
    m.saveDraft.mockResolvedValue(ID)
    m.loadModule.mockResolvedValue(loaded({ lessons: [
      { title: 'One', activities: [{ kind: 'reading', title: 'A', required: true, body: 'a' }, { kind: 'reading', title: 'B', required: true, body: 'b' }, { kind: 'reading', title: 'C', required: true, body: 'c' }] },
      { title: 'Two', activities: [{ kind: 'reading', title: 'D', required: true, body: 'd' }] },
    ] }))
    open(`/author/${ID}`)
    await screen.findByLabelText('Lesson 1 title')
    await userEvent.click(screen.getAllByRole('button', { name: 'Move activity 1 down' })[0]!) // lesson One: B, A, C
    await userEvent.click(screen.getAllByRole('button', { name: 'Move activity 3 up' })[0]!)   // lesson One: B, C, A
    await userEvent.click(screen.getByRole('button', { name: 'Move lesson 1 down' }))          // lessons: Two, One
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete activity 1' })[1]!)    // lesson One loses B
    await userEvent.type(screen.getByLabelText('Lesson 1 title'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalled())
    const sent = m.saveDraft.mock.calls[0]![0]
    expect(sent.module_id).toBe(ID)
    expect(sent.lessons.map((l: { title: string }) => l.title)).toEqual(['Two!', 'One'])
    expect(sent.lessons.map((l: { activities: { title: string }[] }) => l.activities.map((a) => a.title))).toEqual([['D'], ['C', 'A']])
  })

  it('keeps the questions and answer keys of a loaded check activity', async () => {
    m.saveDraft.mockResolvedValue(ID)
    m.loadModule.mockResolvedValue(loaded())
    open(`/author/${ID}`)
    expect(await screen.findByRole('heading', { name: 'Question 1' })).toBeInTheDocument()
    expect(screen.getByLabelText('Question text')).toHaveValue('What does a loop do?')
    expect(screen.getByLabelText('Module title')).toHaveValue('Loops')
    await userEvent.type(screen.getByLabelText('Module title'), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalled())
    const check = m.saveDraft.mock.calls[0]![0].lessons[0].activities[1]
    expect(check).toMatchObject({ kind: 'check', concept_id: 'loops', keys: [{ question_id: 'q1', key: { type: 'mcq', correctChoiceId: 'a' } }] })
    expect(JSON.stringify(check.content)).not.toMatch(/correctChoiceId|hints/)
    expect(await screen.findByText(/^Saved at /)).toBeInTheDocument()
  })

  it('shows the database error and keeps what was typed', async () => {
    m.saveDraft.mockRejectedValue(new Error('Only the owner can edit a draft module (published and submitted modules are locked)'))
    m.loadModule.mockResolvedValue(loaded())
    open(`/author/${ID}`)
    const title = await screen.findByLabelText('Module title')
    await userEvent.type(title, ' changed')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText(/Only the owner can edit a draft module/)).toBeInTheDocument()
    expect(title).toHaveValue('Loops changed')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('warns before leaving with unsaved changes, and lets you keep editing or leave', async () => {
    m.loadModule.mockResolvedValue(loaded())
    const { router } = open(`/author/${ID}`)
    await userEvent.type(await screen.findByLabelText('Module title'), ' x')
    void router.navigate('/elsewhere')
    expect(await screen.findByText('You have unsaved changes. Leave without saving?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('You have unsaved changes. Leave without saving?')).toBeNull()
    void router.navigate('/elsewhere')
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/elsewhere')
  })

  it('does not warn when nothing changed', async () => {
    m.loadModule.mockResolvedValue(loaded())
    const { router } = open(`/author/${ID}`)
    await screen.findByLabelText('Module title')
    await router.navigate('/elsewhere')
    expect(await screen.findByTestId('location')).toHaveTextContent('/elsewhere')
  })

  it('previews markdown without rendering raw HTML', async () => {
    m.loadModule.mockResolvedValue(loaded({ lessons: [{ title: 'L', activities: [{ kind: 'reading', title: 'R', required: true, body: '## Heading\n\n**bold** <b id="raw">html</b> <script>alert(1)</script>' }] }] }))
    open(`/author/${ID}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Preview' }))
    const preview = screen.getByRole('region', { name: 'Reading (markdown) preview' })
    expect(within(preview).getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(preview.querySelector('strong')).not.toBeNull()
    expect(preview.querySelector('#raw, script, b')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Write' }))
    expect((screen.getByLabelText('Reading (markdown)') as HTMLTextAreaElement).value).toContain('## Heading')
  })

  it('adds a new concept from the activity and selects it', async () => {
    m.loadModule.mockResolvedValue(loaded())
    m.upsertConcept.mockResolvedValue({ id: 'conditionals', name: 'Conditionals' })
    open(`/author/${ID}`)
    const video = (await screen.findAllByRole('heading', { level: 4 }))[0]!.closest('li') as HTMLElement
    await userEvent.selectOptions(within(video).getByLabelText('Concept'), '__new__')
    await userEvent.type(within(video).getByLabelText('Concept name'), 'Conditionals')
    m.listConcepts.mockResolvedValue([{ id: 'conditionals', name: 'Conditionals' }])
    await userEvent.click(within(video).getByRole('button', { name: 'Add concept' }))
    expect(m.upsertConcept).toHaveBeenCalledWith('Conditionals')
    await waitFor(() => expect(within(video).getByLabelText('Concept')).toHaveValue('conditionals'))
  })

  it('opens a published module read-only, with New version and no Save', async () => {
    m.loadModule.mockResolvedValue(loaded({ status: 'published' }))
    m.newVersion.mockRejectedValue(new Error('There is already a draft of the next version of this module'))
    const { container } = open(`/author/${ID}`)
    expect(await screen.findByText(/published and cannot be changed/)).toBeInTheDocument()
    expect(screen.getByLabelText('Module title')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add lesson' })).toBeNull()
    await expectNoSeriousA11yViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'New version' }))
    expect(await screen.findByText('There is already a draft of the next version of this module')).toBeInTheDocument()
  })

  it('says a submitted module is locked', async () => {
    m.loadModule.mockResolvedValue(loaded({ status: 'submitted' }))
    open(`/author/${ID}`)
    expect(await screen.findByText(/Submitted for review. It is locked/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
  })

  it('shows an error and Try again when the module will not load', async () => {
    m.loadModule.mockRejectedValueOnce(new Error("We couldn't find that module.")).mockResolvedValue(loaded())
    open(`/author/${ID}`)
    expect(await screen.findByText("We couldn't find that module.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Module title')).toHaveValue('Loops')
  })
})
