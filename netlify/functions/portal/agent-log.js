/* ============================================================
   Me&Co. : the agent log
   ------------------------------------------------------------
   One entry for each time Everly or Ida runs: what woke the run, what it
   did, the links to show for it, and what is waiting on Melody. Agents write
   an entry through the agent door (op "log"); the admin Everly tab reads
   them. Stored in the Netlify Blobs store "agent-log", key = the ISO time
   then a random suffix, so keys sort oldest to newest. The newest 500 are
   kept and older ones are deleted on write.
   ============================================================ */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const STORE = 'agent-log';
const KEEP = 500;
const AGENTS = ['everly', 'ida'];
const STATUSES = ['done', 'waiting', 'blocked'];
const LINE_MAX = 300;
const LIST_MAX = 12;

class LogError extends Error {}

const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA && !(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

function localDir() {
  const dir = path.join(process.env.PORTAL_LOCAL_STATE_DIR || path.join(os.tmpdir(), 'mora-portal-local'), STORE);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const line = (v) => String(v == null ? '' : v).replace(/\u2014/g, ',').replace(/\s+/g, ' ').trim().slice(0, LINE_MAX);

function lines(v, field) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new LogError(field + ' is a list of lines');
  return v.map(line).filter(Boolean).slice(0, LIST_MAX);
}

/* The entry as stored, or a LogError saying what is wrong with the request. */
function sanitize(raw) {
  if (!raw || typeof raw !== 'object') throw new LogError('The entry is empty.');
  const agent = String(raw.agent || '').toLowerCase();
  if (AGENTS.indexOf(agent) === -1) throw new LogError('agent is one of ' + AGENTS.join(', '));
  if (STATUSES.indexOf(raw.status) === -1) throw new LogError('status is one of ' + STATUSES.join(', '));
  const links = lines(raw.links, 'links');
  links.forEach((l) => {
    if (!/^https:\/\/[^\s]+$/.test(l)) throw new LogError('links are https addresses');
  });
  return {
    agent,
    status: raw.status,
    woke: line(raw.woke),
    did: lines(raw.did, 'did'),
    links,
    waiting: lines(raw.waiting, 'waiting'),
  };
}

function openStore() {
  return require('./store').openStore(STORE);
}

/* Saves an entry and prunes to the newest KEEP. Returns the stored entry. */
async function addEntry(raw) {
  const clean = sanitize(raw);
  const at = new Date().toISOString();
  const entry = Object.assign({ at }, clean);
  const key = at + '-' + crypto.randomBytes(3).toString('hex');
  if (USE_LOCAL_FILES) {
    const dir = localDir();
    fs.writeFileSync(path.join(dir, key + '.json'), JSON.stringify(entry));
    const names = fs.readdirSync(dir).sort();
    names.slice(0, Math.max(0, names.length - KEEP)).forEach((n) => fs.unlinkSync(path.join(dir, n)));
    return entry;
  }
  const store = openStore();
  await store.setJSON(key, entry);
  const listed = await store.list();
  const keys = ((listed && listed.blobs) || []).map((b) => b.key).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - KEEP))) await store.delete(old);
  return entry;
}

/* The newest entries first. */
async function listEntries(limit) {
  const n = Math.min(Math.max(Number(limit) || 50, 1), KEEP);
  if (USE_LOCAL_FILES) {
    const dir = localDir();
    return fs.readdirSync(dir).sort().reverse().slice(0, n).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  const store = openStore();
  const listed = await store.list();
  const keys = ((listed && listed.blobs) || []).map((b) => b.key).sort().reverse().slice(0, n);
  const rows = await Promise.all(keys.map((k) => store.get(k, { type: 'json' }).catch(() => null)));
  return rows.filter(Boolean);
}

module.exports = { addEntry, listEntries, sanitize, LogError, KEEP, LINE_MAX, LIST_MAX };
