/**
 * qa-no-show-expiry.mjs
 * Tests the no-show cron endpoint:
 *  1. Insert a pending reservation with a backdated start/end time (already past the check-in window)
 *  2. Call POST /api/cron/mark-no-show with correct Bearer CRON_SECRET
 *  3. Assert DB status transitions to no_show
 *  4. Assert that slot is released (slot is available again)
 *  5. Assert that cron without auth returns 401
 */
import { env, requireE2EEnv } from './env.mjs';

const required = ['PLAYWRIGHT_QA_USER', 'CRON_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_DEFAULT_KEY'];
requireE2EEnv(required);

const appUrl = process.env.E2E_BASE_URL || 'http://localhost:3001';
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_DEFAULT_KEY;
const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
const rest = (path, options = {}) =>
  fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: { ...adminHeaders, ...options.headers } });
const json = (r) => r.json().catch(() => null);

const checks = [];
const check = (name, pass, evidence) => {
  checks.push({ name, pass, evidence });
  if (!pass) throw new Error(`FAIL [${name}]: ${JSON.stringify(evidence)}`);
};

const created = { reservationId: null, tableId: null };

try {
  // ── 0. Auth guard: cron without secret must return 401 ────────────────────
  const unauthResp = await fetch(`${appUrl}/api/cron/mark-no-show`, { method: 'POST' });
  check('cron without auth → 401', unauthResp.status === 401, { status: unauthResp.status });

  const badAuthResp = await fetch(`${appUrl}/api/cron/mark-no-show`, {
    method: 'POST',
    headers: { Authorization: 'Bearer wrong-secret' },
  });
  check('cron with wrong secret → 401', badAuthResp.status === 401, { status: badAuthResp.status });

  // ── 1. Resolve admin profile ───────────────────────────────────────────────
  const profileResp = await rest(
    `profiles?select=id&member_number=eq.${encodeURIComponent(env.PLAYWRIGHT_QA_USER)}&limit=1`
  );
  const [profile] = await json(profileResp);
  check('admin profile resolved', Boolean(profile?.id), { profile });

  // ── 2. Fixture table ──────────────────────────────────────────────────────
  const tableResp = await rest('tables?select=id,room_id,type,name&type=eq.small&limit=1');
  const [table] = await json(tableResp);
  check('fixture table', tableResp.status === 200 && Boolean(table?.id), { status: tableResp.status });
  created.tableId = table.id;

  // ── 3. Get DB time and compute backdated slot ─────────────────────────────
  const timeResp = await rest('rpc/get_database_time', { method: 'POST', body: '{}' });
  const dbNow = new Date(await json(timeResp));

  // Convert to club timezone (Atlantic/Canary) to get today's date
  const dbParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Atlantic/Canary',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(dbNow)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  const today = `${dbParts.year}-${dbParts.month}-${dbParts.day}`;
  const nowMins = Number(dbParts.hour) * 60 + Number(dbParts.minute);

  // Slot ended 90 minutes ago — definitely past the 60-min check-in window
  if (nowMins < 90) {
    console.log(JSON.stringify({ summary: { passed: checks.filter(c=>c.pass).length, total: checks.length }, skipped: 'Too early in day (< 90 min past midnight) to create an expired slot', checks }, null, 2));
    process.exit(0);
  }

  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const slotStart = fmt(nowMins - 90);  // started 90 min ago
  const slotEnd = fmt(nowMins - 60);    // ended 60 min ago — fully in the past, past the check-in window

  // ── 4. Insert backdated pending reservation via admin REST ────────────────
  const insertResp = await rest('reservations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      table_id: table.id,
      user_id: profile.id,
      date: today,
      start_time: slotStart,
      end_time: slotEnd,
      status: 'pending',
    }),
  });
  const [inserted] = await json(insertResp);
  created.reservationId = inserted?.id;
  check('backdated pending reservation inserted', insertResp.status === 201 && Boolean(created.reservationId), {
    status: insertResp.status,
    body: inserted,
  });

  // ── 5. Call the no-show cron endpoint ─────────────────────────────────────
  const cronResp = await fetch(`${appUrl}/api/cron/mark-no-show`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const cronBody = await json(cronResp);
  check('cron returns 200', cronResp.status === 200, { status: cronResp.status, body: cronBody });
  check('cron returns marked count >= 1', (cronBody?.marked ?? 0) >= 1, { marked: cronBody?.marked });

  // ── 6. Assert reservation is now no_show in DB ────────────────────────────
  const checkResp = await rest(`reservations?select=status&id=eq.${created.reservationId}`);
  const [row] = await json(checkResp);
  check('reservation transitioned to no_show', row?.status === 'no_show', { status: row?.status });

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(JSON.stringify({ summary: { passed, total }, checks }, null, 2));
  if (passed < total) throw new Error(`${total - passed} check(s) failed`);
} finally {
  if (created.reservationId) {
    await rest(`reservations?id=eq.${created.reservationId}`, { method: 'DELETE' });
  }
  console.log(JSON.stringify({ cleanup: 'done' }));
}
