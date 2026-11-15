import { createContext } from 'react'

/** Problems the database reported when submitting or publishing, so each question can show its own. */
export const IssuesContext = createContext<string[]>([])
