import { z } from 'zod'

/** B4: display name only. 1-40 chars, no emails or links (keeps personal data out). */
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(40, 'Use 40 characters or fewer.')
  .refine((s) => !/\S+@\S+/.test(s), 'Leave out email addresses.')
  .refine((s) => !/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|dev|edu|gov)\b)/i.test(s), 'Leave out links.')

