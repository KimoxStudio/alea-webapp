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
 * file, it finds each function whose signature mentions
 * `SessionUser` (the project's own signal for "this function acts on
 * behalf of a specific session" — see every admin-only service file,
 * which all thread `SessionUser` the same way) and whose OWN body (not a
 * callee's) contains a `FROM reservations` / `FROM saved_games` read.
 * Such a function must call one of the guards (a real call node, not the
 * name in a comment).
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
 * it looks for an actual call to the guard function anywhere in the function
 * body (a real `CallExpression` node whose callee is the guard's identifier,
 * found via the TypeScript AST — not a text/substring search, so a guard
 * name mentioned only in a comment does not count), not that the guard is
 * applied to the array just read. It would still not catch a guard called on
 * the wrong variable. A false negative here still requires a human to write
 * code that looks guarded but isn't — it doesn't catch a currently-unguarded
 * read that gets added with no guard call at all, which is the case this
 * test exists to catch.
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
const SCOPING_GUARD_NAMES = ['assertMemberRowsScoped', 'assertMemberRowsScopedSql']

/**
 * True if `node`'s subtree contains a real call to one of the scoping
 * guards — a `CallExpression` whose callee is an identifier named
 * `assertMemberRowsScoped`/`assertMemberRowsScopedSql` — as opposed to the
 * guard's name merely appearing in a comment or string. The TypeScript AST
 * never turns comment text into nodes, so walking the tree for
 * `CallExpression`s excludes comments by construction.
 */
function containsGuardCall(node: ts.Node): boolean {
  let found = false

  function visit(n: ts.Node) {
    if (found) return
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && SCOPING_GUARD_NAMES.includes(n.expression.text)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)

  return found
}

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

type FunctionSpan = { name: string; signature: string; body: string; bodyNode: ts.Node }

/**
 * Extracts every `function`/`async function` declaration (with or
 * without `export`, generic or not) AND any single-declarator `const`/`let`
 * initialized to an arrow function, exported or not, at any nesting level
 * (this walk recurses into function bodies too, the same way it already did
 * for nested `function` declarations) — via the real TypeScript parser.
 * Class methods, function expressions (`const foo = function () {}`), and
 * multi-declarator statements (`const a = () => {}, b = () => {}`) are still
 * out of scope — none of these service files use them for their exported
 * surface. A function overload's signature-only declarations (no body) are
 * skipped; only the implementation (which always has a body) is captured.
 */
function extractFunctions(source: string, fileName: string): FunctionSpan[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const functions: FunctionSpan[] = []

  function addFunction(name: string, signatureStartNode: ts.Node, bodyNode: ts.Node) {
    functions.push({
      name,
      signature: source.slice(signatureStartNode.getStart(sourceFile), bodyNode.getStart(sourceFile)),
      body: source.slice(bodyNode.getStart(sourceFile), bodyNode.getEnd()),
      bodyNode,
    })
  }

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      addFunction(node.name.text, node, node.body)
    } else if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1) {
      const [declaration] = node.declarationList.declarations
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        ts.isArrowFunction(declaration.initializer)
      ) {
        addFunction(declaration.name.text, node, declaration.initializer.body)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return functions
}

/**
 * Runs the scan's rule against one file's already-read source: every
 * function taking a `SessionUser` and reading `reservations`/`saved_games`
 * must call one of the scoping guards, unless it's in KNOWN_SAFE_FUNCTIONS.
 * Returns the violation messages (empty when the file is clean). Factored
 * out of the `it.each` below so fixture sources can be scanned directly in
 * unit tests without touching disk.
 */
function findScopingViolations(source: string, file: string): string[] {
  const violations: string[] = []

  for (const fn of extractFunctions(source, file)) {
    const takesSessionUser = fn.signature.includes('SessionUser')
    const readsTargetTable = TARGET_TABLE_PATTERNS.some((pattern) => pattern.test(fn.body))
    if (!takesSessionUser || !readsTargetTable) continue

    const isGuarded = containsGuardCall(fn.bodyNode)
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

  return violations
}

const serviceFiles = readdirSync(SERVER_DIR).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
)

describe('member-scoped reservations/saved_games reads are guarded (#389)', () => {
  it.each(serviceFiles)('%s: every SessionUser-scoped read of reservations/saved_games is guarded', (file) => {
    const source = readFileSync(join(SERVER_DIR, file), 'utf-8')

    expect(findScopingViolations(source, file)).toEqual([])
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

  // Scan-scope gap coverage (#400): the first two fixtures reproduce gaps
  // and must be flagged; the third is the control proving a real guard call
  // still counts.
  it('flags an unguarded read exported as an arrow function, not just a function declaration', () => {
    const fixture = `
      export const listReservationsForSession = async (session: SessionUser) => {
        return await sql\`SELECT * FROM reservations WHERE user_id = \${session.id}\`
      }
    `

    const violations = findScopingViolations(fixture, 'fixture-arrow-unguarded.ts')

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('fixture-arrow-unguarded.ts:listReservationsForSession')
  })

  it('flags a read where the guard name only appears in a comment, not a real call', () => {
    const fixture = `
      export function listReservationsForSession(session: SessionUser) {
        // assertMemberRowsScoped(rows, session) — guard applied below
        const rows = sql\`SELECT * FROM reservations WHERE user_id = \${session.id}\`
        return rows
      }
    `

    const violations = findScopingViolations(fixture, 'fixture-comment-only-guard.ts')

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('fixture-comment-only-guard.ts:listReservationsForSession')
  })

  it('does not flag an arrow-function-exported read that calls the guard for real', () => {
    const fixture = `
      export const listReservationsForSession = async (session: SessionUser) => {
        const rows = await sql\`SELECT * FROM reservations WHERE user_id = \${session.id}\`
        return assertMemberRowsScopedSql(rows, session)
      }
    `

    expect(findScopingViolations(fixture, 'fixture-arrow-guarded.ts')).toEqual([])
  })
})
