import type { ApiScope } from './types'

// Where the read API gets its numbers. The Supabase implementation is in
// supabaseSource.ts; tests use an in-memory one. Rows are class-level and already
// carry readable labels, so the handlers never see raw ids or per-student data.

export interface ApiKeyInfo {
  apiKeyId: string
  scope: ApiScope[]
}

interface ClassLabels {
  class_id: string
  class_name: string
  term: string | null
  /** Null for the "CIC Open" class, which belongs to no school. */
  school_name: string | null
}

export interface ClassProgressRow extends ClassLabels {
  students: number
  avg_completion_pct: number
}

export interface ClassGainRow extends ClassLabels {
  module_id: string
  module_title: string
  concept_id: string | null
  concept_name: string | null
  pre_pct: number | null
  post_pct: number | null
  gain_points: number | null
  normalized_gain: number | null
  complete_count: number
  incomplete_count: number
}

export interface ApiDataSource {
  /** Null when the key is unknown or revoked. Throws only when the source is down. */
  validateKey(rawKey: string): Promise<ApiKeyInfo | null>
  classProgress(): Promise<ClassProgressRow[]>
  classGain(): Promise<ClassGainRow[]>
}
