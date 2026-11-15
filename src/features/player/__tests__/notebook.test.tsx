// @vitest-environment jsdom
import '../test/setup'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { NoteBox } from '../components/NoteBox'
import { groupNotes } from '../notebook'
import { LearnLayout } from '../pages/LearnLayout'
import { NotebookPage } from '../pages/NotebookPage'
import type { Note } from '../types'
import { CLASS_ID, expectNoSeriousA11yViolations, MID_MODULE, mockApi, renderRoute } from '../test/render'

const note = (activity_id: string, module_title: string, lesson_title: string): Note => ({
  activity_id, activity_title: activity_id, kind: 'reading', lesson_title, module_id: module_title, module_title, body: 'b', updated_at: null,
})

describe('groupNotes', () => {
  it('groups by module then lesson and keeps the order it was given', () => {
    const g = groupNotes([note('a', 'M1', 'L1'), note('b', 'M1', 'L2'), note('c', 'M1', 'L1'), note('d', 'M2', 'L9')])
    expect(g.map((m) => m.module)).toEqual(['M1', 'M2'])
    expect(g[0]!.lessons.map((l) => [l.lesson, l.notes.map((n) => n.activity_id)])).toEqual([['L1', ['a', 'c']], ['L2', ['b']]])
  })
})

describe('mock notes API', () => {
  it('saves, lists in course order with titles, and deletes on an empty note', async () => {
    const api = mockApi()
    await api.saveNote('act-loops-sheet', '  loops repeat  ')
    await api.saveNote('act-vars-read', 'names for values')
    const list = await api.getMyNotes()
    expect(list.map((n) => [n.activity_id, n.body])).toEqual([['act-vars-read', 'names for values'], ['act-loops-sheet', 'loops repeat']])
    expect(list[0]).toMatchObject({ lesson_title: 'Variables', module_title: 'Python basics' })
    await api.saveNote('act-vars-read', '')
    expect((await api.getMyNotes()).map((n) => n.activity_id)).toEqual(['act-loops-sheet'])
    await expect(api.saveNote('nope', 'x')).rejects.toMatchObject({ code: 'not_found' })
    await expect(api.saveNote('act-vars-read', 'x'.repeat(2001))).rejects.toBeTruthy()
  })
})

describe('NoteBox', () => {
  it('saves by itself after the student stops typing, and blocks notes that are too long', async () => {
    const api = mockApi()
    const user = userEvent.setup()
    renderRoute(<NoteBox activityId="act-vars-read" activityTitle="Read: naming things" />, { api, path: '/', url: '/' })
    const box = await screen.findByLabelText('Notes on "Read: naming things"')
    await waitFor(() => expect(box).toBeEnabled())
    await user.type(box, 'A variable is a label')
    expect(await screen.findByText('Saved', {}, { timeout: 4000 })).toBeInTheDocument()
    expect((await api.getMyNotes())[0]).toMatchObject({ activity_id: 'act-vars-read', body: 'A variable is a label' })
    await user.clear(box)
    await user.click(box)
    await user.paste('x'.repeat(2001))
    expect(screen.getByText(/too long to save/)).toBeInTheDocument()
  })
})

describe('notes side panel', () => {
  it('opens from Notes in the student bar beside the activity, follows the activity, and closes', async () => {
    const api = mockApi(MID_MODULE)
    const user = userEvent.setup()
    renderRoute(<LearnLayout />, {
      api,
      path: '/learn/:classId/a/:activityId',
      url: `/learn/${CLASS_ID}/a/act-vars-read`,
      extra: [],
    })
    const toggle = await screen.findByRole('button', { name: 'Notes' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('complementary', { name: 'My notes' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close notes' }))
    expect(screen.queryByRole('complementary', { name: 'My notes' })).not.toBeInTheDocument()
  })
})

describe('NotebookPage', () => {
  it('shows an empty state, then notes grouped under headings, with no serious accessibility problems', async () => {
    const api = mockApi()
    const first = renderRoute(<NotebookPage />, { api, path: '/learn/:classId/notebook', url: `/learn/${CLASS_ID}/notebook` })
    expect(await screen.findByText('No notes yet')).toBeInTheDocument()
    first.unmount()
    await api.saveNote('act-vars-read', 'A name for a value')
    const { container } = renderRoute(<NotebookPage />, { api, path: '/learn/:classId/notebook', url: `/learn/${CLASS_ID}/notebook` })
    expect(await screen.findByRole('heading', { level: 2, name: 'Python basics' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Variables' })).toBeInTheDocument()
    expect(screen.getByText('A name for a value')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read: naming things' })).toHaveAttribute('href', `/learn/${CLASS_ID}/a/act-vars-read`)
    await expectNoSeriousA11yViolations(container)
  })
})
