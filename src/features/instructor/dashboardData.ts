export interface DashboardStudent {
  studentId: string
  displayName: string
  wrongAttempts: number
  minutesOnActivity: number
  hintsUsed: number
  daysInactive: number
  progressPercent: number
  currentActivity: string
  preScore: number | null
  postScore: number | null
}
export interface ConceptMastery {
  concept: string
  masteryPercent: number
}

export interface InstructorClass {
  id: string
  name: string
  school: string
  students: DashboardStudent[]
  concepts: ConceptMastery[]
}

// Fictional demo data only. Replace with Lane A's Supabase views when available.
export const demoClass: InstructorClass = {
  id: 'demo-python-1',
  name: 'Intro to Python',
  school: 'Maryvale',
  students: [
    {
      studentId: 'student-1',
      displayName: 'Ava Johnson',
      progressPercent: 58,
      currentActivity: 'Loops · Worksheet 3',
      wrongAttempts: 3,
      minutesOnActivity: 8,
      hintsUsed: 2,
      daysInactive: 0,
      preScore: 42,
      postScore: 68,
    },
    {
      studentId: 'student-2',
      displayName: 'Dee Martinez',
      progressPercent: 47,
      currentActivity: 'Variables · Check 2',
      wrongAttempts: 1,
      minutesOnActivity: 14,
      hintsUsed: 1,
      daysInactive: 0,
      preScore: 50,
      postScore: 67,
    },
    {
      studentId: 'student-3',
      displayName: 'Marcus Lee',
      progressPercent: 0,
      currentActivity: 'Not started',
      wrongAttempts: 0,
      minutesOnActivity: 0,
      hintsUsed: 0,
      daysInactive: 0,
      preScore: null,
      postScore: null,
    },
    {
      studentId: 'student-4',
      displayName: 'Sarah Kim',
      progressPercent: 92,
      currentActivity: 'Functions · Exit question',
      wrongAttempts: 0,
      minutesOnActivity: 4,
      hintsUsed: 0,
      daysInactive: 0,
      preScore: 61,
      postScore: 91,
    },
    {
      studentId: 'student-5',
      displayName: 'Jordan Williams',
      progressPercent: 0,
      currentActivity: 'Not started',
      wrongAttempts: 0,
      minutesOnActivity: 0,
      hintsUsed: 0,
      daysInactive: 0,
      preScore: null,
      postScore: null,
    },
    {
      studentId: 'student-6',
      displayName: 'Maya Patel',
      progressPercent: 74,
      currentActivity: 'Conditionals · Worksheet 2',
      wrongAttempts: 1,
      minutesOnActivity: 5,
      hintsUsed: 0,
      daysInactive: 0,
      preScore: 55,
      postScore: 82,
    },
  ],
  concepts: [
    { concept: 'Variables', masteryPercent: 86 },
    { concept: 'Conditionals', masteryPercent: 74 },
    { concept: 'Loops', masteryPercent: 51 },
  ],
}