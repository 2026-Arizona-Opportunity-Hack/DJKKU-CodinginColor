// API keys are created, hashed, scoped, revoked and checked inside the database
// (create_api_key, revoke_api_key, validate_api_key; see docs/contracts/database-api.md).
// The raw key is shown once and only its sha256 hash is stored. This file only reads
// the key off the request; it never hashes or compares anything itself, so there is a
// single place (the database) that decides whether a key is valid.

/** Pulls the token out of `Authorization: Bearer <token>`. Null for anything else. */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match ? match[1] : null
}
