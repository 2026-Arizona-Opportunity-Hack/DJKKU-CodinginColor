// @vitest-environment jsdom
// Late joiners: the instructor chooses the module a student starts at (set_start_module).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLASS_A, expectNoSeriousA11yViolations, renderAt } from '../test/harness'
import { RosterImport } from '../RosterImport'
import { StartingPoint } from '../StartingPoint'

const M1 = '20000000-0000-4000-8000-000000000001'
const M2 = '20000000-0000-4000-8000-000000000002'
const SEAT_PAT = '30000000-0000-4000-8000-000000000001'
const SEAT_SAM = '30000000-0000-4000-8000-000000000002'

const m = vi.hoisted(() => ({
  importRoster: vi.fn(),
  listClassModules: vi.fn(),
  listPlacements: vi.fn(),
  setStartModule: vi.fn(),
}))
vi.mock('../api.supabase', () => ({ importRoster: m.importRoster }))
vi.mock('../setupApi', () => ({
  listClassModules: m.listClassModules, listPlacements: m.listPlacements, setStartModule: m.setStartModule,
}))

const modules = [
  { position: 0, moduleId: M1, title: 'Variables and Loops', version: 1 },
  { position: 1, moduleId: M2, title: 'Functions', version: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  m.listClassModules.mockResolvedValue(modules)
})

describe('StartingPoint', () => {
  it('starts a student who has not signed in yet at module 2, and says what was skipped', async () => {
    m.listPlacements.mockResolvedValue([
      { memberId: SEAT_PAT, name: 'Pat Q.', joined: true, startModuleId: null },
      { memberId: SEAT_SAM, name: 'Sam R.', joined: false, startModuleId: null },
    ])
    m.setStartModule.mockResolvedValue({ students: 1, start_module_id: M2, skipped_modules: 1 })
    const { container } = renderAt(<StartingPoint classId={CLASS_A.id} />)

    const student = await screen.findByLabelText('Student')
    expect(within(student).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a student', 'Pat Q.', 'Sam R. (not signed in yet)'])
    const start = screen.getByLabelText('Starts at')
    expect(within(start).getAllByRole('option').map((o) => o.textContent)).toEqual(['From the beginning', 'Module 2: Functions'])

    await userEvent.selectOptions(student, SEAT_SAM)
    await userEvent.selectOptions(start, M2)
    await userEvent.click(screen.getByRole('button', { name: 'Save starting point' }))
    expect(m.setStartModule).toHaveBeenCalledWith([SEAT_SAM], M2)
    expect(await screen.findByText('Saved. 1 earlier module skipped.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('"From the beginning" clears a placement, and current placements are listed', async () => {
    m.listPlacements.mockResolvedValue([{ memberId: SEAT_SAM, name: 'Sam R.', joined: true, startModuleId: M2 }])
    m.setStartModule.mockResolvedValue({ students: 1, start_module_id: null, skipped_modules: 0 })
    renderAt(<StartingPoint classId={CLASS_A.id} />)
    expect(await screen.findByText('Placed at a later module')).toBeInTheDocument()
    expect(screen.getByText('Module 2: Functions', { exact: false, selector: 'li' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Student'), SEAT_SAM)
    await userEvent.click(screen.getByRole('button', { name: 'Save starting point' }))
    expect(m.setStartModule).toHaveBeenCalledWith([SEAT_SAM], null)
    expect(await screen.findByText('Saved. They start from the beginning.')).toBeInTheDocument()
  })

  it('shows the database refusal in words', async () => {
    m.listPlacements.mockResolvedValue([{ memberId: SEAT_SAM, name: 'Sam R.', joined: false, startModuleId: null }])
    m.setStartModule.mockRejectedValue(new Error('Not allowed to manage this class'))
    renderAt(<StartingPoint classId={CLASS_A.id} />)
    await userEvent.selectOptions(await screen.findByLabelText('Student'), SEAT_SAM)
    await userEvent.click(screen.getByRole('button', { name: 'Save starting point' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed to manage this class')
  })

  it('needs two modules before there is a later one to choose', async () => {
    m.listClassModules.mockResolvedValue(modules.slice(0, 1))
    renderAt(<StartingPoint classId={CLASS_A.id} />)
    expect(await screen.findByText(/Assign at least two modules/)).toBeInTheDocument()
    expect(m.listPlacements).not.toHaveBeenCalled()
  })
})

describe('RosterImport with a starting point', () => {
  const csv = (text: string) => new File([text], 'roster.csv', { type: 'text/csv' })

  it('starts every imported student at the chosen module right after the import', async () => {
    const members = [
      { member_id: SEAT_PAT, display_name: 'Pat Q.', login_code: 'AAAA-1111-BBBB-2222' },
      { member_id: SEAT_SAM, display_name: 'Sam R.', login_code: 'CCCC-3333-DDDD-4444' },
    ]
    m.importRoster.mockResolvedValue(members)
    m.setStartModule.mockResolvedValue({ students: 2, start_module_id: M2, skipped_modules: 1 })
    renderAt(<RosterImport classId={CLASS_A.id} className="Period 1" onImported={vi.fn()} onPrint={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('Roster CSV'), csv('Name\nPat Q.\nSam R.\n'))
    await userEvent.selectOptions(await screen.findByLabelText('Where do these students start?'), M2)
    await userEvent.click(screen.getByRole('button', { name: /Import 2 students/ }))
    expect(await screen.findByText('AAAA-1111-BBBB-2222')).toBeInTheDocument()
    expect(m.setStartModule).toHaveBeenCalledWith([SEAT_PAT, SEAT_SAM], M2)
  })

  it('keeps the codes when only the placement fails, and says where to fix it', async () => {
    m.importRoster.mockResolvedValue([{ member_id: SEAT_SAM, display_name: 'Sam R.', login_code: 'CCCC-3333-DDDD-4444' }])
    m.setStartModule.mockRejectedValue(new Error('Not allowed to manage this class'))
    renderAt(<RosterImport classId={CLASS_A.id} className="Period 1" onImported={vi.fn()} onPrint={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('Roster CSV'), csv('Name\nSam R.\n'))
    await userEvent.selectOptions(await screen.findByLabelText('Where do these students start?'), M2)
    await userEvent.click(screen.getByRole('button', { name: /Import 1 students/ }))
    expect(await screen.findByText('CCCC-3333-DDDD-4444')).toBeInTheDocument()
    expect(await screen.findByText(/starting point was not saved: Not allowed to manage this class\. Set it under Starting point/)).toBeInTheDocument()
  })

  it('does not place anyone when "From the beginning" is left selected', async () => {
    m.importRoster.mockResolvedValue([{ member_id: SEAT_SAM, display_name: 'Sam R.', login_code: 'CCCC-3333-DDDD-4444' }])
    renderAt(<RosterImport classId={CLASS_A.id} className="Period 1" onImported={vi.fn()} onPrint={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('Roster CSV'), csv('Name\nSam R.\n'))
    expect(await screen.findByLabelText('Where do these students start?')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: /Import 1 students/ }))
    expect(await screen.findByText('CCCC-3333-DDDD-4444')).toBeInTheDocument()
    expect(m.setStartModule).not.toHaveBeenCalled()
  })
})
