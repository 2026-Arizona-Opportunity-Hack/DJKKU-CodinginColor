import type { GuideEntry } from '@/lib/feature'

// What students and visitors can do, for the Guide page. /learn/go/<section> opens it in your own class.
export const playerGuide: GuideEntry[] = [
  { id: 'free-lessons', title: 'Try a free lesson', summary: 'Open lessons anyone can try, no account needed.', to: '/learn/explore', roles: ['visitor', 'student'], group: 'Start learning', step: 2 },
  { id: 'start-here', title: 'Start here', summary: 'Your next step, and a catch-up plan if you missed class.', to: '/learn', roles: ['student'], group: 'Start learning', step: 1 },
  { id: 'path', title: 'Your path', summary: 'Every lesson in your class in order, and why a locked one is locked.', to: '/learn/go/path', roles: ['student'], group: 'Start learning', step: 2 },
  { id: 'python', title: 'Write and run Python', summary: 'Code activities run real Python in the browser: predict, run, then make the checks pass.', to: '/learn/go/path', roles: ['student'], group: 'While you learn', howTo: 'Open a "Try it" activity in your path.' },
  { id: 'grade-explainer', title: 'Explain it for my grade', summary: 'Get any reading or video in words and examples for your grade.', to: '/learn/go/path', roles: ['student', 'visitor'], group: 'While you learn', howTo: 'Open a reading or video and use the panel under it.' },
  { id: 'notes', title: 'Take notes beside the lesson', summary: 'A notes panel that stays open as you move between activities. Only you can see it.', to: '/learn/go/path', roles: ['student'], group: 'While you learn', howTo: 'Press Notes at the top of any lesson.' },
  { id: 'hints', title: 'Get a hint', summary: 'If your class has hints turned on: after a wrong answer, get a hint that points the way without giving the answer.', to: '/learn/go/path', roles: ['student'], group: 'While you learn' },
  { id: 'notebook', title: 'My notebook', summary: 'All your notes, in your own words, by lesson. Printable for test review.', to: '/learn/go/notebook', roles: ['student'], group: 'Review and celebrate', step: 3 },
  { id: 'progress', title: 'My progress', summary: 'What you finished, your pre-test and post-test scores, and how much you grew.', to: '/learn/go/progress', roles: ['student'], group: 'Review and celebrate', step: 4 },
  { id: 'certificate', title: 'Certificates', summary: 'A printable certificate for every module you finish.', to: '/learn/go/progress', roles: ['student'], group: 'Review and celebrate', howTo: 'On My progress, choose "View my certificate".' },
]
