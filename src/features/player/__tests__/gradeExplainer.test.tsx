// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { GradeExplainer } from '../components/GradeExplainer'
import { expectNoSeriousA11yViolations, mockApi, renderRoute } from '../test/render'

beforeEach(() => window.localStorage.clear())

describe('Explain it for my grade', () => {
  it('rewrites the lesson for the chosen grade, remembers the grade on this device, and hides the check answer', async () => {
    const user = userEvent.setup()
    const { container } = renderRoute(<GradeExplainer activityId="act-vars-read" />, { path: '/', url: '/', api: mockApi() })
    const explain = screen.getByRole('button', { name: 'Explain it' })
    expect(explain).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('My grade'), '3')
    await user.click(explain)
    expect(await screen.findByRole('heading', { name: 'For grade 3' })).toBeInTheDocument()
    expect(screen.getByText('Here is "Read: naming things" explained for grade 3.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check yourself' })).toBeInTheDocument()
    expect(screen.getByText('Sample in demo mode.', { exact: false })).toBeInTheDocument()
    const reveal = screen.getByRole('button', { name: 'Show the answer' })
    expect(reveal).toHaveAttribute('aria-expanded', 'false')
    await user.click(reveal)
    expect(screen.getByRole('button', { name: 'Hide the answer' })).toHaveAttribute('aria-expanded', 'true')
    expect(window.localStorage.getItem('cic.grade')).toBe('3')
    await expectNoSeriousA11yViolations(container)
  })

  it('gives young grades no glossary and older grades words to know', async () => {
    const user = userEvent.setup()
    renderRoute(<GradeExplainer activityId="act-vars-read" />, { path: '/', url: '/', api: mockApi() })
    await user.selectOptions(screen.getByLabelText('My grade'), '1')
    await user.click(screen.getByRole('button', { name: 'Explain it' }))
    await screen.findByRole('heading', { name: 'For grade 1' })
    expect(screen.queryByRole('heading', { name: 'Words to know' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('My grade'), '10')
    await user.click(screen.getByRole('button', { name: 'Explain it' }))
    await screen.findByRole('heading', { name: 'For grade 10' })
    expect(screen.getByRole('heading', { name: 'Words to know' })).toBeInTheDocument()
  })

  it('starts with the grade this device remembered', () => {
    window.localStorage.setItem('cic.grade', '7')
    renderRoute(<GradeExplainer activityId="act-vars-read" />, { path: '/', url: '/', api: mockApi() })
    expect(screen.getByLabelText('My grade')).toHaveValue('7')
    expect(screen.getByRole('button', { name: 'Explain it' })).toBeEnabled()
  })
})
