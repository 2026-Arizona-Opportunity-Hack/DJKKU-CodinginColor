import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import type { ImportedRosterMember } from './api.supabase'
import { AssignModule } from './AssignModule'
import { InstructorDashboard } from './InstructorDashboard'
import { useClasses } from './hooks'
import { JoinCodeCard } from './JoinCodeCard'
import { PrintableCodes } from './PrintableCodes'
import { QueryStatus } from '@/components/QueryStatus'
import { RosterImport } from './RosterImport'

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

  return (
    <div className="flex flex-col gap-10">
      <h2 className="text-2xl font-semibold print:hidden">{className}</h2>
      <div className="flex flex-col gap-10 print:hidden">
        <JoinCodeCard classId={classId} />
        <RosterImport
          classId={classId}
          className={className}
          onImported={setCodes}
          onPrint={() => sheet.current?.scrollIntoView?.({ behavior: 'smooth' })}
        />
      </div>
      <div ref={sheet}>{codes.length > 0 && <PrintableCodes className={className} codes={codes} />}</div>
      <div className="flex flex-col gap-10 print:hidden">
        <AssignModule classId={classId} />
        <InstructorDashboard initialClassId={classId} />
      </div>
    </div>
  )
}
