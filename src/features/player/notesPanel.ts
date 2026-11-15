import { createContext, useContext } from 'react'

/** Whether the notes side panel is open. Lives in the student layout, so it stays open between activities. */
export const NotesPanelContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} })
export const useNotesPanel = () => useContext(NotesPanelContext)
