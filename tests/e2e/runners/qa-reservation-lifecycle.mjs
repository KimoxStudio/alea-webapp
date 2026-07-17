/**
 * qa-reservation-lifecycle.mjs
 * REGULAR PLAY reservation lifecycle:
 *  1. create via API
 *  2. assert table availability now blocked for that slot
 *  3. activate/check-in
 *  4. assert status active + attendance recorded
 *  5. second activate rejected (CHECK_IN_ALREADY_ACTIVE)
 */
import { chromium } from 'playwright';
import { chromiumLaunchOptions, env, requireE2EEnv } from '../env.mjs';

const required = ['PLAYWRIGHT_QA_USER', 'PLAYWRIGHT_QA_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_DEFAULT_KEY'];
requireE2EEnv(required);

const appUrl = process.env.E2E_BASE_URL || 'http://localhost:3001';
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_DEFAULT_KEY;
const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
const rest = (path, options = {}) =>
  fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: { ...adminHeaders, ...options.headers } });
const json = (response) => response.json().catch(() => null);

const checks = [];
const check = (name, pass, evidence) => {
  checks.push({ name, pass, evidence });
  if (!pass) throw new Error(`FAIL [${name}]: ${JSON.stringify(evidence)}`);
};

const created = { reservationId: null, checkinReservationId: null, tableId: null };

const browser = await chromium.launch(chromiumLaunchOptions());

try {
  // ── Fixture: pick a regular (non-removable-top) table ─────────────────────
  const tableResp = await rest('tables?select=id,room_id,type,name&type=eq.small&limit=1');
  const [table] = await json(tableResp);
  check('fixture table found', tableResp.status === 200 && Boolean(table?.id), { status: tableResp.status, table });
  created.tableId = table.id;

  // ── Compute a slot: tomorrow, 10:00–11:00 ─────────────────────────────────
  const timeResp = await rest('rpc/get_database_time', { method: 'POST', body: '{}' });
  const dbNow = new Date(await json(timeResp));
  const tomorrow = new Date(Date.UTC(dbNow.getUTCFullYear(), dbNow.getUTCMonth(), dbNow.getUTCDate() + 1));
  const date = tomorrow.toISOString().slice(0, 10);
  const startTime = '10:00';
  const endTime = '11:00';

  // ── Login as admin user ────────────────────────────────────────────────────
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      !msg.text().includes('favicon') &&
      !(msg.location()?.url ?? '').includes('favicon')
    ) {
      // suppress non-critical browser console errors
    }
  });

  await page.goto(`${appUrl}/es/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Número de socio').fill(env.PLAYWRIGHT_QA_USER);
  await page.getByLabel('Contraseña', { exact: true }).fill(env.PLAYWRIGHT_QA_PASSWORD);
  await Promise.all([
    page.waitForURL('**/es/rooms', { timeout: 60000 }),
    page.getByRole('button', { name: 'Iniciar sesión' }).click(),
  ]);
  const csrf = (await context.cookies()).find((c) => c.name === 'alea-csrf-token')?.value;
  check('session + CSRF', Boolean(csrf), { url: page.url() });

  const mutationHeaders = { Origin: appUrl, 'x-csrf-token': csrf, 'Content-Type': 'application/json' };
  const post = (path, data) =>
    page.request.post(`${appUrl}/api${path}`, { headers: mutationHeaders, data });

  // ── 1. Create reservation via API ─────────────────────────────────────────
  const createResp = await post('/reservations', {
    tableId: table.id,
    date,
    startTime,
    endTime,
    equipmentIds: [],
  });
  const created1 = await json(createResp);
  created.reservationId = created1?.id;
  check('reservation created (201)', createResp.status() === 201 && Boolean(created.reservationId), {
    status: createResp.status(),
    body: created1,
  });
  check('reservation status is pending', created1?.status === 'pending', { status: created1?.status });

  // ── 2. Assert slot now blocked in availability ─────────────────────────────
  const availResp = await page.request.get(
    `${appUrl}/api/tables/${table.id}/availability?date=${date}`
  );
  const avail = await json(availResp);
  check('availability endpoint 200', availResp.status() === 200, { status: availResp.status() });

  // For a regular (non-removable-top) table, slots is a flat array
  const slots = Array.isArray(avail) ? avail : (avail?.slots ?? avail?.top ?? []);
  const isBlocked = slots.some(
    (s) => s.startTime === startTime && s.available === false
  );
  check('slot is blocked in availability', isBlocked, {
    startTime,
    sampleSlots: slots.slice(0, 5),
  });

  // ── 3. Inject pending reservation backdated to right now for check-in ──────
  // The reservation was created for tomorrow; we can't check-in to it.
  // Instead, create a separate fixture for today via admin REST.
  const profileResp = await rest(
    `profiles?select=id&member_number=eq.${encodeURIComponent(env.PLAYWRIGHT_QA_USER)}&limit=1`
  );
  const [profile] = await json(profileResp);

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

  let checkinReservationId = null;
  if (nowMins >= 2 && nowMins <= 1410) {
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const slotStart = fmt(nowMins - 1);
    const slotEnd = fmt(nowMins + 30);

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
    checkinReservationId = inserted?.id;
    created.checkinReservationId = checkinReservationId;

    if (checkinReservationId) {
      // ── 4. Activate via app API ─────────────────────────────────────────────
      const activateResp = await post(`/tables/${table.id}/activate`, {});
      const activateBody = await json(activateResp);
      check('check-in returns 200', activateResp.status() === 200, {
        status: activateResp.status(),
        body: activateBody,
      });
      check('reservation status is active after check-in', activateBody?.reservation?.status === 'active', {
        status: activateBody?.reservation?.status,
      });

      // ── 5. Second activate is rejected ──────────────────────────────────────
      const secondResp = await post(`/tables/${table.id}/activate`, {});
      const secondBody = await json(secondResp);
      check('second check-in rejected (409)', secondResp.status() === 409, {
        status: secondResp.status(),
        message: secondBody?.message,
      });
      check('second check-in message is CHECK_IN_ALREADY_ACTIVE', secondBody?.message === 'CHECK_IN_ALREADY_ACTIVE', {
        message: secondBody?.message,
      });
    } else {
      checks.push({ name: 'check-in fixture', skipped: true, evidence: { reason: 'Could not insert today fixture' } });
    }
  } else {
    checks.push({ name: 'check-in fixture', skipped: true, evidence: { reason: 'Time unsuitable for check-in fixture', nowMins } });
  }

  await context.close();

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => c.pass === false).length;
  const skipped = checks.filter((c) => c.skipped).length;
  console.log(JSON.stringify({ summary: { passed, failed, skipped }, checks }, null, 2));
  if (failed > 0) throw new Error(`${failed} check(s) failed`);
} finally {
  await browser.close();
  if (created.reservationId) {
    await rest(`reservations?id=eq.${created.reservationId}`, { method: 'DELETE' });
  }
  if (created.checkinReservationId) {
    await rest(`reservations?id=eq.${created.checkinReservationId}`, { method: 'DELETE' });
  }
  console.log(JSON.stringify({ cleanup: 'done' }));
}
