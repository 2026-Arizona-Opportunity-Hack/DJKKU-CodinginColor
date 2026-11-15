// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLASS_A, CLASS_B, expectNoSeriousA11yViolations, renderAt } from '../test/harness'
import { AssignModule } from '../AssignModule'
import { ClassPicker } from '../ClassPicker'
import { CreateClassForm } from '../CreateClassForm'
import { JoinCodeCard } from '../JoinCodeCard'
import { PrintableCodes } from '../PrintableCodes'
import { RosterImport } from '../RosterImport'

const m = vi.hoisted(() => ({
  listInstructorClasses: vi.fn(),
  importRoster: vi.fn(),
  createClass: vi.fn(),
  createJoinCode: vi.fn(),
  assignModule: vi.fn(),
  listPublishedModules: vi.fn(),
  listClassModules: vi.fn(),
  me: { data: { role: 'instructor' } as { role: string } | undefined },
}))
vi.mock('../api.supabase', () => ({ listInstructorClasses: m.listInstructorClasses, importRoster: m.importRoster }))
vi.mock('../setupApi', () => ({
  createClass: m.createClass, createJoinCode: m.createJoinCode, assignModule: m.assignModule,
  listPublishedModules: m.listPublishedModules, listClassModules: m.listClassModules,
}))
vi.mock('../qr', () => ({ qrDataUrl: async () => 'data:image/png;base64,AAAA' }))
vi.mock('@/lib/session', () => ({ useMe: () => m.me }))

beforeEach(() => {
  vi.clearAllMocks()
  m.me.data = { role: 'instructor' }
})

describe('ClassPicker', () => {
  it('lists classes sorted by name and goes to the chosen class', async () => {
    m.listInstructorClasses.mockResolvedValue([CLASS_A, CLASS_B])
    const { router, container } = renderAt(<ClassPicker />, { path: '/instructor/*', url: '/instructor' })
    const picker = await screen.findByLabelText('Class')
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a class', 'Afterschool', 'Period 1 - Fall 2026'])
    await userEvent.selectOptions(picker, CLASS_A.id)
    expect(router.state.location.pathname).toBe(`/instructor/${CLASS_A.id}`)
    await expectNoSeriousA11yViolations(container)
  })

  it('keeps the selected class from the URL', async () => {
    m.listInstructorClasses.mockResolvedValue([CLASS_A, CLASS_B])
    renderAt(<ClassPicker />, { path: '/instructor/*', url: `/instructor/${CLASS_B.id}` })
    expect(await screen.findByLabelText('Class')).toHaveValue(CLASS_B.id)
  })

  it('says what to do when you teach no classes', async () => {
    m.listInstructorClasses.mockResolvedValue([])
    renderAt(<ClassPicker />, { path: '/instructor/*', url: '/instructor' })
    expect(await screen.findByText(/You don't teach any classes yet/)).toBeInTheDocument()
    expect(screen.getByText(/ask a CIC admin to add you to one/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/instructor/new')
  })

  it('shows an error with Try again', async () => {
    m.listInstructorClasses.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([CLASS_A])
    renderAt(<ClassPicker />, { path: '/instructor/*', url: '/instructor' })
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your classes')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Class')).toBeInTheDocument()
  })
})

describe('CreateClassForm', () => {
  const fill = async (school: string, name: string, term = '') => {
    await userEvent.type(screen.getByLabelText('School name'), school)
    await userEvent.type(screen.getByLabelText('Class name'), name)
    if (term) await userEvent.type(screen.getByLabelText('Term (optional)'), term)
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }))
  }

  it('checks the input before calling the database', async () => {
    renderAt(<CreateClassForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }))
    expect(await screen.findByText('Enter the school name.')).toBeInTheDocument()
    expect(screen.getByText('Enter the class name.')).toBeInTheDocument()
    expect(m.createClass).not.toHaveBeenCalled()
  })

  it('creates the class and opens it', async () => {
    m.createClass.mockResolvedValue({ class_id: CLASS_A.id })
    m.listInstructorClasses.mockResolvedValue([CLASS_A])
    renderAt(<CreateClassForm />)
    await fill('Maryvale', 'Period 1', 'Fall 2026')
    expect(await screen.findByTestId('location')).toHaveTextContent(`/instructor/${CLASS_A.id}`)
    expect(m.createClass.mock.calls[0]![0]).toEqual({ schoolName: 'Maryvale', name: 'Period 1', term: 'Fall 2026' })
  })

  it("shows the database's plain-language error for an unknown school", async () => {
    m.createClass.mockRejectedValue(new Error("That school isn't set up yet. Ask a CIC admin to add it."))
    renderAt(<CreateClassForm />)
    await fill('Nowhere High', 'Period 1')
    expect(await screen.findByText("That school isn't set up yet. Ask a CIC admin to add it.")).toBeInTheDocument()
  })

  it('tells an admin they can type a new school, and an instructor they cannot', () => {
    m.me.data = { role: 'cic_admin' }
    const admin = renderAt(<CreateClassForm />)
    expect(screen.getByText('As a CIC admin you can type a new school.')).toBeInTheDocument()
    admin.unmount()
    m.me.data = { role: 'instructor' }
    renderAt(<CreateClassForm />)
    expect(screen.getByText('Use a school that is already set up.')).toBeInTheDocument()
  })
})

describe('JoinCodeCard', () => {
  it('shows the link once with copy buttons and a QR code, and warns that a new link replaces the old', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    m.createJoinCode.mockResolvedValue({ join_code: 'AAAA-BBBB-CCCC' })
    const { container } = renderAt(<JoinCodeCard classId={CLASS_A.id} />)
    expect(screen.getByText(/stops the old one from working/)).toBeInTheDocument()
    expect(screen.getByText(/share it only in class/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Make a class link' }))
    const link = `${window.location.origin}/join/AAAA-BBBB-CCCC`
    expect(await screen.findByLabelText('Link to share')).toHaveValue(link)
    expect(m.createJoinCode).toHaveBeenCalledWith(CLASS_A.id)
    expect(await screen.findByRole('img', { name: 'QR code for the class link' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(link)
    expect(await screen.findByText('Link copied.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(writeText).toHaveBeenLastCalledWith('AAAA-BBBB-CCCC')
    await expectNoSeriousA11yViolations(container)
  })

  it('says so when copying is blocked, and shows database errors', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true })
    m.createJoinCode.mockResolvedValueOnce({ join_code: 'AAAA-BBBB-CCCC' }).mockRejectedValueOnce(new Error('Not allowed to manage this class'))
    renderAt(<JoinCodeCard classId={CLASS_A.id} />)
    await userEvent.click(screen.getByRole('button', { name: 'Make a class link' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Make a class link' }))
    expect(await screen.findByText('Not allowed to manage this class')).toBeInTheDocument()
  })
})

describe('RosterImport', () => {
  const csv = (text: string) => new File([text], 'roster.csv', { type: 'text/csv' })

  it('imports into the chosen class (no class dropdown), hands the codes up, and offers the print sheet', async () => {
    const members = [{ member_id: CLASS_A.id, display_name: 'Ava K.', login_code: 'AAAA-1111-BBBB-2222' }]
    m.importRoster.mockResolvedValue(members)
    const onImported = vi.fn()
    const onPrint = vi.fn()
    renderAt(<RosterImport classId={CLASS_A.id} className="Period 1" onImported={onImported} onPrint={onPrint} />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Period 1')).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Roster CSV'), csv('Name\nAva K.\n'))
    await userEvent.click(await screen.findByRole('button', { name: /Import 1 students/ }))
    expect(m.importRoster).toHaveBeenCalledWith(CLASS_A.id, ['Ava K.'])
    expect(onImported).toHaveBeenCalledWith(members)
    expect(await screen.findByText('AAAA-1111-BBBB-2222')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Print login sheet' }))
    expect(onPrint).toHaveBeenCalledTimes(1)
  })

  it('shows the database error and keeps nothing', async () => {
    m.importRoster.mockRejectedValue(new Error('Names only, no emails'))
    const onImported = vi.fn()
    renderAt(<RosterImport classId={CLASS_A.id} className="Period 1" onImported={onImported} onPrint={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('Roster CSV'), csv('Name\nAva K.\n'))
    await userEvent.click(await screen.findByRole('button', { name: /Import 1 students/ }))
    expect(await screen.findByText('Names only, no emails')).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()
  })
})

describe('PrintableCodes', () => {
  const codes = [
    { display_name: 'Ava K.', login_code: 'AAAA-1111-BBBB-2222' },
    { display_name: 'Jordan T.', login_code: 'CCCC-3333-DDDD-4444' },
  ]

  it('prints one card per student with name, class, large code, QR and instructions', async () => {
    const { container } = renderAt(<PrintableCodes className="Period 1" codes={codes} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]!).getByText('Ava K.')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('Period 1')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('AAAA-1111-BBBB-2222')).toHaveClass('font-mono')
    expect(within(cards[0]!).getByText(`Go to ${window.location.origin}/sign-in and type this code.`)).toBeInTheDocument()
    expect(await within(cards[0]!).findByRole('img', { name: 'QR code to sign in as Ava K.' })).toBeInTheDocument()
    expect(screen.getByText('These codes are shown only once. Print or save them now.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('never writes the codes to browser storage', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem')
    renderAt(<PrintableCodes className="Period 1" codes={codes} />)
    expect(set).not.toHaveBeenCalled()
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0)
    set.mockRestore()
  })

  it('Print opens the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderAt(<PrintableCodes className="Period 1" codes={codes} />)
    await userEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(print).toHaveBeenCalledTimes(1)
  })
})

describe('AssignModule', () => {
  const published = [{ id: 'm1', title: 'Variables and Loops', version: 1 }, { id: 'm2', title: 'Functions', version: 1 }]

  it('lists what the class has and the published modules, and assigns one', async () => {
    m.listPublishedModules.mockResolvedValue(published)
    m.listClassModules.mockResolvedValueOnce([{ position: 0, moduleId: 'm1', title: 'Variables and Loops', version: 1 }])
    m.assignModule.mockResolvedValue(null)
    const { container } = renderAt(<AssignModule classId={CLASS_A.id} />)
    expect(await screen.findByText('Assigned')).toBeInTheDocument() // m1 is already in the class
    m.listClassModules.mockResolvedValue([
      { position: 0, moduleId: 'm1', title: 'Variables and Loops', version: 1 },
      { position: 1, moduleId: 'm2', title: 'Functions', version: 1 },
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Assign Functions, version 1' }))
    expect(m.assignModule).toHaveBeenCalledWith(CLASS_A.id, 'm2')
    await waitFor(() => expect(screen.getAllByText('Assigned')).toHaveLength(2))
    await expectNoSeriousA11yViolations(container)
  })

  it('has an empty state for no published modules and none assigned', async () => {
    m.listPublishedModules.mockResolvedValue([])
    m.listClassModules.mockResolvedValue([])
    renderAt(<AssignModule classId={CLASS_A.id} />)
    expect(await screen.findByText(/No published modules yet. A CIC admin publishes modules from the Authoring studio./)).toBeInTheDocument()
    expect(screen.getByText('No modules assigned yet.')).toBeInTheDocument()
  })

  it('shows errors from loading and from assigning', async () => {
    m.listPublishedModules.mockResolvedValue(published)
    m.listClassModules.mockRejectedValue(new Error('boom'))
    m.assignModule.mockRejectedValue(new Error('Only published modules can be assigned'))
    renderAt(<AssignModule classId={CLASS_A.id} />)
    expect(await screen.findByText(/We could not load this class's modules/)).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Functions, version 1' }))
    expect(await screen.findByText('Only published modules can be assigned')).toBeInTheDocument()
  })
})
