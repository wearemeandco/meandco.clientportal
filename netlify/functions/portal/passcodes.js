/* ============================================================
   Me&Co. : resettable client passcodes
   ------------------------------------------------------------
   A client's passcode lives in one of two places:

     1. Netlify Blobs, store "portal-passcodes", key = slug. A scrypt
        hash with its salt and an updatedAt. Set from the admin
        "Reset passcode" button, no redeploy needed.
     2. The client's PORTAL_PASSWORD_<SLUG> variable, the original path.
        It stays the fallback for every client with no Blobs record.

   Blobs wins when both exist. For a Blobs-backed client the session
   and sign in link tokens are signed with a secret derived from the
   stored hash, so a reset signs that client out. For a client on the
   variable path the token secret is the variable's value itself,
   exactly as before.
   ============================================================ */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA;
const PASSCODE_STORE = 'portal-passcodes';
const LIMIT_STORE = 'portal-forgot-limits';

/* ---- Storage ---- */

function localFile(storeName) {
  const dir = process.env.PORTAL_LOCAL_STATE_DIR || path.join(os.tmpdir(), 'mora-portal-local');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, storeName + '.json');
}

/* Explicit site credentials first, then the context Netlify hands the
   function. Either one may be the working one, so a failure on the first
   falls through to the second. */
function blobStores(name) {
  const { getStore } = require('@netlify/blobs');
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const list = [];
  if (siteID && token) list.push(() => getStore({ name, siteID, token }));
  list.push(() => getStore(name));
  return list;
}

async function tryEach(name, op) {
  let lastErr;
  const makers = blobStores(name);
  for (let i = 0; i < makers.length; i++) {
    try {
      return await op(makers[i]());
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/* A tiny read/write over either backend. Tests can swap it with _setStoreFactory. */
let storeFactory = function (name) {
  if (USE_LOCAL_FILES) {
    const file = localFile(name);
    const readAll = () => {
      try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return {}; }
    };
    return {
      async read(key) { const all = readAll(); return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null; },
      async write(key, value) { const all = readAll(); all[key] = value; fs.writeFileSync(file, JSON.stringify(all)); },
      async remove(key) { const all = readAll(); delete all[key]; fs.writeFileSync(file, JSON.stringify(all)); },
    };
  }
  return {
    // Strong reads, so a passcode saved a moment ago is the one that signs in.
    async read(key) {
      return (await tryEach(name, async (st) => {
        try {
          return await st.get(key, { type: 'json', consistency: 'strong' });
        } catch (err) {
          if (err && /consisten/i.test(String(err.name) + String(err.message))) return st.get(key, { type: 'json' });
          throw err;
        }
      })) || null;
    },
    async write(key, value) { await tryEach(name, (st) => st.setJSON(key, value)); },
    async remove(key) { await tryEach(name, (st) => st.delete(key)); },
  };
};
function _setStoreFactory(fn) { storeFactory = fn; }

/* ---- Hashing ---- */

function hashPasscode(passcode) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(passcode), salt, 64).toString('hex');
  return { salt, hash, updatedAt: new Date().toISOString() };
}

function checkHash(passcode, rec) {
  if (!rec || !rec.salt || !rec.hash) return false;
  const got = crypto.scryptSync(String(passcode), rec.salt, 64);
  const want = Buffer.from(rec.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/* The token secret for a Blobs-backed client. Changes whenever the hash does. */
function secretFromRecord(rec) {
  return crypto.createHmac('sha256', Buffer.from(rec.hash, 'hex')).update('mora-portal-token-secret').digest('hex');
}

/* ---- Passcode records ---- */

async function getRecord(slug) {
  try {
    return await storeFactory(PASSCODE_STORE).read(slug);
  } catch (err) {
    console.error('[passcodes] read failed for "' + slug + '", using the original passcode path: ' + err.message);
    return null;
  }
}

async function setPasscode(slug, passcode) {
  const rec = hashPasscode(passcode);
  await storeFactory(PASSCODE_STORE).write(slug, rec);
  return rec;
}

/* Blobs first, then the original variable. Returns null when neither exists.
   { source, secret, record }: secret signs session and sign in tokens. */
async function resolveAuth(client) {
  const rec = await getRecord(client.slug);
  if (rec && rec.hash && rec.salt) return { source: 'blobs', secret: secretFromRecord(rec), record: rec };
  const original = process.env[client.envKey];
  if (original) return { source: 'original', secret: original, record: null };
  return null;
}

/* Does the typed passcode match? The original path keeps its original comparison. */
function checkPasscode(auth, attempt, safeEqual) {
  if (!auth || !attempt) return false;
  if (auth.source === 'blobs') return checkHash(attempt, auth.record);
  return safeEqual(attempt, auth.secret);
}

/* ---- Readable passcode: word-word-4digits ---- */

const WORDS = [
  'amber', 'maple', 'river', 'cedar', 'harbor', 'meadow', 'lantern', 'willow', 'copper', 'orchard',
  'summit', 'prairie', 'saffron', 'thistle', 'juniper', 'marble', 'ember', 'quill', 'canyon', 'breeze',
  'clover', 'dune', 'fable', 'garnet', 'hazel', 'indigo', 'jasper', 'kettle', 'lagoon', 'mosaic',
  'nectar', 'olive', 'pebble', 'quartz', 'raven', 'sparrow', 'tundra', 'velvet', 'walnut', 'yarrow',
];

function generatePasscode() {
  const w1 = WORDS[crypto.randomInt(WORDS.length)];
  let w2 = WORDS[crypto.randomInt(WORDS.length)];
  while (w2 === w1) w2 = WORDS[crypto.randomInt(WORDS.length)];
  const digits = String(crypto.randomInt(10000)).padStart(4, '0');
  return w1 + '-' + w2 + '-' + digits;
}

/* ---- Forgot passcode rate limit: 3 requests per client per hour ---- */

const FORGOT_MAX = 3;
const FORGOT_WINDOW_MS = 60 * 60 * 1000;

/* Records the request and says whether it is allowed. Every request counts,
   matched or not, so the count never reveals whether an email was on file. */
async function takeForgotSlot(slug) {
  const store = storeFactory(LIMIT_STORE);
  const now = Date.now();
  let times = [];
  try {
    const rec = await store.read(slug);
    times = ((rec && rec.times) || []).filter((t) => now - t < FORGOT_WINDOW_MS);
  } catch (err) {
    console.error('[passcodes] rate limit read failed for "' + slug + '": ' + err.message);
  }
  if (times.length >= FORGOT_MAX) return false;
  times.push(now);
  try {
    await store.write(slug, { times });
  } catch (err) {
    console.error('[passcodes] rate limit write failed for "' + slug + '": ' + err.message);
  }
  return true;
}

/* Records how the last Forgot passcode email went, for diagnosis. */
async function noteForgotResult(slug, result) {
  const store = storeFactory(LIMIT_STORE);
  try {
    const rec = (await store.read(slug)) || {};
    rec.lastSend = Object.assign({ at: new Date().toISOString() }, result);
    await store.write(slug, rec);
  } catch (err) {
    console.error('[passcodes] could not record the forgot result for "' + slug + '": ' + err.message);
  }
}

/* Removes a client's passcode record and their forgot-passcode limit record.
   Counts without removing when dryRun is set. */
async function deleteClientPasscodes(slug, dryRun) {
  let n = 0;
  for (const name of [PASSCODE_STORE, LIMIT_STORE]) {
    const store = storeFactory(name);
    if ((await store.read(slug)) == null) continue;
    n += 1;
    if (!dryRun) await store.remove(slug);
  }
  return n;
}

module.exports = {
  deleteClientPasscodes,
  noteForgotResult,
  PASSCODE_STORE,
  LIMIT_STORE,
  FORGOT_MAX,
  hashPasscode,
  checkHash,
  secretFromRecord,
  getRecord,
  setPasscode,
  resolveAuth,
  checkPasscode,
  generatePasscode,
  takeForgotSlot,
  _setStoreFactory,
};
