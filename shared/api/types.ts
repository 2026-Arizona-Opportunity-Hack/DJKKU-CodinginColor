// Shapes of the read API. docs/openapi.yaml is the contract; keep them in sync (a test
// checks the privacy threshold). No React, DOM or Workers-only APIs here.

/**
 * Groups with fewer students than this are never returned (minors' privacy). The
 * database views already leave them out (api_class_gain, api_class_progress); the API
 * checks again so a change to a view cannot silently leak a small group.
 */
export const MIN_GROUP_SIZE = 5

/** What an API key may read. Set when an admin creates the key (api_keys.scope). */
export type ApiScope = 'progress' | 'assessments'
export const API_SCOPES: readonly ApiScope[] = ['progress', 'assessments']

export type GroupBy = 'class' | 'cohort'

export interface ApiResponse<Row> {
  /** ISO 8601 time the numbers were computed, so a dashboard can show freshness. */
  as_of: string
  api_version: 'v1'
  rows: Row[]
}

/** Completion. Needs the `progress` scope. */
export interface CompletionRow {
  /** School plus term, for example "Maryvale 2026 Fall". */
  cohort: string
  /** Null when grouped by cohort. */
  class: string | null
  students: number
  /** Average completion of required activities, 0 to 100. */
  avg_completion_pct: number
}

/** Learning gain. Needs the `assessments` scope. Field names follow ADR 0020. */
export interface LearningGainRow {
  cohort: string
  class: string | null
  module: string
  /** Null means the overall test, not one concept. */
  concept: string | null
  /** Students with both a pre and a post score. Only these feed the numbers. */
  complete_count: number
  /** Students missing a pre or a post. Reported, never counted as zero. */
  incomplete_count: number
  pre_pct: number
  post_pct: number
  /** post_pct minus pre_pct, in points. */
  gain_points: number
  /** (post - pre) / (100 - pre), or null when pre_pct is 100. */
  normalized_gain: number | null
}

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_parameter'
  | 'unavailable'
  | 'internal'

export interface ApiError {
  error: { code: ApiErrorCode; message: string }
}
