// Messages between the page and the Python worker.
export interface RunRequest { id: number; code: string; tests: string[] }
export interface PyError { type: string; message: string; line: number | null }
export interface CheckResult { test: string; passed: boolean; error?: string }
export type RunResponse =
  | { id: number; ok: true; stdout: string; error: PyError | null; checks: CheckResult[] }
  | { id: number; ok: false; loadError: string }
