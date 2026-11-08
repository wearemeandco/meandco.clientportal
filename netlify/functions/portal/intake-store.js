/* ============================================================
   Me&Co. — stage 1 inquiry storage
   ------------------------------------------------------------
   Same two backend pattern as blobs.js, on purpose: local JSON
   files when MORA_PORTAL_LOCAL_DATA is set, Netlify Blobs
   otherwise, identical interface either way.

   Deliberately NOT Netlify Forms. Every other form in this repo
   is, and each one costs a matching hidden shadow form in
   public/forms/ that Netlify's build scanner has to see or the
   submission silently drops every field. The inquiry is the first
   thing a stranger ever sends this studio, so it gets a store that
   cannot fail silently and that works identically on a laptop with
   no cloud account.

   Two record kinds live here, both with a real reason:
   - inquiry: a stage 1 submission from a stranger.
   - magic-link: a request from an existing client for a fresh
     sign in link. The link itself is recorded here rather than
     emailed, because nothing in this system sends mail without
     Melody, and a link shown on screen to whoever typed an email
     address would be a straight authentication bypass. She reads
     it off /admin/inquiries and sends it herself.
   ============================================================ */

const path = require('path');
const fs = require('fs');

const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA;
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'intake');

function intakeStore() {
  // Netlify's own function access first, the saved token as a fallback. See store.js.
  return require('./store').openStore('intake');
}

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

async function saveIntakeRecord(record) {
  const full = Object.assign({ id: newId(), createdAt: new Date().toISOString() }, record);
  if (USE_LOCAL_FILES) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, full.id + '.json'), JSON.stringify(full, null, 2));
    return full;
  }
  await intakeStore().setJSON(full.id, full);
  return full;
}

async function listIntakeRecords() {
  let records = [];
  if (USE_LOCAL_FILES) {
    let names = [];
    try {
      names = fs.readdirSync(DATA_DIR).filter((n) => n.endsWith('.json'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    records = names.map((n) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, n), 'utf8')));
  } else {
    const store = intakeStore();
    const listing = await store.list();
    const blobs = (listing && listing.blobs) || [];
    records = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
    records = records.filter(Boolean);
  }
  // Newest first. A list of leads read oldest first is a list nobody reads.
  return records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

module.exports = { saveIntakeRecord, listIntakeRecords, intakeStore };
