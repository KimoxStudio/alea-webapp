// @vitest-environment node
/**
 * Regression guard for #389.
 *
 * `lib/server/authz.ts`'s `assertMemberRowsScopedSql()` and
 * `lib/server/data-scoping.ts`'s `assertMemberRowsScoped()` are
 * defense-in-depth: the CLAUDE.md convention requires every member-scoped
 * read of `reservations` / `saved_games` to pass its rows through one of
 * them (or, for a single row already fetched by id, an inline ownership
 * check) before mapping to the public shape. Nothing enforced that
 * convention automatically — a new member-scoped read could be added
 * without either guard and nothing would fail. This test is that
 * enforcement.
 *
 * It is a source scan, not a runtime test: for every `lib/server/*.ts`
 * file, it finds each top-level function whose signature mentions
 * `SessionUser` (the project's own signal for "this function acts on
 * behalf of a specific session" — see every admin-only service file,
 * which all thread `SessionUser` the same way) and whose OWN body (not a
 * callee's) contains a `FROM reservations` / `FROM saved_games` read.
 * Such a function must reference `assertMemberRowsScoped(` or
 * `assertMemberRowsScopedSql(` somewhere in its body.
 *
 * This does not flag every raw-SQL read of these tables — only ones whose
 * containing function takes a `SessionUser`, which is what distinguishes a
 * session-scoped read from the many legitimate cross-user reads in this
 * codebase (availability checks, admin-gated bulk operations, cron-style
 * helpers) that never see a `SessionUser` at all. A function that takes a
 * `SessionUser` but reads a single row by id and then checks ownership
 * inline (the `assertOwnsResource`-equivalent pattern) is intentionally
 * exempt via KNOWN_SAFE_FUNCTIONS below — each entry names why, so adding
 * one is a deliberate, reviewable act rather than the test guessing.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SERVER_DIR = join(__dirname, '..', '..', 'lib', 'server')

const TARGET_TABLE_PATTERNS = [/FROM reservations\b/, /FROM saved_games\b/]
const SCOPING_GUARD_PATTERNS = [/assertMemberRowsScoped\(/, /assertMemberRowsScopedSql\(/]

/**
 * Functions that take a `SessionUser` and read `reservations`/`saved_games`
 * in their own body without calling either scoping guard, verified safe by
 * inspection. Keyed by `<file>:<function>`.
 */
const KNOWN_SAFE_FUNCTIONS: Record<string, string> = {
  'saved-games-service.ts:renewSavedGameForSession':
    'Fetches a single saved game by id (LIMIT-1-shaped, no ORDER BY/list ' +
    'semantics) and checks ownership inline (`current.user_id !== session.id`) ' +
    'before any mutation — the same invariant assertOwnsResource() encodes for ' +
    'a single already-fetched row, just written inline. There is no list of ' +
    'rows here for assertMemberRowsScoped(Sql) to verify.',
}

type FunctionSpan = { name: string; signature: string; body: string }

/**
 * Extracts every top-level `function`/`async function` declaration (with or
 * without `export`) from a service file's source, matching this codebase's
 * consistent style for service-layer functions. Arrow functions and class
 * methods are out of scope — none of these service files use them for their
 * exported surface.
 */
function extractFunctions(source: string): FunctionSpan[] {
  const functions: FunctionSpan[] = []
  const declRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm
  let match: RegExpExecArray | null

  while ((match = declRegex.exec(source)) !== null) {
    const name = match[1]
    const openParenIndex = match.index + match[0].length - 1
    const bodyStart = source.indexOf('{', openParenIndex)
    if (bodyStart === -1) continue

    let depth = 0
    let bodyEnd = -1
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) {
          bodyEnd = i
          break
        }
      }
    }
    if (bodyEnd === -1) continue

    functions.push({
      name,
      signature: source.slice(match.index, bodyStart),
      body: source.slice(bodyStart, bodyEnd + 1),
    })
  }

  return functions
}

const serviceFiles = readdirSync(SERVER_DIR).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
)

describe('member-scoped reservations/saved_games reads are guarded (#389)', () => {
  it.each(serviceFiles)('%s: every SessionUser-scoped read of reservations/saved_games is guarded', (file) => {
    const source = readFileSync(join(SERVER_DIR, file), 'utf-8')
    const violations: string[] = []

    for (const fn of extractFunctions(source)) {
      const takesSessionUser = fn.signature.includes('SessionUser')
      const readsTargetTable = TARGET_TABLE_PATTERNS.some((pattern) => pattern.test(fn.body))
      if (!takesSessionUser || !readsTargetTable) continue

      const isGuarded = SCOPING_GUARD_PATTERNS.some((pattern) => pattern.test(fn.body))
      if (isGuarded) continue

      const key = `${file}:${fn.name}`
      if (key in KNOWN_SAFE_FUNCTIONS) continue

      violations.push(
        `${key} takes a SessionUser and reads reservations/saved_games but never calls ` +
          `assertMemberRowsScoped()/assertMemberRowsScopedSql(). If this is a genuine gap, ` +
          `wire the guard. If it is a single-row-by-id read with an inline ownership check, ` +
          `add it to KNOWN_SAFE_FUNCTIONS with the reason.`,
      )
    }

    expect(violations).toEqual([])
  })

  it('KNOWN_SAFE_FUNCTIONS has no stale entries', () => {
    const allFunctionKeys = new Set<string>()
    for (const file of serviceFiles) {
      const source = readFileSync(join(SERVER_DIR, file), 'utf-8')
      for (const fn of extractFunctions(source)) {
        allFunctionKeys.add(`${file}:${fn.name}`)
      }
    }

    for (const key of Object.keys(KNOWN_SAFE_FUNCTIONS)) {
      expect(allFunctionKeys.has(key), `${key} no longer exists — remove it from KNOWN_SAFE_FUNCTIONS`).toBe(true)
    }
  })
})
