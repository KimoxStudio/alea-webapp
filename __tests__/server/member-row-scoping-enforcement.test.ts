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
 *
 * Function extraction uses the real TypeScript parser (`typescript`, already
 * a project devDependency), not regex/brace-counting — an earlier version
 * hand-rolled signature/body boundary detection and got it wrong twice
 * (generic functions dropped silently; a bare object-literal return type
 * mistaken for the body), because regex cannot reliably describe TypeScript
 * grammar. Asking the actual parser for a `FunctionDeclaration`'s parameter
 * list and body removes that whole class of bug by construction.
 *
 * Limitation, inherent to a source scan rather than a real data-flow check:
 * it looks for the guard call's *text* anywhere in the function body, not
 * that it is actually applied to the array just read (e.g. it would not
 * catch a guard called on the wrong variable, or one hidden inside a
 * comment). A false negative here still requires a human to write code that
 * looks guarded but isn't — it doesn't catch a currently-unguarded read
 * that gets added with no guard call at all, which is the case this test
 * exists to catch.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'

const SERVER_DIR = join(__dirname, '..', '..', 'lib', 'server')

// `(?<!DELETE\s)` excludes `DELETE FROM reservations ...` — a compensating
// delete of a just-created row (see createReservationForSession's rollback),
// not a read that returns member data. `DELETE FROM`/`FROM` share the same
// SQL keyword, but only a SELECT-shaped read is what assertMemberRowsScoped
// (Sql)() defends.
const TARGET_TABLE_PATTERNS = [/(?<!DELETE\s)FROM reservations\b/, /(?<!DELETE\s)FROM saved_games\b/]
const SCOPING_GUARD_PATTERNS = [/assertMemberRowsScoped\(/, /assertMemberRowsScopedSql\(/]

/**
 * Functions that take a `SessionUser` and read `reservations`/`saved_games`
 * in their own body without calling either scoping guard, verified safe by
 * inspection. Keyed by `<file>:<function>`.
 */
const KNOWN_SAFE_FUNCTIONS: Record<string, string> = {
  'saved-games-service.ts:renewSavedGameForSession':
    'Two reads, both safe. (1) Fetches the source saved game by id ' +
    '(LIMIT-1-shaped, no ORDER BY/list semantics) and checks ownership ' +
    'inline (`current.user_id !== session.id`) before any mutation — the ' +
    'same invariant assertOwnsResource() encodes for a single already-' +
    'fetched row, just written inline. (2) The `current_check` CTE inside ' +
    'the locked renewal transaction re-reads that same row by ' +
    '`sg.id = input.renewed_from_id` (a value derived from the row already ' +
    'ownership-checked in (1), never from the caller) purely to confirm it ' +
    'is still `active` under the lock — same row, same guarantee, no list.',
}

type FunctionSpan = { name: string; signature: string; body: string }

/**
 * Extracts every top-level `function`/`async function` declaration (with or
 * without `export`, generic or not) from a service file's source, via the
 * real TypeScript parser. Arrow functions and class methods are out of
 * scope — none of these service files use them for their exported surface.
 * A function overload's signature-only declarations (no body) are skipped;
 * only the implementation (which always has a body) is captured.
 */
function extractFunctions(source: string, fileName: string): FunctionSpan[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const functions: FunctionSpan[] = []

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      functions.push({
        name: node.name.text,
        signature: source.slice(node.getStart(sourceFile), node.body.getStart(sourceFile)),
        body: source.slice(node.body.getStart(sourceFile), node.body.getEnd()),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return functions
}

const serviceFiles = readdirSync(SERVER_DIR).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
)

describe('member-scoped reservations/saved_games reads are guarded (#389)', () => {
  it.each(serviceFiles)('%s: every SessionUser-scoped read of reservations/saved_games is guarded', (file) => {
    const source = readFileSync(join(SERVER_DIR, file), 'utf-8')
    const violations: string[] = []

    for (const fn of extractFunctions(source, file)) {
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
      for (const fn of extractFunctions(source, file)) {
        allFunctionKeys.add(`${file}:${fn.name}`)
      }
    }

    for (const key of Object.keys(KNOWN_SAFE_FUNCTIONS)) {
      expect(allFunctionKeys.has(key), `${key} no longer exists — remove it from KNOWN_SAFE_FUNCTIONS`).toBe(true)
    }
  })
})
