// Class setup input, checked the same way by the form and (through the database's own
// constraints) by create_class. Lengths mirror the classes and schools columns.
import { z } from 'zod'

export const CreateClassSchema = z.object({
  schoolName: z.string().trim().min(1, 'Enter the school name.').max(120, 'Use 120 characters or fewer.'),
  name: z.string().trim().min(1, 'Enter the class name.').max(120, 'Use 120 characters or fewer.'),
  term: z.string().trim().max(40, 'Use 40 characters or fewer.').optional(),
})
export type CreateClassInput = z.infer<typeof CreateClassSchema>
