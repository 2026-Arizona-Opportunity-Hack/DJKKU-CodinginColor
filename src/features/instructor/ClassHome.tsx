import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import type { ImportedRosterMember } from './api.supabase'
import { AssignModule } from './AssignModule'
import { InstructorDashboard } from './InstructorDashboard'
import { useClasses } from './hooks'
import { JoinCodeCard } from './JoinCodeCard'
import { PrintableCodes } from './PrintableCodes'
import { QueryStatus } from '@/components/QueryStatus'
import { RosterImport } from './RosterImport'
import { StartingPoint } from './StartingPoint'

/** Everything for one class (`/instructor/:classId`). Login codes live only in this component's memory. */
export function ClassHome() {
  const { classId = '' } = useParams()
  const classes = useClasses()
  return (
    <QueryStatus query={classes} label="this class" isEmpty={(l) => !l.some((c) => c.id === classId)} empty={<p role="alert">We couldn't find that class. Pick one from the list.</p>}>
      {(list) => <ClassSections key={classId} classId={classId} className={list.find((c) => c.id === classId)!.name} />}
    </QueryStatus>
  )
}

function ClassSections({ classId, className }: { classId: string; className: string }) {
  const [codes, setCodes] = useState<ImportedRosterMember[]>([])
  const sheet = useRef<HTMLDivElement>(null)
  // A Guide link like /instructor/:classId#roster lands on that section, with focus there for keyboard users.
  const { hash } = useLocation()
  useEffect(() => {
    const el = hash ? document.getElementById(hash.slice(1)) : null
    if (!el) return
    el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }, [hash])

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 className="text-2xl font-semibold">{className}</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-md border px-3 font-medium hover:bg-accent" to={`/instructor/${classId}/live`}>Live class view</Link>
          <Link className="inline-flex min-h-11 items-center rounded-md border px-3 font-medium hover:bg-accent" to={`/instructor/${classId}/reteach`}>What to reteach</Link>
          <Link className="inline-flex min-h-11 items-center rounded-md border px-3 font-medium hover:bg-accent" to={`/instructor/${classId}/report`}>Impact report for funders</Link>
        </div>
      </div>
      <div className="flex flex-col gap-10 print:hidden">
        <div id="join-code" tabIndex={-1} className="scroll-mt-24 outline-none"><JoinCodeCard classId={classId} /></div>
        <div id="roster" tabIndex={-1} className="scroll-mt-24 outline-none"><RosterImport
          classId={classId}
          className={className}
          onImported={setCodes}
          onPrint={() => sheet.current?.scrollIntoView?.({ behavior: 'smooth' })}
        /></div>
      </div>
      <div ref={sheet}>{codes.length > 0 && <PrintableCodes className={className} codes={codes} />}</div>
      <div className="flex flex-col gap-10 print:hidden">
        <div id="assign" tabIndex={-1} className="scroll-mt-24 outline-none"><AssignModule classId={classId} /></div>
        <div id="starting-point" tabIndex={-1} className="scroll-mt-24 outline-none"><StartingPoint classId={classId} /></div>
        <div id="dashboard" tabIndex={-1} className="scroll-mt-24 outline-none"><InstructorDashboard initialClassId={classId} /></div>
      </div>
    </div>
  )
}
