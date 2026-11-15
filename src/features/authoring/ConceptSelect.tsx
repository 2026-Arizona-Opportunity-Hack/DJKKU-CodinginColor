import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listConcepts, upsertConcept } from './api'
import { conceptsKey } from './keys'

const NEW = '__new__'

/** Picks a concept tag (used for learning gain per concept). "New concept..." adds one on the spot. */
export function ConceptSelect({
  label = 'Concept',
  value,
  onChange,
  disabled,
}: {
  label?: string
  value: string | null | undefined
  onChange: (conceptId: string | null) => void
  disabled?: boolean
}) {
  const id = useId()
  const queryClient = useQueryClient()
  const concepts = useQuery({ queryKey: conceptsKey, queryFn: listConcepts })
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const add = useMutation({
    mutationFn: (conceptName: string) => upsertConcept(conceptName),
    onSuccess: async (concept) => {
      await queryClient.invalidateQueries({ queryKey: conceptsKey })
      onChange(concept.id)
      setAdding(false)
      setName('')
    },
  })
  const known = concepts.data?.some((c) => c.id === value)

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        disabled={disabled}
        value={adding ? NEW : (value ?? '')}
        onChange={(e) => (e.target.value === NEW ? setAdding(true) : (setAdding(false), onChange(e.target.value || null)))}
        className="min-h-11 rounded-md border bg-background px-3 py-2"
      >
        <option value="">No concept</option>
        {value && !known && <option value={value}>{value}</option>}
        {concepts.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        {!disabled && <option value={NEW}>New concept…</option>}
      </select>
      {concepts.isError && <p role="alert" className="text-sm text-destructive">We could not load the concepts.</p>}
      {adding && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-name`}>Concept name</Label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <Button type="button" disabled={add.isPending || !name.trim()} onClick={() => add.mutate(name)}>Add concept</Button>
          <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          <p role="alert" className="basis-full text-sm text-destructive empty:hidden">{add.error?.message}</p>
        </div>
      )}
    </div>
  )
}
