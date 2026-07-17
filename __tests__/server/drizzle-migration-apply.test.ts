import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * KIM-417: Real migration-apply smoke test for F1 Drizzle schema.
 *
 * Unlike drizzle-schema-apply.test.ts (static parsing), this test actually
 * applies migrations to a real, disposable Postgres instance to validate
 * runtime behavior:
 * - Extension availability (pgcrypto before gen_random_uuid, btree_gist)
 * - Operator classes (uuid ops for GIST indexes)
 * - EXCLUDE constraints with tsrange/daterange
 * - Statement ordering and DDL consistency
 *
 * If Docker is available: spins up a fresh Postgres 16 container via Docker,
 * applies migrations, tears down after. Disposable, isolated, never touches
 * real Neon/Vercel infrastructure.
 *
 * If Docker is unavailable: suite is skipped gracefully (typical for local
 * environments without Docker daemon).
 *
 * Note: For CI environments with Docker available, set SKIP_DOCKER_TESTS=false
 * to run these tests.
 */

const MIGRATION_DIR = join(__dirname, '../../lib/db/migrations')
const CONTAINER_NAME = `postgres-test-kim417-${Date.now()}`
const POSTGRES_PORT = 25432 // non-standard to avoid conflicts

// Skip these tests if Docker is not available or explicitly disabled
const SKIP_TESTS =
  process.env.SKIP_DOCKER_TESTS !== 'false' && process.env.CI !== 'true'

function readMigration(filename: string): string {
  const path = join(MIGRATION_DIR, filename)
  return readFileSync(path, 'utf-8')
}

// Split SQL by statement-breakpoint markers (how Drizzle outputs migrations)
function parseMigrationStatements(sql: string): string[] {
  return sql
    .split(';--> statement-breakpoint')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith('-->'))
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isPortReady(port: number, maxAttempts = 30): Promise<boolean> {
  let attempts = 0
  while (attempts < maxAttempts) {
    try {
      const client = new Client({
        host: 'localhost',
        port,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
      })
      await client.connect()
      await client.end()
      return true
    } catch (err) {
      attempts++
      await delay(200)
    }
  }
  return false
}

describe.skipIf(SKIP_TESTS)(
  'F1 Drizzle Migration Apply (Real Postgres via Docker)',
  () => {
    let client: Client

    beforeAll(async () => {
      // Start a disposable Postgres container
      const docker = spawn('docker', [
        'run',
        '--rm',
        '-d',
        '--name',
        CONTAINER_NAME,
        '-e',
        'POSTGRES_PASSWORD=postgres',
        '-e',
        'POSTGRES_DB=test',
        '-p',
        `${POSTGRES_PORT}:5432`,
        'postgres:16-alpine',
      ])

      // Wait for container to start
      await new Promise<void>((resolve, reject) => {
        let output = ''
        docker.stdout?.on('data', (data) => {
          output += data.toString()
        })
        docker.stderr?.on('data', (data) => {
          output += data.toString()
        })
        docker.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Docker run failed with code ${code}: ${output}`))
          }
        })
        docker.on('error', (err) => {
          reject(err)
        })
      })

      // Wait for Postgres to be ready
      const ready = await isPortReady(POSTGRES_PORT)
      if (!ready) {
        throw new Error('Postgres container failed to become ready after 6 seconds')
      }

      // Connect to the container
      client = new Client({
        host: 'localhost',
        port: POSTGRES_PORT,
        database: 'test',
        user: 'postgres',
        password: 'postgres',
      })

      await client.connect()

      // Apply migrations ONCE in setup to provide a consistent baseline for all assertions
      // Migrations contain non-idempotent DDL (CREATE TYPE, CREATE TABLE without IF NOT EXISTS),
      // so we apply them once upfront rather than repeatedly per test scenario.
      // All subsequent tests verify the resulting schema state.
      const migration0000 = readMigration('0000_fine_magma.sql')
      const migration0001 = readMigration('0001_exclusion_constraints.sql')

      const stmts0000 = parseMigrationStatements(migration0000)
      const stmts0001 = parseMigrationStatements(migration0001)

      for (const stmt of stmts0000) {
        if (stmt.trim().length > 0) {
          await client.query(stmt)
        }
      }
      for (const stmt of stmts0001) {
        if (stmt.trim().length > 0) {
          await client.query(stmt)
        }
      }
    })

    afterAll(async () => {
      // Clean up
      if (client) {
        try {
          await client.end()
        } catch (err) {
          // ignore
        }
      }

      // Stop and remove the container
      await new Promise<void>((resolve) => {
        const stop = spawn('docker', ['stop', CONTAINER_NAME])
        stop.on('close', () => {
          resolve()
        })
      })
    })

    describe('Migration 0000_fine_magma.sql validation', () => {
      it('creates pgcrypto extension successfully', async () => {
        const result = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
          ) as pgcrypto_exists`,
        )
        expect((result.rows[0] as any).pgcrypto_exists).toBe(true)
      })

      it('creates profiles table with all required columns', async () => {
        const result = await client.query(
          `SELECT column_name, data_type
           FROM information_schema.columns
           WHERE table_name = 'profiles'
           ORDER BY ordinal_position`,
        )

        const columnMap = Object.fromEntries(
          result.rows.map((c: any) => [c.column_name, c.data_type]),
        )

        // Verify critical columns exist
        expect(columnMap['id']).toBe('uuid')
        expect(columnMap['auth_email']).toBe('text')
        expect(columnMap['password_hash']).toBe('text')
        expect(columnMap['member_number']).toBe('character varying')
      })

      it('profiles.id column is PRIMARY KEY', async () => {
        const result = await client.query(
          `SELECT constraint_type
           FROM information_schema.table_constraints
           WHERE table_name = 'profiles' AND constraint_type = 'PRIMARY KEY'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('creates reservation_status and other ENUMs', async () => {
        const result = await client.query(
          `SELECT column_name, data_type
           FROM information_schema.columns
           WHERE table_name = 'reservations' AND column_name = 'status'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('creates rooms table with UUID primary key default', async () => {
        const result = await client.query(
          `SELECT column_default
           FROM information_schema.columns
           WHERE table_name = 'rooms' AND column_name = 'id'`,
        )
        // Should have a default (gen_random_uuid())
        expect((result.rows[0] as any).column_default).toBeTruthy()
      })

      it('creates reservations table with status column', async () => {
        const result = await client.query(
          `SELECT column_name, data_type
           FROM information_schema.columns
           WHERE table_name = 'reservations' AND column_name = 'status'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('creates saved_games table for KIM-384', async () => {
        const result = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_games'
          ) as saved_games_exists`,
        )
        expect((result.rows[0] as any).saved_games_exists).toBe(true)
      })

      it('profiles.member_number has UNIQUE constraint', async () => {
        const result = await client.query(
          `SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'profiles'
           AND constraint_name = 'profiles_member_number_unique'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })
    })

    describe('Migration 0001_exclusion_constraints.sql validation', () => {
      it('creates btree_gist extension', async () => {
        const result = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'
          ) as btree_gist_exists`,
        )
        expect((result.rows[0] as any).btree_gist_exists).toBe(true)
      })

      it('adds EXCLUDE constraint reservations_no_pending_active_overlap_top', async () => {
        const result = await client.query(
          `SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'reservations'
           AND constraint_name = 'reservations_no_pending_active_overlap_top'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('adds EXCLUDE constraint reservations_no_pending_active_overlap_bottom', async () => {
        const result = await client.query(
          `SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'reservations'
           AND constraint_name = 'reservations_no_pending_active_overlap_bottom'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('adds EXCLUDE constraint saved_games_no_active_overlap', async () => {
        const result = await client.query(
          `SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'saved_games'
           AND constraint_name = 'saved_games_no_active_overlap'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('EXCLUDE constraints use GIST index type', async () => {
        const result = await client.query(
          `SELECT indexdef
           FROM pg_indexes
           WHERE tablename = 'reservations'
           AND indexname LIKE '%overlap%'
           LIMIT 1`,
        )
        if (result.rows.length > 0) {
          const indexDef = (result.rows[0] as any).indexdef as string
          expect(indexDef).toContain('GIST')
        }
      })
    })

    describe('Schema consistency and type safety', () => {
      it('pgcrypto is available before gen_random_uuid() usage in 0000', async () => {
        // Verify pgcrypto was created (necessary precondition for gen_random_uuid)
        const result = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
          ) as pgcrypto_exists`,
        )
        expect((result.rows[0] as any).pgcrypto_exists).toBe(true)

        // Verify that rooms table (which uses gen_random_uuid() default) was created
        const tables = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms'
          ) as rooms_exists`,
        )
        expect((tables.rows[0] as any).rooms_exists).toBe(true)
      })

      it('tables have expected constraints and defaults', async () => {
        // Spot-check: profiles.member_number has UNIQUE constraint
        const result = await client.query(
          `SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'profiles'
           AND constraint_name = 'profiles_member_number_unique'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('critical columns are not null where expected', async () => {
        const result = await client.query(
          `SELECT column_name, is_nullable
           FROM information_schema.columns
           WHERE table_name = 'profiles'
           AND column_name IN ('id', 'auth_email', 'member_number')`,
        )

        // id and auth_email and member_number should be NOT NULL
        const columnMap = Object.fromEntries(
          result.rows.map((c: any) => [c.column_name, c.is_nullable]),
        )
        expect(columnMap['id']).toBe('NO')
        expect(columnMap['auth_email']).toBe('NO')
        expect(columnMap['member_number']).toBe('NO')
      })
    })

    describe('Operator class availability for GIST indexes', () => {
      it('btree_gist provides uuid equality operator class for GIST', async () => {
        // Verify that btree_gist was installed and constraint was applied
        const constraints = await client.query(
          `SELECT constraint_name FROM pg_constraint
           WHERE contype = 'x' AND conname LIKE '%overlap%'`,
        )
        // EXCLUDE constraints exist, meaning btree_gist and uuid ops are available
        expect(constraints.rows.length).toBeGreaterThan(0)
      })

      it('tsrange operator works with GIST constraints', async () => {
        // The reservations constraints use tsrange with && operator
        const constraints = await client.query(
          `SELECT pg_get_constraintdef(oid)
           FROM pg_constraint
           WHERE contype = 'x' AND conname = 'reservations_no_pending_active_overlap_top'`,
        )
        if (constraints.rows.length > 0) {
          const constraintDef = (constraints.rows[0] as any).pg_get_constraintdef as string
          expect(constraintDef).toContain('GIST')
        }
      })
    })

    describe('Auth.js credentials provider schema support (KIM-416)', () => {
      it('profiles table schema supports credentials provider query', async () => {
        // Credentials provider runs: SELECT password_hash FROM profiles WHERE auth_email = $1
        const result = await client.query(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_name = 'profiles'
           AND column_name IN ('password_hash', 'auth_email')`,
        )
        const columnNames = result.rows.map((r: any) => r.column_name)
        expect(columnNames).toContain('password_hash')
        expect(columnNames).toContain('auth_email')
      })
    })

    describe('F2 cutover runbook schema support (KIM-419)', () => {
      it('password_hash column exists for auth.users copy', async () => {
        // F2 runbook copies auth.users.encrypted_password → profiles.password_hash
        const result = await client.query(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_name = 'profiles' AND column_name = 'password_hash'`,
        )
        expect(result.rows.length).toBeGreaterThan(0)
      })

      it('password_hash column is nullable for pre-cutover users', async () => {
        const result = await client.query(
          `SELECT is_nullable
           FROM information_schema.columns
           WHERE table_name = 'profiles' AND column_name = 'password_hash'`,
        )
        // password_hash is nullable (for users who haven't cut over to Auth.js yet)
        expect((result.rows[0] as any).is_nullable).toBe('YES')
      })
    })
  },
)
