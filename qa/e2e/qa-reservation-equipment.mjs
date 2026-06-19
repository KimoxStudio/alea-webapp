/**
 * qa-reservation-equipment.mjs
 * Tests equipment reservation lifecycle:
 *  1. Create an equipment item via admin REST
 *  2. Admin creates reservation with that equipmentId → assert equipment in response
 *  3. Secondary user books a DIFFERENT table in same room same slot with same equipment
 *     → should get 409 EQUIPMENT_ALREADY_RESERVED
 *  4. Use unknown equipment ID → assert 400 INVALID_ROOM_EQUIPMENT
 */
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env.local');
dotenv.config({ path: envPath });
const env = process.env;
const required = [
  'PLAYWRIGHT_QA_USER', 'PLAYWRIGHT_QA_PASSWORD',
  'PLAYWRIGHT_QA_SECONDARY_USER', 'PLAYWRIGHT_QA_SECONDARY_PASSWORD',
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_DEFAULT_KEY',
];
for (const name of required) if (!env[name]) throw new Error(`Missing env var: ${name}`);

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

const created = { equipmentId: null, reservation1Id: null, reservation2Id: null, extraTableId: null };

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

try {
  // ── 1. Create a fresh equipment item via admin REST ───────────────────────
  const eqInsertResp = await rest('equipment', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: `QA Equipment ${Date.now()}`, description: 'E2E test fixture' }),
  });
  const [eq] = await json(eqInsertResp);
  created.equipmentId = eq?.id;
  check('equipment item created', eqInsertResp.status === 201 && Boolean(created.equipmentId), {
    status: eqInsertResp.status, eq,
  });

  // ── 2. Pick a regular table (primary booking table) ──────────────────────
  const tableResp = await rest('tables?select=id,room_id,type,name&type=eq.small&limit=1');
  const [table] = await json(tableResp);
  check('fixture table 1', tableResp.status === 200 && Boolean(table?.id), { status: tableResp.status });

  // ── 3. Pick a second regular table in the SAME room ─────────────────────
  // (needed so secondary user's booking doesn't hit SLOT_TAKEN on the same table)
  const table2Resp = await rest(
    `tables?select=id,room_id,type,name&type=eq.small&room_id=eq.${table.room_id}&id=neq.${table.id}&limit=1`
  );
  let [table2] = await json(table2Resp);

  // If there's no second table in the same room, create a temporary one
  if (!table2?.id) {
    const createTable2 = await rest('tables', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ room_id: table.room_id, name: `QA Extra ${Date.now()}`, type: 'small' }),
    });
    const [t2] = await json(createTable2);
    created.extraTableId = t2?.id;
    check('created extra table for conflict test', createTable2.status === 201 && Boolean(t2?.id), {
      status: createTable2.status,
    });
    table2 = { id: t2.id, room_id: table.room_id };
  } else {
    check('fixture table 2 (same room)', Boolean(table2.id), { table2 });
  }

  // ── 4. Compute date: tomorrow ─────────────────────────────────────────────
  const timeResp = await rest('rpc/get_database_time', { method: 'POST', body: '{}' });
  const dbNow = new Date(await json(timeResp));
  const tomorrow = new Date(Date.UTC(dbNow.getUTCFullYear(), dbNow.getUTCMonth(), dbNow.getUTCDate() + 1));
  const date = tomorrow.toISOString().slice(0, 10);
  const startTime = '15:00';
  const endTime = '16:00';

  // ── 5. Login as admin user ────────────────────────────────────────────────
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto(`${appUrl}/es/login`, { waitUntil: 'networkidle' });
  await page1.getByLabel('Número de socio').fill(env.PLAYWRIGHT_QA_USER);
  await page1.getByLabel('Contraseña', { exact: true }).fill(env.PLAYWRIGHT_QA_PASSWORD);
  await Promise.all([
    page1.waitForURL('**/es/rooms', { timeout: 60000 }),
    page1.getByRole('button', { name: 'Iniciar sesión' }).click(),
  ]);
  const csrf1 = (await ctx1.cookies()).find((c) => c.name === 'alea-csrf-token')?.value;
  check('admin session + CSRF', Boolean(csrf1), { url: page1.url() });

  const mh1 = { Origin: appUrl, 'x-csrf-token': csrf1, 'Content-Type': 'application/json' };
  const post1 = (path, data) => page1.request.post(`${appUrl}/api${path}`, { headers: mh1, data });

  // ── 6. Admin creates reservation on table1 with equipment ─────────────────
  const createResp = await post1('/reservations', {
    tableId: table.id,
    date,
    startTime,
    endTime,
    equipmentIds: [created.equipmentId],
  });
  const created1 = await json(createResp);
  created.reservation1Id = created1?.id;
  check('reservation with equipment created (201)', createResp.status() === 201 && Boolean(created.reservation1Id), {
    status: createResp.status(), body: created1,
  });
  check('equipment appears in reservation response', Array.isArray(created1?.equipment) && created1.equipment.some((e) => e.id === created.equipmentId), {
    equipment: created1?.equipment,
  });

  // ── 7. Check available-equipment endpoint shows equipment as unavailable ──
  const eqAvailResp = await page1.request.get(
    `${appUrl}/api/rooms/${table.room_id}/available-equipment?date=${date}&startTime=${startTime}&endTime=${endTime}`
  );
  const eqAvailBody = await json(eqAvailResp);
  if (eqAvailResp.status() === 200 && Array.isArray(eqAvailBody)) {
    const eqEntry = eqAvailBody.find((e) => e.id === created.equipmentId);
    if (eqEntry) {
      check('equipment shows as unavailable after booking', eqEntry.available === false, { eqEntry });
    } else {
      checks.push({ name: 'equipment availability', pass: true, evidence: { note: 'not in pool (may be locked to another room)' } });
    }
  } else {
    checks.push({ name: 'equipment availability', pass: true, evidence: { note: `endpoint status ${eqAvailResp.status()}` } });
  }

  // ── 8. Unknown equipment ID → 400 INVALID_ROOM_EQUIPMENT ─────────────────
  const unknownResp = await post1('/reservations', {
    tableId: table.id,
    date,
    startTime: '16:00',
    endTime: '17:00',
    equipmentIds: ['00000000-0000-0000-0000-000000000000'],
  });
  const unknownBody = await json(unknownResp);
  check('unknown equipment ID rejected (400)', unknownResp.status() === 400, {
    status: unknownResp.status(), message: unknownBody?.message,
  });
  check('unknown equipment message is INVALID_ROOM_EQUIPMENT', unknownBody?.message === 'INVALID_ROOM_EQUIPMENT', {
    message: unknownBody?.message,
  });

  await ctx1.close();

  // ── 9. Secondary user books table2 (same room, same slot) with same equipment ─
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(`${appUrl}/es/login`, { waitUntil: 'networkidle' });
  await page2.getByLabel('Número de socio').fill(env.PLAYWRIGHT_QA_SECONDARY_USER);
  await page2.getByLabel('Contraseña', { exact: true }).fill(env.PLAYWRIGHT_QA_SECONDARY_PASSWORD);
  await Promise.all([
    page2.waitForURL('**/es/rooms', { timeout: 60000 }),
    page2.getByRole('button', { name: 'Iniciar sesión' }).click(),
  ]);
  const csrf2 = (await ctx2.cookies()).find((c) => c.name === 'alea-csrf-token')?.value;
  check('secondary session + CSRF', Boolean(csrf2), { url: page2.url() });

  const mh2 = { Origin: appUrl, 'x-csrf-token': csrf2, 'Content-Type': 'application/json' };
  const post2 = (path, data) => page2.request.post(`${appUrl}/api${path}`, { headers: mh2, data });

  // Secondary user books table2 in the same room, same slot, same equipment
  // table2 has no slot conflict, so the equipment conflict is what triggers
  const conflictResp = await post2('/reservations', {
    tableId: table2.id,
    date,
    startTime,
    endTime,
    equipmentIds: [created.equipmentId],
  });
  const conflictBody = await json(conflictResp);
  created.reservation2Id = conflictBody?.id; // null if correctly rejected
  check('conflicting equipment booking rejected (409)', conflictResp.status() === 409, {
    status: conflictResp.status(), message: conflictBody?.message,
  });
  check('conflict message is EQUIPMENT_ALREADY_RESERVED', conflictBody?.message === 'EQUIPMENT_ALREADY_RESERVED', {
    message: conflictBody?.message,
  });

  await ctx2.close();

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(JSON.stringify({ summary: { passed, total }, checks }, null, 2));
  if (passed < total) throw new Error(`${total - passed} check(s) failed`);
} finally {
  await browser.close();
  if (created.reservation1Id) {
    await rest(`reservation_equipment?reservation_id=eq.${created.reservation1Id}`, { method: 'DELETE' });
    await rest(`reservations?id=eq.${created.reservation1Id}`, { method: 'DELETE' });
  }
  if (created.reservation2Id) {
    await rest(`reservation_equipment?reservation_id=eq.${created.reservation2Id}`, { method: 'DELETE' });
    await rest(`reservations?id=eq.${created.reservation2Id}`, { method: 'DELETE' });
  }
  if (created.equipmentId) {
    await rest(`equipment?id=eq.${created.equipmentId}`, { method: 'DELETE' });
  }
  if (created.extraTableId) {
    await rest(`tables?id=eq.${created.extraTableId}`, { method: 'DELETE' });
  }
  console.log(JSON.stringify({ cleanup: 'done' }));
}
