/* ============================================================
   Me&Co.: intake staging
   ------------------------------------------------------------
   Nothing built here can send a real email. So instead of pretending
   to, every outbound thing this feature produces (a submitted
   discovery brief, a magic link that a real system would have
   emailed) gets written somewhere a human can open and read.

   Two backends, mirroring blobs.js exactly so this behaves the same
   way the rest of the portal already does:
   - MORA_PORTAL_LOCAL_DATA set: plain JSON under data/staging/,
     which is the real backend on Melody's machine.
   - Otherwise: the Netlify Blobs 'intake-staging' store.

   data/staging/ is named staging and not outbox on purpose. Nothing
   in it has been delivered. It is a holding pen with a clear label,
   so a file sitting in it is never mistaken for a sent message.
   ============================================================ */

const path = require('path');
const fs = require('fs');

const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA;
const STAGING_DIR = path.join(__dirname, '..', '..', '..', 'data', 'staging');

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function safe(part) {
  return String(part || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
}

function stagingStore() {
  // Netlify's own function access first, the saved token as a fallback. See store.js.
  return require('../portal/store').openStore('intake-staging');
}

/* kind is a folder name: 'discovery-briefs' or 'magic-links'. */
async function stage(kind, label, payload) {
  const key = safe(kind) + '/' + stamp() + '-' + safe(label) + '.json';
  const record = Object.assign({ stagedAt: new Date().toISOString(), delivered: false }, payload);
  if (USE_LOCAL_FILES) {
    const full = path.join(STAGING_DIR, key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(record, null, 2));
    return { key, path: full };
  }
  await stagingStore().setJSON(key, record);
  return { key, path: 'blobs://intake-staging/' + key };
}

module.exports = { stage, STAGING_DIR };
