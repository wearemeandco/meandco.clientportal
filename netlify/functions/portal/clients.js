/* ============================================================
   Me&Co. — client portal registry
   ------------------------------------------------------------
   Every client lives in a dynamic index (same local-file vs
   Netlify Blobs pattern as blobs.js), written from the admin "add
   a new client" flow, not by hand-editing this file.

   ADDING A NEW CLIENT, either way:
     1. Slug and name exist here or in the dynamic index.
     2. In Netlify (or .env locally), set PORTAL_PASSWORD_<SLUG>.
        This is a real secret, never created automatically.
     3. Their initial portal state gets seeded (admin's add-client
        action does this for you).

   Same gating pattern as weareme's proposal lock, reused on
   purpose rather than reinvented: env-var password per client,
   HMAC-signed session cookie, fails closed on misconfiguration.
   ============================================================ */

const path = require('path');
const fs = require('fs');

const CLIENTS = {};

const ENV_PREFIX = 'PORTAL_PASSWORD_';
const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA;
const INDEX_PATH = path.join(__dirname, '..', '..', '..', 'data', 'clients-index.json');

function readIndex() {
  if (USE_LOCAL_FILES) {
    try {
      return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
  }
  // Real deploy: Blobs read happens in getAllClients (async), this
  // sync path only serves the local-dev backend, matching blobs.js.
  return {};
}

/* Drops tombstoned entries: a deleted client that also lives in the code or
   the bundled index is marked deleted in the dynamic index instead. */
function withoutDeleted(all) {
  const out = {};
  Object.keys(all).forEach((slug) => {
    if (!(all[slug] && all[slug].deleted)) out[slug] = all[slug];
  });
  return out;
}

async function getAllClients() {
  if (USE_LOCAL_FILES) {
    return withoutDeleted(Object.assign({}, CLIENTS, readIndex()));
  }
  // Same read-through fallback as blobs.js getClientState, and for the
  // same reason: turning MORA_PORTAL_LOCAL_DATA off must not make CBC
  // disappear from the registry before anything has written it to Blobs.
  // The bundled index is the floor, Blobs overlays it once populated.
  let fileIndex = {};
  try {
    fileIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  let dynamic = {};
  try {
    const { clientsStore } = require('./blobs');
    dynamic = (await clientsStore().get('_index', { type: 'json' })) || {};
  } catch (err) {
    console.error('[clients] Blobs index read failed, using bundled index: ' + err.message);
  }
  return withoutDeleted(Object.assign({}, CLIENTS, fileIndex, dynamic));
}

async function addClientToIndex(slug, name, extra = {}) {
  const entry = Object.assign(
    {
      envKey: ENV_PREFIX + slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      name,
      kicker: 'Your Me&Co. portal',
      blurb: 'Everything for your project lives here. Enter the passcode Melody sent you.',
      repeatClient: false,
    },
    extra
  );
  if (USE_LOCAL_FILES) {
    const index = readIndex();
    index[slug] = entry;
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return entry;
  }
  const { clientsStore } = require('./blobs');
  const store = clientsStore();
  const dynamic = (await store.get('_index', { type: 'json' })) || {};
  dynamic[slug] = entry;
  await store.setJSON('_index', dynamic);
  return entry;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 20;

/* Trims, lowercases and dedupes. Returns { list } or { error } naming the
   first address that fails, or the limit that was passed. */
function normalizeEmails(input) {
  const list = [];
  const raw = Array.isArray(input) ? input : [];
  for (let i = 0; i < raw.length; i++) {
    const address = String(raw[i] == null ? '' : raw[i]).trim().toLowerCase();
    if (!address) continue;
    if (address.length > 254 || !EMAIL_RE.test(address)) return { error: 'Not a valid email address: ' + String(raw[i]).trim().slice(0, 80) };
    if (list.indexOf(address) === -1) list.push(address);
  }
  if (list.length > MAX_EMAILS) return { error: 'No more than ' + MAX_EMAILS + ' email addresses per client.' };
  return { list };
}

/* Replaces a client's addresses, keeping every other field of its entry.
   Writes where addClientToIndex writes. Returns the saved list, or null when
   the slug is unknown. Throws an Error with status 400 on a bad address. */
async function setClientEmails(slug, emails) {
  const normalized = normalizeEmails(emails);
  if (normalized.error) {
    const err = new Error(normalized.error);
    err.status = 400;
    throw err;
  }
  const list = normalized.list;
  const all = await getAllClients();
  if (!slug || !Object.prototype.hasOwnProperty.call(all, slug)) return null;
  const entry = Object.assign({}, all[slug], { emails: list, email: list[0] || '' });
  if (USE_LOCAL_FILES) {
    const index = readIndex();
    index[slug] = entry;
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return list;
  }
  const { clientsStore } = require('./blobs');
  const store = clientsStore();
  const dynamic = (await store.get('_index', { type: 'json' })) || {};
  dynamic[slug] = entry;
  await store.setJSON('_index', dynamic);
  return list;
}

/* Writes one client's entry where addClientToIndex writes. A null entry
   removes it: from the dynamic index when nothing in code or the bundled
   index carries the slug, otherwise as a tombstone that hides it. */
async function writeIndexEntry(slug, entry) {
  if (USE_LOCAL_FILES) {
    const index = readIndex();
    if (entry === null) {
      if (Object.prototype.hasOwnProperty.call(CLIENTS, slug)) index[slug] = { deleted: true };
      else delete index[slug];
    } else {
      index[slug] = entry;
    }
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return;
  }
  let bundled = {};
  try {
    bundled = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const { clientsStore } = require('./blobs');
  const store = clientsStore();
  const dynamic = (await store.get('_index', { type: 'json' })) || {};
  if (entry === null) {
    const inCode = Object.prototype.hasOwnProperty.call(CLIENTS, slug) || Object.prototype.hasOwnProperty.call(bundled, slug);
    if (inCode) dynamic[slug] = { deleted: true };
    else delete dynamic[slug];
  } else {
    dynamic[slug] = entry;
  }
  await store.setJSON('_index', dynamic);
}

/* Marks a client archived or active again, keeping every other field of its
   entry. Returns the saved entry, or null when the slug is unknown. */
async function setClientArchived(slug, archived) {
  const all = await getAllClients();
  if (!slug || !Object.prototype.hasOwnProperty.call(all, slug)) return null;
  const entry = Object.assign({}, all[slug]);
  if (archived) {
    entry.archived = true;
    entry.archivedAt = new Date().toISOString();
  } else {
    entry.archived = false;
    delete entry.archivedAt;
  }
  await writeIndexEntry(slug, entry);
  return entry;
}

/* Locks or unlocks a client's portal, keeping every other field of its entry.
   Returns the saved entry, or null when the slug is unknown. */
async function setClientLocked(slug, locked) {
  const all = await getAllClients();
  if (!slug || !Object.prototype.hasOwnProperty.call(all, slug)) return null;
  const entry = Object.assign({}, all[slug], { locked: !!locked });
  await writeIndexEntry(slug, entry);
  return entry;
}

/* Removes a client's index entry. Returns true when the slug was known. */
async function removeClientFromIndex(slug) {
  const all = await getAllClients();
  if (!slug || !Object.prototype.hasOwnProperty.call(all, slug)) return false;
  await writeIndexEntry(slug, null);
  return true;
}

async function getClient(slug) {
  if (!slug) return null;
  const merged = await getAllClients();
  if (!Object.prototype.hasOwnProperty.call(merged, slug)) return null;
  const client = merged[slug];
  return {
    slug,
    ...client,
    envKey: client.envKey || ENV_PREFIX + slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
  };
}

module.exports = { CLIENTS, ENV_PREFIX, getClient, getAllClients, addClientToIndex, setClientEmails, normalizeEmails, setClientArchived, setClientLocked, removeClientFromIndex };
