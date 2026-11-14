/** One id per outgoing request, sent as `x-request-id` and shown to the user on failure. */
export function newRequestId(): string {
  return crypto.randomUUID()
}

/** Short form for UI ("ref 3f2a9c1d"). The full id stays in the logs. */
export function shortRef(requestId: string): string {
  return requestId.slice(0, 8)
}
