// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseDumpTables, validateDump } from '@/lib/cutover/dump-integrity.mjs'

describe('dump-integrity module — pg_dump structural validation', () => {
  describe('parseDumpTables function', () => {
    it('parses a single COPY block with two rows', () => {
      const dump = `
COPY public.profiles (id, email) FROM stdin;
user-1\tmember@example.com
user-2\tmember2@example.com
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(2)
    })

    it('parses multiple COPY blocks', () => {
      const dump = `
COPY public.profiles (id, email) FROM stdin;
user-1\tmember@example.com
\\.

COPY public.rooms (id, name) FROM stdin;
room-1\tRoom A
room-2\tRoom B
\\.

COPY public.reservations (id, room_id) FROM stdin;
res-1\troom-1
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(1)
      expect(result.get('rooms')).toBe(2)
      expect(result.get('reservations')).toBe(1)
    })

    it('handles table names without the public. prefix', () => {
      const dump = `
COPY profiles (id) FROM stdin;
user-1
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(1)
    })

    it('handles table names with quotes', () => {
      const dump = `
COPY public."profiles" (id) FROM stdin;
user-1
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(1)
    })

    it('counts zero rows for an empty COPY block', () => {
      const dump = `
COPY public.profiles (id) FROM stdin;
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(0)
    })

    it('ignores non-COPY lines (e.g. CREATE TABLE, indexes)', () => {
      const dump = `
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE INDEX idx_profiles_email ON public.profiles (email);

COPY public.profiles (id, email) FROM stdin;
user-1\tmember@example.com
user-2\tmember2@example.com
\\.

ALTER TABLE public.profiles ADD CONSTRAINT ...;
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(2)
      expect(result.size).toBe(1) // only the COPY block was parsed
    })

    it('handles tabs and spaces in data rows', () => {
      const dump = `
COPY public.profiles (id, name) FROM stdin;
user-1\tJohn Doe
user-2\tJane Smith
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(2)
    })

    it('handles data containing the terminator on its own line', () => {
      const dump = `
COPY public.data (id, content) FROM stdin;
row-1\tsome data
row-2\tmore data
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('data')).toBe(2)
    })

    it('returns an empty map when no COPY blocks exist', () => {
      const dump = `
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE INDEX idx_profiles_email ON public.profiles (email);
`
      const result = parseDumpTables(dump)
      expect(result.size).toBe(0)
    })

    it('handles a large dump with many tables and rows', () => {
      let dump = ''
      const tables = ['profiles', 'rooms', 'reservations', 'events', 'equipment']
      const rowsPerTable = [100, 50, 200, 10, 30]

      for (let i = 0; i < tables.length; i++) {
        dump += `\nCOPY public.${tables[i]} (id) FROM stdin;\n`
        for (let j = 0; j < rowsPerTable[i]; j++) {
          dump += `${tables[i]}-${j}\n`
        }
        dump += '\\.\n'
      }

      const result = parseDumpTables(dump)
      expect(result.get('profiles')).toBe(100)
      expect(result.get('rooms')).toBe(50)
      expect(result.get('reservations')).toBe(200)
      expect(result.get('events')).toBe(10)
      expect(result.get('equipment')).toBe(30)
    })

    it('ignores incomplete COPY blocks (no terminator)', () => {
      const dump = `
COPY public.profiles (id) FROM stdin;
user-1
user-2
`
      const result = parseDumpTables(dump)
      // No terminator means this COPY block is not finished, so it should not be counted
      expect(result.get('profiles')).toBeUndefined()
    })

    it('correctly pairs multiple terminators with their COPY blocks', () => {
      const dump = `
COPY public.a (id) FROM stdin;
a1
\\.

COPY public.b (id) FROM stdin;
b1
b2
\\.

COPY public.c (id) FROM stdin;
c1
c2
c3
\\.
`
      const result = parseDumpTables(dump)
      expect(result.get('a')).toBe(1)
      expect(result.get('b')).toBe(2)
      expect(result.get('c')).toBe(3)
    })
  })

  describe('validateDump function', () => {
    const FULL_DUMP = `
CREATE TABLE public.profiles (id uuid PRIMARY KEY);

COPY public.profiles (id, email) FROM stdin;
user-1\tmember@example.com
user-2\tmember2@example.com
\\.

CREATE TABLE public.rooms (id uuid PRIMARY KEY);

COPY public.rooms (id, name) FROM stdin;
room-1\tRoom A
\\.

CREATE TABLE public.reservations (id uuid PRIMARY KEY);

COPY public.reservations (id, room_id, user_id) FROM stdin;
res-1\troom-1\tuser-1
\\.
`

    const EXPECTED_TABLES = ['profiles', 'rooms', 'reservations']

    it('returns ok=true when all expected tables are present', () => {
      const result = validateDump(FULL_DUMP, EXPECTED_TABLES)
      expect(result.ok).toBe(true)
      expect(result.missingTables).toHaveLength(0)
    })

    it('returns row counts in the result', () => {
      const result = validateDump(FULL_DUMP, EXPECTED_TABLES)
      expect(result.tableRowCounts.get('profiles')).toBe(2)
      expect(result.tableRowCounts.get('rooms')).toBe(1)
      expect(result.tableRowCounts.get('reservations')).toBe(1)
    })

    it('detects missing tables and sets ok=false', () => {
      const truncatedDump = FULL_DUMP.split('COPY public.reservations')[0]
      const result = validateDump(truncatedDump, EXPECTED_TABLES)
      expect(result.ok).toBe(false)
      expect(result.missingTables).toContain('reservations')
    })

    it('detects multiple missing tables', () => {
      const minimalDump = `
COPY public.profiles (id) FROM stdin;
user-1
\\.
`
      const result = validateDump(minimalDump, EXPECTED_TABLES)
      expect(result.ok).toBe(false)
      expect(result.missingTables).toHaveLength(2)
      expect(result.missingTables).toContain('rooms')
      expect(result.missingTables).toContain('reservations')
    })

    it('reports extra tables found but not expected', () => {
      const dumpWithExtra = FULL_DUMP + `
COPY public.extra_table (id) FROM stdin;
extra-1
\\.
`
      const result = validateDump(dumpWithExtra, EXPECTED_TABLES)
      expect(result.ok).toBe(true) // missing tables take precedence, extra is non-blocking
      expect(result.extraTables).toContain('extra_table')
    })

    it('allows extra tables without setting ok=false (schema drift is acceptable)', () => {
      const dumpWithExtra = FULL_DUMP + `
COPY public.new_feature_table (id) FROM stdin;
nf-1
\\.
`
      const result = validateDump(dumpWithExtra, EXPECTED_TABLES)
      expect(result.ok).toBe(true)
      expect(result.extraTables).toContain('new_feature_table')
    })

    it('returns an empty extraTables array when no extra tables exist', () => {
      const result = validateDump(FULL_DUMP, EXPECTED_TABLES)
      expect(result.extraTables).toHaveLength(0)
    })

    it('validates an empty expected list (all tables are extra)', () => {
      const result = validateDump(FULL_DUMP, [])
      expect(result.ok).toBe(true)
      expect(result.extraTables).toHaveLength(3)
    })

    it('validates a dump with no tables against an empty expected list', () => {
      const emptyDump = 'CREATE TABLE foo; CREATE INDEX bar;'
      const result = validateDump(emptyDump, [])
      expect(result.ok).toBe(true)
      expect(result.missingTables).toHaveLength(0)
      expect(result.extraTables).toHaveLength(0)
    })

    it('validates a dump with no tables against a non-empty expected list', () => {
      const emptyDump = 'CREATE TABLE foo; CREATE INDEX bar;'
      const result = validateDump(emptyDump, ['profiles', 'rooms'])
      expect(result.ok).toBe(false)
      expect(result.missingTables).toHaveLength(2)
    })

    it('handles duplicate expected tables in the input list', () => {
      const result = validateDump(FULL_DUMP, ['profiles', 'profiles', 'rooms', 'reservations'])
      expect(result.ok).toBe(true)
    })

    it('case-sensitively matches table names', () => {
      const result = validateDump(FULL_DUMP, ['Profiles', 'Rooms', 'Reservations'])
      expect(result.ok).toBe(false)
      expect(result.missingTables).toHaveLength(3)
    })

    it('returns the correct structure for a cutover safety check', () => {
      const result = validateDump(FULL_DUMP, EXPECTED_TABLES)
      expect(result).toHaveProperty('ok')
      expect(result).toHaveProperty('missingTables')
      expect(result).toHaveProperty('extraTables')
      expect(result).toHaveProperty('tableRowCounts')
      expect(result.missingTables).toBeInstanceOf(Array)
      expect(result.extraTables).toBeInstanceOf(Array)
      expect(result.tableRowCounts).toBeInstanceOf(Map)
    })
  })
})
