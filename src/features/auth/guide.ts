import type { GuideEntry } from '@/lib/feature'

export const authGuide: GuideEntry[] = [
  { id: 'sign-in-code', title: 'Sign in with your login code', summary: 'Students type the code from their teacher. No email or password.', to: '/sign-in', roles: ['visitor'], group: 'Get in', step: 3 },
  { id: 'join-link', title: 'Join a class from a link', summary: 'Open the class link or QR code your teacher shared, then pick your name.', to: '/sign-in', roles: ['visitor'], group: 'Get in', step: 4, howTo: 'Your teacher shares a link like /join/ABC123, or type the 12-letter class code on the sign-in page.' },
  { id: 'staff-sign-in', title: 'Staff sign in with Google', summary: 'Teachers, authors, reviewers and CIC staff sign in with the Google account CIC invited.', to: '/sign-in', roles: ['visitor', 'instructor', 'author', 'reviewer', 'cic_admin'], group: 'Get in' },
]
