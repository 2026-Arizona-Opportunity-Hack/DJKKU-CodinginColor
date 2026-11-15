// @vitest-environment jsdom
import '../test/setup'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultMessage } from '../components/ResultMessage'

const base = { score: 0, completed: false, module_completed: false }

describe('belonging moments', () => {
  it('adds a "struggle is normal" line to a wrong answer, and not to a right one', () => {
    const { rerender } = render(<ResultMessage result={{ ...base, is_correct: false, feedback: 'Not quite.' }} />)
    expect(screen.getByText(/normal|Every coder gets stuck|trips up lots of people/)).toBeInTheDocument()
    rerender(<ResultMessage result={{ ...base, is_correct: true, completed: true, feedback: 'Yes.' }} />)
    expect(screen.queryByText(/normal|Every coder gets stuck|trips up lots of people/)).not.toBeInTheDocument()
  })
})
