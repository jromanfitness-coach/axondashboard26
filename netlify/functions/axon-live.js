const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

// New function name and store intentionally avoid the legacy client-portal.js
// that produced the 401 errors in earlier deployments.
const STORE_NAME = 'axon-live-workouts-v30';
const BOARD_KEY = 'current-client-board';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  },
  body: JSON.stringify(body)
});

function clean(value, max = 800) {
  return String(value ?? '').trim().slice(0, max);
}

function equals(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function isPublisher(event) {
  const expected = clean(process.env.ADMIN_PUBLISH_SECRET || '', 500);
  const provided = event.headers['x-admin-publish-secret'] || event.headers['X-Admin-Publish-Secret'] || '';
  return Boolean(expected) && equals(provided, expected);
}

function getLiveStore() {
  // This is the documented site-wide Function pattern. Netlify supplies site
  // credentials automatically at Function runtime; no personal token is read.
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

function normalizeBoard(input) {
  const weeks = Array.isArray(input?.weeks) ? input.weeks.map((week) => ({
    week: clean(week?.week, 100),
    summary: clean(week?.summary, 700),
    display: clean(week?.display, 80),
    programs: Array.isArray(week?.programs) ? week.programs.map((program) => ({
      name: clean(program?.name, 120),
      mode: clean(program?.mode, 24),
      desc: clean(program?.desc, 700),
      rounds: Math.max(0, Number(program?.rounds || 0)),
      work: Math.max(0, Number(program?.work || 0)),
      rest: Math.max(0, Number(program?.rest || 0)),
      circuits: Array.isArray(program?.circuits) ? program.circuits.map((circuit) => ({
        name: clean(circuit?.name, 120),
        stations: Array.isArray(circuit?.stations) ? circuit.stations.map((station) => ({
          exercise: clean(station?.exercise, 180),
          prescription: clean(station?.prescription, 100),
          note: clean(station?.note, 500)
        })) : []
      })) : []
    })) : []
  })) : [];
  return { weeks };
}

function storageFailure(error) {
  const message = clean(error?.message || 'Live workout storage is unavailable.', 450);
  const status = Number(error?.status || error?.statusCode || 0);
  const code = status === 401 || /401 status code|unauthorized/i.test(message)
    ? 'BLOBS_AUTH_FAILED'
    : 'BLOBS_UNAVAILABLE';
  return { code, message };
}

async function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw new Error('Invalid JSON request body.');
  }
}

exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';

  // Health is intentionally non-fatal. It tells the page whether live sync is
  // connected but never blocks either login screen.
  if (method === 'GET') {
    try {
      const state = await getLiveStore().get(BOARD_KEY, { type: 'json', consistency: 'strong' });
      return json(200, {
        ok: true,
        service: 'axon-live-v30',
        connected: true,
        hasPublishedBoard: Boolean(state?.board?.weeks?.length),
        publishedAt: state?.publishedAt || null
      });
    } catch (error) {
      const failure = storageFailure(error);
      console.error('axon-live health error', error);
      return json(200, { ok: true, service: 'axon-live-v30', connected: false, ...failure });
    }
  }

  if (method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  let body;
  try {
    body = await parseBody(event);
  } catch (error) {
    return json(400, { ok: false, error: error.message });
  }

  const action = clean(body.action, 48);

  if (action === 'read') {
    try {
      const state = await getLiveStore().get(BOARD_KEY, { type: 'json', consistency: 'strong' });
      return json(200, {
        ok: true,
        connected: true,
        board: state?.board || null,
        publishedAt: state?.publishedAt || null
      });
    } catch (error) {
      const failure = storageFailure(error);
      console.error('axon-live read error', error);
      // The client page intentionally treats this as a degraded but usable state.
      return json(200, { ok: true, connected: false, board: null, publishedAt: null, ...failure });
    }
  }

  if (action === 'publish') {
    if (!isPublisher(event)) {
      return json(401, { ok: false, error: 'Publishing is not authorized. Enter the Netlify publish secret in the admin dashboard.' });
    }

    const board = normalizeBoard(body.board || {});
    if (!board.weeks.length) {
      return json(400, { ok: false, error: 'The Workout Builder does not contain a week to publish.' });
    }

    const publishedAt = new Date().toISOString();
    try {
      await getLiveStore().setJSON(BOARD_KEY, { version: 30, publishedAt, board: { ...board, publishedAt } });
      return json(200, { ok: true, connected: true, publishedAt, weekCount: board.weeks.length });
    } catch (error) {
      const failure = storageFailure(error);
      console.error('axon-live publish error', error);
      return json(503, {
        ok: false,
        connected: false,
        ...failure,
        error: 'The Workout Builder was saved locally, but the live client copy could not publish. Client and admin login remain available.'
      });
    }
  }

  return json(400, { ok: false, error: 'Unknown action.' });
};
