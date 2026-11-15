// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AuthoredQuestion } from '@shared/authoring/schemas'
import { QuestionPreview } from '@/components/learning/QuestionPreview'
import { QuestionEditor } from '../QuestionEditor'
import '../test/harness'

vi.mock('../api', () => ({ listConcepts: async () => [{ id: 'loops', name: 'Loops' }], upsertConcept: vi.fn() }))

const q: AuthoredQuestion = {
  content: { type: 'ordering', id: 'q-p', prompt: 'Order it', conceptId: 'loops', items: [{ id: 'a', text: 'while i < 3:' }, { id: 'b', text: '    i = i + 1' }] },
  key: { type: 'ordering', correctOrder: ['a', 'b'], hints: [] },
} as AuthoredQuestion

describe('Parsons problems in the studio', () => {
  it('turns an ordering question into lines of code with a checkbox', async () => {
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    const onChange = vi.fn()
    render(<QueryClientProvider client={new QueryClient()}><QuestionEditor value={q} onChange={onChange} /></QueryClientProvider>)
    expect(screen.getByLabelText('Item 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /These are lines of code/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.objectContaining({ display: 'code' }) }))
  })

  it('labels the rows as lines in a monospace font when it is a Parsons problem', async () => {
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    const code = { ...q, content: { ...q.content, display: 'code' } } as AuthoredQuestion
    render(<QueryClientProvider client={new QueryClient()}><QuestionEditor value={code} onChange={vi.fn()} /></QueryClientProvider>)
    expect(screen.getByLabelText('Line 2')).toHaveValue('    i = i + 1')
    expect(screen.getByLabelText('Line 2')).toHaveClass('font-mono')
    expect(screen.getByRole('button', { name: 'Add line' })).toBeInTheDocument()
  })
})

describe('Parsons problems in the student preview', () => {
  it('shows each line as code with its indentation kept', () => {
    render(<QuestionPreview index={0} question={{ type: 'ordering', id: 'q', prompt: 'P', conceptId: 'loops', display: 'code', items: [{ id: 'b', text: '    print(i)' }, { id: 'a', text: 'for i in range(3):' }] }} />)
    expect(screen.getByText('Put the lines of code in order:')).toBeInTheDocument()
    const line = screen.getByText((_, el) => el?.tagName === 'LI' && el.textContent === '    print(i)')
    expect(line).toHaveClass('whitespace-pre-wrap', 'font-mono')
    expect(within(line.closest('ol')!).getAllByRole('listitem')).toHaveLength(2)
  })
})
