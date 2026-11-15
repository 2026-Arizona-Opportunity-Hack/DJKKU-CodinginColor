// @vitest-environment jsdom
import '../test/setup'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunOutcome } from '../code/runner'
import { CodeActivity } from '../components/CodeActivity'
import { expectNoSeriousA11yViolations } from '../test/render'

const run = vi.fn<(code: string, tests: string[]) => Promise<RunOutcome>>()
vi.mock('../code/runner', () => ({ createRunner: () => ({ run, dispose: () => {} }) }))

const content = {
  prompt: 'Change the loop so total is 55.',
  starter: 'total = 0\nprint(total)\n',
  predict: 'What will it print?',
  tests: ['assert total == 55'],
}

function setup(props: Partial<Parameters<typeof CodeActivity>[0]> = {}) {
  const onSubmit = vi.fn()
  const utils = render(<CodeActivity content={content} done={false} pending={false} onSubmit={onSubmit} {...props} />)
  return { ...utils, onSubmit, user: userEvent.setup() }
}

beforeEach(() => run.mockReset())

describe('CodeActivity (PRIMM)', () => {
  it('asks for a prediction before the first run', async () => {
    const { user } = setup()
    const runButton = screen.getByRole('button', { name: /run/i })
    expect(runButton).toBeDisabled()
    expect(screen.getByText('Write your prediction first.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('What will it print?'), '0')
    expect(runButton).toBeEnabled()
  })

  it('shows the output and check results, then submits code and counts', async () => {
    run.mockResolvedValue({ kind: 'ok', stdout: '55\n', error: null, checks: [{ test: 'assert total == 55', passed: true }] })
    const { user, onSubmit } = setup()
    await user.type(screen.getByLabelText('What will it print?'), '0')
    await user.click(screen.getByRole('button', { name: /run/i }))
    expect(await screen.findByText('55')).toBeInTheDocument()
    expect(screen.getByText('Passes')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 checks pass.')).toBeInTheDocument()
    expect(run).toHaveBeenCalledWith(content.starter, content.tests)
    await user.click(screen.getByRole('button', { name: 'Submit my code' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: content.starter, passed: 1, total: 1, prediction: '0' })
  })

  it('explains an error in plain language next to the real message', async () => {
    run.mockResolvedValue({
      kind: 'ok',
      stdout: '',
      error: { type: 'NameError', message: "name 'totl' is not defined", line: 2 },
      checks: [{ test: 'assert total == 55', passed: false, error: "name 'total' is not defined" }],
    })
    const { user } = setup({ content: { ...content, predict: null } })
    await user.click(screen.getByRole('button', { name: /run/i }))
    expect(await screen.findByText(/On line 2: Python doesn't know the name "totl"/)).toBeInTheDocument()
    expect(screen.getByText("NameError: name 'totl' is not defined")).toBeInTheDocument()
    expect(screen.getByText(/Not yet/)).toBeInTheDocument()
  })

  it('says when a run was stopped for taking too long', async () => {
    run.mockResolvedValue({ kind: 'timeout' })
    const { user } = setup({ content: { ...content, predict: null } })
    await user.click(screen.getByRole('button', { name: /run/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/more than 5 seconds/)
    expect(screen.getByRole('button', { name: 'Submit my code' })).toBeDisabled()
  })

  it('indents with Tab and lets the student leave the editor with Escape then Tab', async () => {
    const { user } = setup({ content: { ...content, predict: null, starter: '' } })
    const editor = screen.getByLabelText('Your code (Python)')
    await user.click(editor)
    await user.keyboard('{Tab}x')
    expect(editor).toHaveValue('    x')
    await user.keyboard('{Escape}{Tab}')
    expect(editor).not.toHaveFocus()
  })

  it('has no serious accessibility problems', async () => {
    const { container } = setup()
    await expectNoSeriousA11yViolations(container)
  })
})
