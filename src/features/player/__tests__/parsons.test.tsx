// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CLASS_ID, MID_MODULE, mockApi, renderRoute } from '@/features/player/test/render'
import { ActivityPage } from '../pages/ActivityPage'

describe('Parsons problem in the player', () => {
  it('shows the lines as code and the program so far, and reorders by keyboard', async () => {
    renderRoute(<ActivityPage hintsEnabled={false} />, { path: '/learn/:classId/a/:activityId', url: `/learn/${CLASS_ID}/a/act-loops-sheet`, api: mockApi(MID_MODULE) })
    expect(await screen.findByText('Put the lines of code in order. The indentation is already right.')).toBeInTheDocument()
    const program = screen.getByText('Your program so far').nextElementSibling as HTMLElement
    const before = program.textContent
    expect(before!.split('\n')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Move "i = 0" up' }))
    expect(program.textContent).not.toBe(before)
  })
})
