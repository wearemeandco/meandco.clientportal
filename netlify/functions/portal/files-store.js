/* ============================================================
   Me&Co.: "Your files and links", data layer
   ------------------------------------------------------------
   One record per client, key `files/<slug>` in the same Netlify
   Blobs store the portal state lives in ('clients').

   {
     slug,
     visible,      // false keeps the section off the dashboard and makes
                   // /portal/<slug>/files answer 404
     intro,        // one short note shown at the top of the page
     updatedAt,
     items: [{
       id, title, kind, url, note,
       file: { fileId, filename, mimeType, size } | null,
       by: 'client' | 'mora' | 'site',   // who added it
       from,                             // the name shown: the client, Me&Co., or
                                         // "From your current website"
       date,                             // YYYY-MM-DD
     }]
   }

   An item is either a link (url) or a stored file (file), never both.

   Reads: Blobs first, then the file bundled with the deploy
   (data/files/<slug>.json), then an empty record. Writes: Blobs.
   On a developer machine with MORA_PORTAL_LOCAL_DATA set and no
   Netlify runtime, the bundled files are read and written directly.

   Uploaded files live in the private 'request-files' Blobs store,
   under `<slug>/<fileId>` with an fl- prefix (the request board's
   images use rq-). Nothing is public: the only route that serves one
   is /portal/<slug>/file/<fileId> behind that client's own session.
   ============================================================ */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { connectBlobs, UserError } = require('./requests-store');

const KINDS = [
  { key: 'brand', label: 'Brand and logos' },
  { key: 'photos', label: 'Photos' },
  { key: 'documents', label: 'Documents and resources' },
  { key: 'forms', label: 'Forms and sign-ups' },
  { key: 'videos', label: 'Videos' },
  { key: 'donations', label: 'Donation links' },
  { key: 'other', label: 'Other' },
];
const KIND_KEYS = KINDS.map((k) => k.key);

const FILE_PREFIX = 'fl-';
const FILE_ID_RE = /^fl-[a-f0-9]{24}$/;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ITEMS = 300;
const FILE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const ON_NETLIFY = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA && !ON_NETLIFY;
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'files');
const LOCAL_UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'request-files');

function validSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug);
}

function openStore(name) {
  // Netlify's own function access first, the saved token as a fallback. See store.js.
  return require('./store').openStore(name);
}

function emptyRecord(slug) {
  return { slug, visible: true, intro: null, updatedAt: null, items: [] };
}

function readBundled(slug) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, slug + '.json'), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function getFiles(slug) {
  if (!validSlug(slug)) throw new Error('Bad slug');
  let raw = null;
  if (USE_LOCAL_FILES) {
    raw = readBundled(slug);
  } else {
    try {
      raw = await openStore('clients').get('files/' + slug, { type: 'json' });
    } catch (err) {
      console.error('[files] read failed for "' + slug + '", serving bundled copy: ' + err.message);
    }
    if (!raw) raw = readBundled(slug);
  }
  const rec = raw || emptyRecord(slug);
  rec.items = Array.isArray(rec.items) ? rec.items : [];
  return rec;
}

async function saveFiles(slug, rec) {
  if (!validSlug(slug)) throw new Error('Bad slug');
  rec.updatedAt = new Date().toISOString();
  if (USE_LOCAL_FILES) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, slug + '.json'), JSON.stringify(rec, null, 2));
    return rec;
  }
  await openStore('clients').setJSON('files/' + slug, rec);
  return rec;
}

function isVisible(rec) {
  return !!rec && rec.visible !== false;
}

/* ---------- uploaded files ---------- */

/* The type comes from the first bytes, never from the name or the type the
   browser claimed. */
function sniffFile(buf) {
  if (buf.length > 12 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.slice(0, 6).toString('latin1'))) return 'image/gif';
  if (buf.length > 8 && buf.slice(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

function cleanFilename(name, ext) {
  const base = String(name || 'file').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60) || 'file';
  return base + '.' + ext;
}

async function saveUpload(slug, upload) {
  if (!upload || typeof upload.data !== 'string') throw new UserError('No file was included.');
  const buf = Buffer.from(upload.data, 'base64');
  if (!buf.length) throw new UserError('That file was empty.');
  if (buf.length > MAX_FILE_BYTES) throw new UserError('That file is over 4 MB. Please choose a smaller one, or add a link to it instead.');
  const mimeType = sniffFile(buf);
  if (!mimeType) throw new UserError('Please add a PNG, JPG, WebP or GIF image, or a PDF.');
  const fileId = FILE_PREFIX + crypto.randomBytes(12).toString('hex');
  const filename = cleanFilename(upload.name, FILE_TYPES[mimeType]);
  if (USE_LOCAL_FILES) {
    const dir = path.join(LOCAL_UPLOADS_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileId), buf);
    fs.writeFileSync(path.join(dir, fileId + '.meta.json'), JSON.stringify({ filename, mimeType }));
  } else {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    await openStore('request-files').set(slug + '/' + fileId, ab, { metadata: { filename, mimeType } });
  }
  return { fileId, filename, mimeType, size: buf.length };
}

async function getUpload(slug, fileId) {
  if (!validSlug(slug) || !FILE_ID_RE.test(fileId || '')) return null;
  if (USE_LOCAL_FILES) {
    try {
      const dir = path.join(LOCAL_UPLOADS_DIR, slug);
      const buffer = fs.readFileSync(path.join(dir, fileId));
      const meta = JSON.parse(fs.readFileSync(path.join(dir, fileId + '.meta.json'), 'utf8'));
      return { buffer, filename: meta.filename, mimeType: meta.mimeType };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
  const res = await openStore('request-files').getWithMetadata(slug + '/' + fileId, { type: 'arrayBuffer' });
  if (!res || !res.data) return null;
  const meta = res.metadata || {};
  return { buffer: Buffer.from(res.data), filename: meta.filename, mimeType: meta.mimeType };
}

async function deleteUpload(slug, fileId) {
  if (USE_LOCAL_FILES) {
    const dir = path.join(LOCAL_UPLOADS_DIR, slug);
    for (const f of [fileId, fileId + '.meta.json']) {
      try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* already gone */ }
    }
    return;
  }
  await openStore('request-files').delete(slug + '/' + fileId);
}

/* ---------- mutations ---------- */

function clean(value, max) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanUrl(value) {
  let v = clean(value, 800);
  if (!v) return null;
  // People paste "www.example.org/page" all the time. Add the scheme for them.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s/]+\.[^\s/]+/.test(v)) v = 'https://' + v;
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(v)) throw new UserError('The link needs to start with http:// or https://');
  return v;
}

function localDate(zone) {
  return new Date().toLocaleDateString('en-CA', { timeZone: zone || 'America/Los_Angeles' });
}

function newId() {
  return 'f-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

/* Adds one item. `by` is 'client' (from the portal) or 'mora' (from the
   admin). A client may give a link or a file, not both and not neither. */
async function addItem(slug, by, fromName, fields, upload, zone) {
  const title = clean(fields.title, 140);
  if (!title) throw new UserError('Give it a short name so you can find it later.');
  const kind = KIND_KEYS.includes(fields.kind) ? fields.kind : null;
  if (!kind) throw new UserError('Choose what kind of thing this is.');
  const url = cleanUrl(fields.url);
  if (url && upload) throw new UserError('Add either a link or a file, not both.');
  if (!url && !upload) throw new UserError('Paste a link or choose a file to add.');
  const rec = await getFiles(slug);
  if (rec.items.length >= MAX_ITEMS) throw new UserError('This page is full. Please email us instead.');
  const file = upload ? await saveUpload(slug, upload) : null;
  const item = {
    id: newId(),
    title,
    kind,
    url,
    note: clean(fields.note, 500) || null,
    file,
    by: by === 'mora' ? 'mora' : 'client',
    from: clean(fromName, 80) || (by === 'mora' ? 'Me&Co.' : null),
    date: localDate(zone),
  };
  rec.items.unshift(item);
  try {
    await saveFiles(slug, rec);
  } catch (err) {
    if (file) await deleteUpload(slug, file.fileId).catch(() => {});
    throw err;
  }
  return item;
}

/* Removes an item. A client may remove only what they added themselves.
   Everything Me&Co. added, and everything carried over from their old
   website, is removed from the admin (asAdmin true). */
async function removeItem(slug, id, asAdmin) {
  const rec = await getFiles(slug);
  const idx = rec.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new UserError('That item was not found.');
  const item = rec.items[idx];
  if (!asAdmin && item.by !== 'client') {
    throw new UserError('Me&Co. added that one, so only we can remove it. Email us and we will take it off.');
  }
  rec.items.splice(idx, 1);
  await saveFiles(slug, rec);
  if (item.file && item.file.fileId) await deleteUpload(slug, item.file.fileId).catch((err) => console.error('[files] delete upload: ' + err.message));
  return item;
}

module.exports = {
  KINDS,
  KIND_KEYS,
  FILE_PREFIX,
  FILE_ID_RE,
  MAX_FILE_BYTES,
  connectBlobs,
  getFiles,
  saveFiles,
  isVisible,
  getUpload,
  addItem,
  removeItem,
  UserError,
};
