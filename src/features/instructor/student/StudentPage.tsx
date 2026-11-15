import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { QueryStatus } from '@/components/QueryStatus'
import { isDemoMode } from '@/lib/session'
import { demoClass } from '../dashboardData'
import { demoReportInput } from './demoReport'
import { buildStudentReport } from './report'
import { NoteHome } from './NoteHome'
import { StudentActions } from './StudentActions'
import { StudentReportView } from './StudentReportView'
import { loadStudent } from './studentApi'
import { AttentionInsight } from './AttentionInsight'

/**
 * `/instructor/:classId/students/:studentId`: everything about one student in one class.
 * `studentId` may be the roster seat id or the student's profile id.
 */
export function StudentPage() {
  const { classId = '', studentId = '' } = useParams()
  return (
    <div className="flex flex-col gap-6">
      <Link to={`/instructor/${classId}`} className="w-fit text-sm underline underline-offset-4 print:hidden">
        Back to the class
      </Link>
      {isDemoMode() ? <DemoStudent studentId={studentId} /> : <LiveStudent classId={classId} studentKey={studentId} />}
    </div>
  )
}

const studentKey = (classId: string, student: string) => ['instructor', 'student', classId, student] as const

function LiveStudent({ classId, studentKey: key }: { classId: string; studentKey: string }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: studentKey(classId, key),
    queryFn: async () => {
      const loaded = await loadStudent(classId, key)
      return { ...loaded, report: buildStudentReport(loaded.input) }
    },
  })
  return (
    <QueryStatus query={query} label="this student" isEmpty={() => false} empty={null}>
      {(d) => (
        <StudentReportView
          report={d.report}
          actions={
              <>
                <StudentActions
                  report={d.report}
                  classId={classId}
                  memberId={d.memberId}
                  profileId={d.profileId}
                  onChanged={() =>
                    void queryClient.invalidateQueries({
                      queryKey: studentKey(classId, key),
                    })
                  }
                />
                <NoteHome report={d.report} />
                <AttentionInsight report={d.report} />
              </>
            }
        />
      )}
    </QueryStatus>
  )
}

function DemoStudent({ studentId }: { studentId: string }) {
  const name = demoClass.students.find((s) => s.studentId === studentId)?.displayName
  const [now] = useState(() => new Date())
  const report = useMemo(() => buildStudentReport(demoReportInput(now, name)), [now, name])
  return (
    <>
      <p role="status" className="text-sm">Demo mode: this is sample data, not a real student.</p>
      <StudentReportView
        report={report}
        actions={
          <>
            <StudentActions
              report={report}
              classId="demo"
              memberId="demo"
              profileId={null}
              demo
            />
            <NoteHome report={report} />
            <AttentionInsight report={report} demo />
          </>
        }
      />
    </>
  )
}
