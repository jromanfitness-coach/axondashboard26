const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'tf-client-workout-portal';
const STATE_KEY = 'published-client-workouts-v1';
const CLIENT_PIN_FALLBACK = 'axon26';
const ROLE_VALUES = new Set(['Admin', 'Manager', 'Coach']);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  },
  body: JSON.stringify(body)
});

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

function constantEquals(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function pinHash(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString('hex');
}

/**
 * Site-wide Netlify Blobs store.
 *
 * In a deployed Netlify Function, the platform supplies the site ID and a
 * short-lived Blob access token automatically. Do not override either with a
 * personal token or a manually copied site ID: a stale or mismatched override
 * produces a 401 even when the Function itself is healthy.
 */
function getPortalStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

function publicStaffAccount(account) {
  return {
    id: account.id,
    name: account.name,
    loginId: account.loginId,
    role: account.role,
    active: account.active !== false
  };
}

function initialStaffAccounts() {
  const loginId = clean(process.env.INITIAL_ADMIN_LOGIN_ID || 'Admin1999', 80);
  const pin = clean(process.env.INITIAL_ADMIN_PIN || '', 120);
  if (!loginId || !pin) return [];
  const salt = crypto.randomBytes(16).toString('hex');
  return [{
    id: 'initial-admin',
    name: clean(process.env.INITIAL_ADMIN_NAME || 'Jordan Roman', 120),
    loginId,
    role: 'Admin',
    active: true,
    salt,
    pinHash: pinHash(pin, salt)
  }];
}

function normalizeBoard(board) {
  const weeks = Array.isArray(board?.weeks) ? board.weeks.map((week) => ({
    week: clean(week?.week, 100),
    summary: clean(week?.summary, 600),
    display: clean(week?.display, 80),
    programs: Array.isArray(week?.programs) ? week.programs.map((program) => ({
      name: clean(program?.name, 120),
      mode: clean(program?.mode, 24),
      desc: clean(program?.desc, 700),
      rounds: Number(program?.rounds || 0),
      work: Number(program?.work || 0),
      rest: Number(program?.rest || 0),
      circuits: Array.isArray(program?.circuits) ? program.circuits.map((circuit) => ({
        name: clean(circuit?.name, 120),
        stations: Array.isArray(circuit?.stations) ? circuit.stations.map((station) => ({
          exercise: clean(station?.exercise, 180),
          prescription: clean(station?.prescription, 80),
          note: clean(station?.note, 500)
        })) : []
      })) : []
    })) : []
  })) : [];
  return { weeks };
}

function isAdmin(event) {
  const expected = clean(process.env.ADMIN_PUBLISH_SECRET || '', 500);
  if (!expected) return false;
  const header = event.headers['x-admin-publish-secret'] || event.headers['X-Admin-Publish-Secret'] || '';
  return constantEquals(header, expected);
}

function getClientPin() {
  return clean(process.env.CLIENT_PORTAL_PIN || CLIENT_PIN_FALLBACK, 120);
}

function normalizeStaffAccounts(rows, existingAccounts) {
  const existing = new Map((existingAccounts || []).map((item) => [item.id, item]));
  const seenLoginIds = new Set();
  const output = [];

  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = clean(row?.id, 100) || crypto.randomUUID();
    const name = clean(row?.name, 120);
    const loginId = clean(row?.loginId, 80);
    const role = ROLE_VALUES.has(clean(row?.role, 24)) ? clean(row.role, 24) : 'Coach';
    const active = row?.active !== false;
    const pin = clean(row?.pin, 120);
    const previous = existing.get(id);

    if (!name || !loginId || seenLoginIds.has(loginId.toLowerCase())) continue;
    seenLoginIds.add(loginId.toLowerCase());
    if (!pin && !previous) continue;

    const salt = pin ? crypto.randomBytes(16).toString('hex') : previous.salt;
    output.push({
      id,
      name,
      loginId,
      role,
      active,
      salt,
      pinHash: pin ? pinHash(pin, salt) : previous.pinHash
    });
  }

  if (!output.some((account) => account.role === 'Admin' && account.active)) {
    throw new Error('Keep at least one active Admin staff account.');
  }
  return output;
}

async function readBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw new Error('Invalid request body.');
  }
}

function safeStorageError(error) {
  const name = String(error?.name || 'StorageError');
  const message = String(error?.message || 'Unable to connect to live storage.');
  const status = Number(error?.status || error?.statusCode || 0);

  if (name === 'MissingBlobsEnvironmentError' || /not been configured to use Netlify Blobs/i.test(message)) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        code: 'BLOBS_CONTEXT_MISSING',
        error: 'Netlify did not provide this Function with its automatic Blobs context. Confirm this is a deployed Netlify Function, then redeploy the site.'
      }
    };
  }

  if (status === 401 || /401 status code|unauthorized/i.test(message)) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        code: 'BLOBS_AUTH_FAILED',
        error: 'Netlify Blobs rejected the Function credentials. This build uses Netlify’s automatic Function credentials only; remove any legacy BLOBS_SITE_ID and BLOBS_ACCESS_TOKEN variables, redeploy, and try again.'
      }
    };
  }

  return {
    statusCode: 503,
    body: {
      ok: false,
      code: 'LIVE_STORAGE_UNAVAILABLE',
      error: 'The live workout storage is temporarily unavailable. Open Netlify Function logs for client-portal to view the connection error.'
    }
  };
}

exports.handler = async (event) => {
  try {
    const store = getPortalStore();

    // Health endpoint: visiting the function URL now verifies both the Function
    // and the Blobs connection without exposing stored workouts or credentials.
    if (event.httpMethod === 'GET') {
      const state = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' }) || {};
      return json(200, {
        ok: true,
        service: 'tf-client-portal',
        storage: 'connected',
        hasPublishedBoard: Boolean(state?.board?.weeks?.length),
        publishedAt: state?.publishedAt || null
      });
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed.' });
    }

    const body = await readBody(event);
    const action = clean(body.action, 48);
    const state = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' }) || {};
    const staffAccounts = Array.isArray(state.staffAccounts) && state.staffAccounts.length
      ? state.staffAccounts
      : initialStaffAccounts();

    if (action === 'staff-login') {
      const loginId = clean(body.loginId, 80);
      const pin = clean(body.pin, 120);
      if (!loginId || !pin) return json(400, { ok: false, error: 'Enter your staff login ID and PIN.' });
      if (!staffAccounts.length) {
        return json(503, { ok: false, error: 'Staff access has not been configured. Add INITIAL_ADMIN_LOGIN_ID and INITIAL_ADMIN_PIN in Netlify environment variables.' });
      }
      const staff = staffAccounts.find((account) => account.active !== false && account.loginId.toLowerCase() === loginId.toLowerCase());
      if (!staff || !constantEquals(pinHash(pin, staff.salt), staff.pinHash)) {
        return json(401, { ok: false, error: 'That staff login ID or PIN is not recognized.' });
      }
      return json(200, {
        ok: true,
        profile: publicStaffAccount(staff),
        staffAccounts: staff.role === 'Admin' ? staffAccounts.map(publicStaffAccount) : undefined
      });
    }

    if (action === 'client-login') {
      const pin = clean(body.pin, 120);
      if (!pin) return json(400, { ok: false, error: 'Enter the client portal PIN.' });
      if (!constantEquals(pin, getClientPin())) {
        return json(401, { ok: false, error: 'That client portal PIN is not recognized.' });
      }
      if (!state?.board?.weeks?.length) {
        return json(404, { ok: false, error: 'No workouts have been published yet. An admin needs to publish the current Workout Builder board first.' });
      }
      return json(200, {
        ok: true,
        profile: { name: 'Axon Training Portal', label: 'Live Workout Board' },
        board: { ...state.board, publishedAt: state.publishedAt || state.board.publishedAt || null },
        publishedAt: state.publishedAt || state.board.publishedAt || null
      });
    }

    if (action === 'publish') {
      if (!isAdmin(event)) return json(401, { ok: false, error: 'Publishing is not authorized. Enter the Netlify publish secret in the dashboard first.' });
      const board = normalizeBoard(body.board || {});
      if (!board.weeks.length) return json(400, { ok: false, error: 'The workout board has no weeks to publish.' });
      const publishedAt = new Date().toISOString();
      const next = {
        version: 3,
        publishedAt,
        board: { ...board, publishedAt },
        staffAccounts
      };
      await store.setJSON(STATE_KEY, next);
      return json(200, { ok: true, publishedAt, weekCount: board.weeks.length });
    }

    if (action === 'save-staff') {
      if (!isAdmin(event)) return json(401, { ok: false, error: 'Team access changes require the Netlify publish secret.' });
      const nextStaff = normalizeStaffAccounts(body.staffAccounts, staffAccounts);
      const next = {
        version: 3,
        publishedAt: state.publishedAt || null,
        board: state.board || { weeks: [] },
        staffAccounts: nextStaff
      };
      await store.setJSON(STATE_KEY, next);
      return json(200, { ok: true, staffAccounts: nextStaff.map(publicStaffAccount) });
    }

    if (action === 'staff-config') {
      if (!isAdmin(event)) return json(401, { ok: false, error: 'Team access is not authorized.' });
      return json(200, { ok: true, staffAccounts: staffAccounts.map(publicStaffAccount) });
    }

    return json(400, { ok: false, error: 'Unknown action.' });
  } catch (error) {
    console.error('client-portal function error', error);
    const normalized = safeStorageError(error);
    return json(normalized.statusCode, normalized.body);
  }
};
