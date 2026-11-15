import { handleAttention } from '../../shared/attention/handler'
import type { Env } from '../_lib/env'

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handleAttention(request, env)