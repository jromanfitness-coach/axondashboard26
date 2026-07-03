const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'tf-client-workout-portal';
const STATE_KEY = 'published-client-workouts-v1';
const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  },
  body: JSON.stringify(body)
});
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const constantEquals = (a, b) => {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};
function pinHash(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function normalizeBoard(board) {
  const weeks = Array.isArray(board?.weeks) ? board.weeks.map((week) => ({
    week: clean(week?.week, 100),
    summary: clean(week?.summary, 600),
    programs: Array.isArray(week?.programs) ? week.programs.map((p) => ({
      name: clean(p?.name, 120), mode: clean(p?.mode, 24), desc: clean(p?.desc, 700),
      rounds: Number(p?.rounds || 0), work: Number(p?.work || 0), rest: Number(p?.rest || 0),
      circuits: Array.isArray(p?.circuits) ? p.circuits.map((c) => ({
        name: clean(c?.name, 120),
        stations: Array.isArray(c?.stations) ? c.stations.map((s) => ({
          exercise: clean(s?.exercise, 180), prescription: clean(s?.prescription, 80), note: clean(s?.note, 500)
        })) : []
      })) : []
    })) : []
  })) : [];
  return { weeks };
}
function scopedBoard(board, account) {
  const weeks = board.weeks || [];
  const wi = Math.max(0, Math.min(Number(account.weekIndex || 0), Math.max(0, weeks.length - 1)));
  const sourceWeek = weeks[wi];
  if (!sourceWeek) return { weeks: [], publishedAt: board.publishedAt || null };
  const pi = Math.max(0, Math.min(Number(account.programIndex || 0), Math.max(0, (sourceWeek.programs || []).length - 1)));
  const selectedProgram = sourceWeek.programs?.[pi];
  return {
    weeks: [{ ...sourceWeek, programs: selectedProgram ? [selectedProgram] : [] }],
    publishedAt: board.publishedAt || null
  };
}
function makeAccounts(assignments) {
  const seen = new Set();
  return (Array.isArray(assignments) ? assignments : []).map((row) => {
    const pin = clean(row?.pin, 96);
    const name = clean(row?.name, 120);
    if (!pin || !name || seen.has(pin.toLowerCase())) return null;
    seen.add(pin.toLowerCase());
    const salt = crypto.randomBytes(16).toString('hex');
    return {
      id: crypto.randomUUID(), name, label: clean(row?.label || 'Assigned Workout', 80),
      weekIndex: Math.max(0, Number(row?.weekIndex || 0)),
      programIndex: Math.max(0, Number(row?.programIndex || 0)),
      salt, pinHash: pinHash(pin, salt)
    };
  }).filter(Boolean);
}
function isAdmin(event, body) {
  const expected = process.env.ADMIN_PUBLISH_SECRET || '';
  if (!expected) return false;
  const header = event.headers['x-admin-publish-secret'] || event.headers['X-Admin-Publish-Secret'] || '';
  return constantEquals(header, expected);
}
exports.handler = async (event) => {
  try {
    const store = getStore(STORE_NAME);
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (body.action !== 'publish') return json(400, { ok: false, error: 'Unknown action.' });
      if (!isAdmin(event, body)) return json(401, { ok: false, error: 'Publishing is not authorized. Enter the Netlify publish key in the dashboard first.' });
      const board = normalizeBoard(body.board || {});
      const accounts = makeAccounts(body.assignments);
      if (!board.weeks.length) return json(400, { ok: false, error: 'The workout board has no weeks to publish.' });
      if (!accounts.length) return json(400, { ok: false, error: 'Add at least one valid client account with a PIN.' });
      const state = { version: 1, publishedAt: new Date().toISOString(), board: { ...board, publishedAt: new Date().toISOString() }, accounts };
      await store.setJSON(STATE_KEY, state);
      return json(200, { ok: true, publishedAt: state.publishedAt, clientCount: accounts.length });
    }
    if (event.httpMethod === 'GET') {
      const pin = clean(event.queryStringParameters?.pin, 96);
      if (!pin) return json(400, { ok: false, error: 'Enter your client PIN.' });
      const state = await store.get(STATE_KEY, { type: 'json' });
      if (!state?.accounts?.length) return json(404, { ok: false, error: 'No client workouts have been published yet.' });
      const account = state.accounts.find((a) => constantEquals(pinHash(pin, a.salt), a.pinHash));
      if (!account) return json(401, { ok: false, error: 'PIN not recognized.' });
      return json(200, { ok: true, profile: { name: account.name, label: account.label, weekIndex: 0, programIndex: 0 }, board: scopedBoard(state.board, account), publishedAt: state.publishedAt });
    }
    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    return json(500, { ok: false, error: 'Client portal service unavailable.' });
  }
};
