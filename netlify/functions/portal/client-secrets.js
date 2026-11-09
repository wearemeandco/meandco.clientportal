/* ============================================================
   Me&Co.: client secrets (write-only from a client's side)
   ------------------------------------------------------------
   A client can hand us one credential through their request board,
   today an Airtable personal access token. It is stored in its own
   private Netlify Blobs store, 'client-secrets', key
   `<slug>/<name>` (for example culturalharvest/airtable).

   Rules this file keeps:
   - No page and no portal route ever reads the secret back. The only
     things a page can see are the meta (date saved, last 4 characters),
     which live under a separate key `<slug>/<name>.meta`.
   - Nothing here logs the value, and errors never carry it.
   - Reading the value is admin only: see readSecret(), used by the
     mora_admin gated route and scripts/read-client-secret.js.
   ============================================================ */

const crypto = require('crypto');

// Which client may hand over which secret. A slug not listed here is refused.
const SECRET_ROWS = {};

const ROW_DEFS = {
  airtable: {
    id: 'secret-airtable',
    title: 'Connect your Airtable',
    page: 'Whole site',
  },
};

const STORE = 'client-secrets';

class SecretError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecretError';
    this.user = true;
  }
}

function openStore() {
  // Netlify's own function access first, the saved token as a fallback. See store.js.
  return require('./store').openStore(STORE);
}

function allowed(slug, name) {
  return Object.prototype.hasOwnProperty.call(SECRET_ROWS, slug) && SECRET_ROWS[slug].indexOf(name) !== -1;
}

/* Looks like an Airtable personal access token: starts with "pat", no
   spaces, letters, digits, dot, dash, underscore, a sensible length. */
function normaliseAirtableToken(raw) {
  let t = String(raw == null ? '' : raw).trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!/^pat[A-Za-z0-9._-]{17,200}$/.test(t)) {
    throw new SecretError('That does not look like an Airtable token. It starts with "pat" and is one long line with no spaces. Please copy it again from Airtable.');
  }
  return t;
}

function cleanBase(raw) {
  const v = String(raw == null ? '' : raw).trim().slice(0, 300);
  return v;
}

async function saveSecret(slug, name, value, extra) {
  if (!allowed(slug, name)) throw new SecretError('That is not available.');
  if (name !== 'airtable') throw new SecretError('That is not available.');
  const token = normaliseAirtableToken(value);
  const savedAt = new Date().toISOString();
  const last4 = token.slice(-4);
  const base = cleanBase(extra && extra.base);
  const store = openStore();
  await store.setJSON(slug + '/' + name, { token, base, savedAt });
  await store.setJSON(slug + '/' + name + '.meta', { savedAt, last4 });
  return { savedAt, last4 };
}

/* Safe for pages: date and last 4 only. */
async function getMeta(slug, name) {
  if (!allowed(slug, name)) return null;
  try {
    const m = await openStore().get(slug + '/' + name + '.meta', { type: 'json' });
    return m && m.savedAt && m.last4 ? { savedAt: m.savedAt, last4: m.last4 } : null;
  } catch (err) {
    console.error('[client-secrets] meta read failed');
    return null;
  }
}

/* ADMIN ONLY. Never call this from a client facing route. */
async function readSecret(slug, name) {
  if (!allowed(slug, name)) return null;
  return openStore().get(slug + '/' + name, { type: 'json' });
}

async function deleteSecret(slug, name) {
  const store = openStore();
  await store.delete(slug + '/' + name);
  await store.delete(slug + '/' + name + '.meta');
}

/* The board row for a secret, built fresh on every render so it never
   depends on what is stored in the client's request record. */
function rowsFor(slug, metas) {
  return (SECRET_ROWS[slug] || []).map((name) => {
    const def = ROW_DEFS[name];
    const meta = metas && metas[name];
    return {
      id: def.id,
      title: def.title,
      page: def.page,
      status: meta ? 'received' : 'needs',
      ask: 'secret',
      secret: name,
      secretMeta: meta || null,
      from: 'Me&Co.',
      date: meta ? meta.savedAt.slice(0, 10) : '2026-10-28',
      history: [],
    };
  });
}

async function withSecretRows(slug, rec) {
  if (!rec || !SECRET_ROWS[slug]) return rec;
  const metas = {};
  for (const name of SECRET_ROWS[slug]) metas[name] = await getMeta(slug, name);
  const items = (rec.items || []).filter((i) => !i.secret);
  return Object.assign({}, rec, { items: items.concat(rowsFor(slug, metas)) });
}

/* Removes every stored secret and its meta record for a client. Counts
   without removing when dryRun is set. A local run has no secrets store. */
async function deleteClientSecrets(slug, dryRun) {
  const onNetlify = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  if (process.env.MORA_PORTAL_LOCAL_DATA && !onNetlify) return 0;
  const store = openStore();
  const listed = await store.list({ prefix: String(slug) + '/' });
  const keys = ((listed && listed.blobs) || []).map((b) => b.key);
  if (!dryRun) for (const key of keys) await store.delete(key);
  return keys.length;
}

module.exports = { deleteClientSecrets, SecretError, allowed, saveSecret, getMeta, readSecret, deleteSecret, withSecretRows, STORE };
