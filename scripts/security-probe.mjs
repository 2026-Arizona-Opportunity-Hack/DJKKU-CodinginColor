#!/usr/bin/env node
// Security probe (SECURITY_QA_CHECKLIST S-14, S-15, S-16, S-32, S-83).
// Talks to the Supabase REST API exactly as a browser would, with the public anon key only, and prints a
// markdown table of what each kind of caller can reach. Run it against local and production:
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... node scripts/security-probe.mjs
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=... node scripts/security-probe.mjs
//
// Optional: STUDENT_LOGIN_CODE=DEMO-0000-0000-0001 also probes as a claimed student. A login code works
// once, so use it on local only (then `npx supabase db reset`), never with production demo codes.
// PROBE_NO_SESSION=1 skips the anonymous session (use on production so no test user is created).
// Exit code 1 when any check fails.

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const anon = process.env.SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (the public anon key, never the service key).')
  process.exit(2)
}

// Readable without signing in, by design: published curriculum for guests (RLS limits it to open modules).
const PUBLIC_TABLES = new Set(['activities', 'assessment_items', 'assessments', 'concepts', 'lessons', 'modules'])
const PUBLIC_RPCS = new Set(['can_read_module', 'get_activity', 'list_join_roster', 'list_open_modules'])
// Never readable by any browser session.
const SECRET_TABLES = ['activity_keys', 'assessment_keys', 'api_keys', 'api_key_secrets', 'staff_invites', 'member_login_codes', 'class_join_codes', 'hint_cache']

const results = []
const record = (who, check, ok, detail) => results.push({ who, check, ok, detail })

async function rest(path, token, init = {}) {
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: anon, Authorization: `Bearer ${token ?? anon}`, 'Content-Type': 'application/json', ...init.headers },
  })
  let body = null
  try { body = await res.json() } catch { /* empty */ }
  return { status: res.status, body }
}

async function exposed(token) {
  const { body } = await rest('/rest/v1/', token)
  const paths = Object.keys(body?.paths ?? {}).filter((p) => p !== '/')
  return {
    tables: paths.filter((p) => !p.startsWith('/rpc/')).map((p) => p.slice(1)),
    rpcs: paths.filter((p) => p.startsWith('/rpc/')).map((p) => p.slice(5)),
  }
}

async function rows(table, token) {
  const r = await rest(`/rest/v1/${table}?select=*&limit=1000`, token)
  return Array.isArray(r.body) ? r.body : null // null = refused
}

// 1. A stranger with only the anon key (S-14).
{
  const { tables, rpcs } = await exposed()
  const extraTables = tables.filter((t) => !PUBLIC_TABLES.has(t))
  const extraRpcs = rpcs.filter((f) => !PUBLIC_RPCS.has(f))
  const hidden = tables.length === 0 && rpcs.length === 0 ? 'API listing hidden by the host; see the per-table rows below' : ''
  record('anon', 'only curriculum tables are exposed', extraTables.length === 0, hidden || extraTables.join(', ') || tables.join(', '))
  record('anon', 'only guest functions are exposed', extraRpcs.length === 0, hidden || extraRpcs.join(', ') || rpcs.join(', '))
  for (const t of SECRET_TABLES) {
    const r = await rows(t)
    record('anon', `cannot read ${t}`, r === null || r.length === 0, r === null ? 'refused' : `${r.length} rows`)
  }
  for (const t of ['profiles', 'class_members', 'progress', 'submissions', 'student_notes']) {
    const r = await rows(t)
    record('anon', `cannot read ${t}`, r === null || r.length === 0, r === null ? 'refused' : `${r.length} rows`)
  }
  const keyFields = /correctChoiceId|"accepted"|"blanks"|correctOrder|"hints"/
  const acts = (await rows('activities')) ?? []
  record('anon', 'published content has no answer-key fields', !keyFields.test(JSON.stringify(acts)), `${acts.length} activities checked`)
  const signup = await rest('/auth/v1/signup', anon, { method: 'POST', body: JSON.stringify({ email: `probe-${Date.now()}@example.com`, password: 'Probe-password-123!' }) })
  record('anon', 'email and password sign-up is off (S-31)', signup.status >= 400, `HTTP ${signup.status}`)
}

// 2. An anonymous session that has not claimed a code (S-32).
let token = null
if (!process.env.PROBE_NO_SESSION) {
  const r = await rest('/auth/v1/signup', anon, { method: 'POST', body: JSON.stringify({ data: {} }) })
  token = r.body?.access_token ?? null
  record('unclaimed', 'anonymous sign-in works (students need it)', Boolean(token), `HTTP ${r.status}`)
  if (token) {
    for (const t of [...SECRET_TABLES, 'profiles', 'class_members', 'progress', 'submissions', 'student_notes', 'v_class_progress', 'v_learning_gain', 'classes', 'schools']) {
      const r2 = await rows(t, token)
      const own = t === 'profiles' && r2?.length === 1 // a session may read its own profile row
      record('unclaimed', `reads nothing in ${t}`, r2 === null || r2.length === 0 || own, r2 === null ? 'refused' : `${r2.length} rows${own ? ' (own profile)' : ''}`)
    }
    const me = await rest('/rest/v1/rpc/get_me', token, { method: 'POST', body: '{}' })
    record('unclaimed', 'get_me shows no class', !me.body?.class_id, JSON.stringify(me.body)?.slice(0, 80))
  }
}

// 3. A claimed student (S-15, S-16). Local only: claiming uses the code up.
if (process.env.STUDENT_LOGIN_CODE && token) {
  const c = await rest('/rest/v1/rpc/claim_login_code', token, { method: 'POST', body: JSON.stringify({ p_code: process.env.STUDENT_LOGIN_CODE }) })
  record('student', 'claims the login code', c.status < 300, `HTTP ${c.status}`)
  const me = (await rest('/rest/v1/rpc/get_me', token, { method: 'POST', body: '{}' })).body
  const uid = me?.profile_id
  for (const t of SECRET_TABLES) {
    const r = await rows(t, token)
    record('student', `cannot read ${t}`, r === null || r.length === 0, r === null ? 'refused' : `${r.length} rows`)
  }
  for (const [t, col] of [['progress', 'student_id'], ['submissions', 'student_id'], ['assessment_results', 'student_id'], ['student_notes', 'profile_id'], ['profiles', 'id']]) {
    const r = (await rows(t, token)) ?? []
    const others = r.filter((x) => x[col] !== uid).length
    record('student', `sees only own ${t}`, others === 0, `${r.length} rows, ${others} not theirs`)
  }
  const members = (await rows('class_members', token)) ?? []
  record('student', 'roster shows only their own seat', members.every((m) => m.profile_id === uid), `${members.length} rows`)
  const classes = (await rows('classes', token)) ?? []
  record('student', 'sees only their own class', classes.every((k) => k.id === me?.class_id), `${classes.length} rows`)
  const patch = await rest(`/rest/v1/profiles?id=eq.${uid}`, token, { method: 'PATCH', body: JSON.stringify({ role: 'cic_admin', can_author: true }), headers: { Prefer: 'return=representation' } })
  const after = (await rest('/rest/v1/rpc/get_me', token, { method: 'POST', body: '{}' })).body
  record('student', 'cannot make themselves an admin (S-16)', after?.role === 'student' && !after?.can_author, `PATCH HTTP ${patch.status}, role now ${after?.role}`)
  const ins = await rest('/rest/v1/profiles', token, { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), role: 'cic_admin' }) })
  record('student', 'cannot insert a profile with a chosen role (S-16)', ins.status >= 400, `HTTP ${ins.status}`)
}

console.log(`# Security probe: ${url}\n\nRun at ${new Date().toISOString()}\n`)
console.log('| Caller | Check | Result | Detail |\n|---|---|---|---|')
for (const r of results) console.log(`| ${r.who} | ${r.check} | ${r.ok ? 'PASS' : '**FAIL**'} | ${String(r.detail ?? '').replace(/\|/g, '/')} |`)
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed} passed, ${failed} failed.`)
process.exit(failed ? 1 : 0)
