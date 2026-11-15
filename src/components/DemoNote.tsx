import type { ReactNode } from 'react'

/** The page body for a staff screen when no database is connected: a heading and one plain sentence. */
export function DemoNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p role="status">{children}</p>
    </div>
  )
}
