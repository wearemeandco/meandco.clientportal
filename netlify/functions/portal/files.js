/* ============================================================
   Me&Co. — file attachment storage
   ------------------------------------------------------------
   Real uploaded/generated files (a signed contract, an MSA, a
   generated PDF), separate from the JSON state blobs.js manages.
   Same dual backend: local disk for desktop use, Netlify Blobs
   (a separate 'files' store, binary this time) once deployed.

   Files attach for real, and an agent can create one, by calling
   saveFile the
   same way the admin upload action does, no separate mechanism
   needed. Whatever gets attached opens inside the same branded
   card-detail page every other item does, that page is the
   "branded viewer," a file item is just one more item type in it.
   ============================================================ */

const path = require('path');
const fs = require('fs');

const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA;
const FILES_DIR = path.join(__dirname, '..', '..', '..', 'data', 'files');

function localFilePath(slug, fileId) {
  return path.join(FILES_DIR, slug, fileId);
}

// buffer is a real Buffer, mimeType and filename are what gets served
// back on download. Netlify Blobs stores metadata alongside a blob via
// a second small JSON entry with the same key plus a suffix, simplest
// way to keep filename/mimeType without a second store.
async function saveFile(slug, fileId, buffer, filename, mimeType) {
  if (USE_LOCAL_FILES) {
    const dir = path.join(FILES_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localFilePath(slug, fileId), buffer);
    fs.writeFileSync(localFilePath(slug, fileId) + '.meta.json', JSON.stringify({ filename, mimeType }));
    return { fileId, filename, mimeType, size: buffer.length };
  }
  const { getStore } = require('@netlify/blobs');
  const store = getStore('files');
  await store.set(slug + '/' + fileId, buffer);
  await store.setJSON(slug + '/' + fileId + '.meta', { filename, mimeType });
  return { fileId, filename, mimeType, size: buffer.length };
}

async function getFile(slug, fileId) {
  if (USE_LOCAL_FILES) {
    try {
      const buffer = fs.readFileSync(localFilePath(slug, fileId));
      const meta = JSON.parse(fs.readFileSync(localFilePath(slug, fileId) + '.meta.json', 'utf8'));
      return { buffer, filename: meta.filename, mimeType: meta.mimeType };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
  const { getStore } = require('@netlify/blobs');
  const store = getStore('files');
  const buffer = await store.get(slug + '/' + fileId, { type: 'arrayBuffer' });
  if (!buffer) return null;
  const meta = (await store.get(slug + '/' + fileId + '.meta', { type: 'json' })) || {};
  return { buffer: Buffer.from(buffer), filename: meta.filename, mimeType: meta.mimeType };
}

module.exports = { saveFile, getFile };
