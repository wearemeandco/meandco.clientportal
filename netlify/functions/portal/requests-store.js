/* ============================================================
   Me&Co.: client request board, data layer
   ------------------------------------------------------------
   One record per client, key `requests/<slug>` in the same Netlify
   Blobs store the portal state lives in ('clients').

   {
     slug,
     visible,      // false keeps the board off the client's dashboard and
                   // makes /portal/<slug>/requests answer 404
     intro,        // one short note shown at the top of the board
     updatedAt,
     items: [{
       id, title, quote, page, status, note, liveUrl, from, date, source,
       link, image: { fileId, filename, mimeType, size } | null,
       confirm: { state: 'yes' | 'not_yet', note, at } | null,
       history: [{ at, type, note }]
     }]
   }

   status: received | in_progress | needs | done

   Reads: Blobs first, then the file bundled with the deploy
   (data/requests/<slug>.json), then an empty board. Writes: Blobs.
   On a developer machine with MORA_PORTAL_LOCAL_DATA set and no
   Netlify runtime, the bundled files are read and written directly.

   Screenshots live in their own Blobs store, 'request-files', under
   `<slug>/<fileId>`. Nothing is public: the only route that serves one
   is /portal/<slug>/file/<fileId> behind that client's own session.
   ============================================================ */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
    this.user = true;
  }
}

const PAGES = ['Home', 'Our Story', 'Programs', 'Get Involved', 'Resources', 'Whole site'];
const STATUSES = ['needs', 'received', 'in_progress', 'done'];
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_ITEMS = 400;
const MAX_IMAGES = 10;
const PLATFORMS = ['Instagram', 'Facebook', 'Newsletter', 'Something else'];
const FILE_PREFIX = 'rq-';

const ON_NETLIFY = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA && !ON_NETLIFY;
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'requests');
const LOCAL_FILES_DIR = path.join(__dirname, '..', '..', '..', 'data', 'request-files');

function pagesFor(rec) {
  return rec && Array.isArray(rec.pages) && rec.pages.length ? rec.pages : PAGES;
}

function validSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug);
}

/* A v1 Lambda handler gets its Blobs context from the invocation event.
   Called once per request; explicit credentials, when present, win. */
function connectBlobs(event) {
  if (USE_LOCAL_FILES) return;
  try {
    const blobs = require('@netlify/blobs');
    if (event && event.blobs && typeof blobs.connectLambda === 'function') blobs.connectLambda(event);
  } catch (err) {
    console.error('[requests] connectLambda: ' + err.message);
  }
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

/* A board published in the repository with a new publishRev replaces the
   saved copy, so new rows reach the live portal. Answers the client already
   gave carry over by row id; rows that are no longer on the board are kept
   in archived. */
function takeNewBoard(saved, bundled) {
  const byId = {};
  (saved.items || []).forEach((i) => { byId[i.id] = i; });
  const keep = ['status', 'decision', 'answer', 'confirm', 'review', 'history'];
  const items = (bundled.items || []).map((i) => {
    const old = byId[i.id];
    if (!old) return i;
    const merged = Object.assign({}, i);
    keep.forEach((k) => { if (old[k] !== undefined) merged[k] = old[k]; });
    return merged;
  });
  const ids = {};
  items.forEach((i) => { ids[i.id] = true; });
  const archived = (saved.archived || []).concat((saved.items || []).filter((i) => !ids[i.id]));
  return Object.assign({}, saved, bundled, { items, archived, review: saved.review });
}

async function getRequests(slug) {
  if (!validSlug(slug)) throw new Error('Bad slug');
  let raw = null;
  if (USE_LOCAL_FILES) {
    raw = readBundled(slug);
  } else {
    try {
      raw = await openStore('clients').get('requests/' + slug, { type: 'json' });
    } catch (err) {
      console.error('[requests] read failed for "' + slug + '", serving bundled copy: ' + err.message);
    }
    const bundled = readBundled(slug);
    if (!raw) raw = bundled;
    else if (bundled && bundled.publishRev && bundled.publishRev !== raw.publishRev) raw = takeNewBoard(raw, bundled);
  }
  const rec = raw || emptyRecord(slug);
  rec.items = Array.isArray(rec.items) ? rec.items : [];
  return rec;
}

async function saveRequests(slug, rec) {
  if (!validSlug(slug)) throw new Error('Bad slug');
  rec.updatedAt = new Date().toISOString();
  if (USE_LOCAL_FILES) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, slug + '.json'), JSON.stringify(rec, null, 2));
    return rec;
  }
  await openStore('clients').setJSON('requests/' + slug, rec);
  return rec;
}

/* ---------- images ---------- */

function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.slice(0, 6).toString('latin1'))) return 'image/gif';
  return null;
}

function cleanFilename(name, ext) {
  const base = String(name || 'screenshot').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60) || 'screenshot';
  return base + '.' + ext;
}

/* Validates by content, not by the name or type the browser claimed. */
async function saveImage(slug, upload) {
  if (!upload || typeof upload.data !== 'string') throw new UserError('No image was included.');
  const buf = Buffer.from(upload.data, 'base64');
  if (!buf.length) throw new UserError('That image was empty.');
  if (buf.length > MAX_IMAGE_BYTES) throw new UserError('That image is over 4 MB. Please choose a smaller screenshot.');
  const mimeType = sniffImage(buf);
  if (!mimeType) throw new UserError('Please attach a PNG, JPG, WebP or GIF image.');
  const fileId = FILE_PREFIX + crypto.randomBytes(12).toString('hex');
  const filename = cleanFilename(upload.name, IMAGE_TYPES[mimeType]);
  if (USE_LOCAL_FILES) {
    const dir = path.join(LOCAL_FILES_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileId), buf);
    fs.writeFileSync(path.join(dir, fileId + '.meta.json'), JSON.stringify({ filename, mimeType }));
  } else {
    const store = openStore('request-files');
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    await store.set(slug + '/' + fileId, ab, { metadata: { filename, mimeType } });
  }
  return { fileId, filename, mimeType, size: buf.length };
}

async function getImage(slug, fileId) {
  if (!validSlug(slug) || !/^rq-[a-f0-9]{24}$/.test(fileId || '')) return null;
  if (USE_LOCAL_FILES) {
    try {
      const dir = path.join(LOCAL_FILES_DIR, slug);
      const buffer = fs.readFileSync(path.join(dir, fileId));
      const meta = JSON.parse(fs.readFileSync(path.join(dir, fileId + '.meta.json'), 'utf8'));
      return { buffer, filename: meta.filename, mimeType: meta.mimeType };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
  const store = openStore('request-files');
  const res = await store.getWithMetadata(slug + '/' + fileId, { type: 'arrayBuffer' });
  if (!res || !res.data) return null;
  const meta = res.metadata || {};
  return { buffer: Buffer.from(res.data), filename: meta.filename, mimeType: meta.mimeType };
}

async function deleteImage(slug, fileId) {
  if (USE_LOCAL_FILES) {
    const dir = path.join(LOCAL_FILES_DIR, slug);
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

function cleanLink(value) {
  const v = clean(value, 500);
  if (!v) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(v)) throw new UserError('The link needs to start with http:// or https://');
  return v;
}

function localDate(zone) {
  return new Date().toLocaleDateString('en-CA', { timeZone: zone || 'America/Los_Angeles' });
}

function newId() {
  return 'r-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

/* A request from the board's own form. Lands as "Received". */
async function addRequest(slug, fromName, fields, upload, zone) {
  const what = clean(fields.what, 2000);
  if (!what) throw new UserError('Tell us what you need.');
  const link = cleanLink(fields.link);
  const rec = await getRequests(slug);
  const page = pagesFor(rec).includes(fields.page) ? fields.page : null;
  if (!page) throw new UserError('Choose which page this is about.');
  if (rec.items.length >= MAX_ITEMS) throw new UserError('This board is full. Please email us instead.');
  const image = upload ? await saveImage(slug, upload) : null;
  const item = {
    id: newId(),
    title: what.length > 140 ? what.slice(0, 137) + '...' : what,
    quote: what.length > 140 ? what : null,
    page,
    status: 'received',
    note: null,
    liveUrl: null,
    from: clean(fromName, 80) || null,
    date: localDate(zone),
    source: 'portal',
    link,
    image,
    confirm: null,
    history: [{ at: new Date().toISOString(), type: 'created', note: null }],
  };
  rec.items.unshift(item);
  try {
    await saveRequests(slug, rec);
  } catch (err) {
    if (image) await deleteImage(slug, image.fileId).catch(() => {});
    throw err;
  }
  return item;
}

/* The board answers a Done row. "yes" keeps it done. "not_yet" reopens
   it as Received and keeps their note on the row. */
async function confirmRequest(slug, id, answer, note) {
  if (answer !== 'yes' && answer !== 'not_yet') throw new UserError('Unknown answer.');
  const text = clean(note, 1000);
  if (answer === 'not_yet' && !text) throw new UserError('Add a short note about what is still off.');
  const rec = await getRequests(slug);
  const item = rec.items.find((i) => i.id === id);
  if (!item) throw new UserError('That request was not found.');
  if (item.status !== 'done') throw new UserError('Only a finished request can be confirmed.');
  const at = new Date().toISOString();
  item.history = Array.isArray(item.history) ? item.history : [];
  if (answer === 'yes') {
    item.confirm = { state: 'yes', note: null, at };
    item.history.push({ at, type: 'confirmed', note: null });
  } else {
    item.confirm = { state: 'not_yet', note: text, at };
    item.status = 'received';
    item.reopenedFrom = item.liveUrl || null;
    item.history.push({ at, type: 'not_yet', note: text });
  }
  await saveRequests(slug, rec);
  return item;
}


/* ---------- social media post requests ----------
   A post request is a row like any other (kind 'social'). Its images are
   attached one request at a time, because a function call carries about
   6 MB and a post can carry ten photos. */

function validDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 ? v : null;
}

const SERVICES = ['social', 'website', 'newsletter', 'deck', 'custom'];
const DECK_AUDIENCES = ['Funders', 'Sponsors', 'Partners', 'Something else'];
const NEWSLETTER_FEATURES = ['Community', 'Vendor features', 'Events', 'Something else'];

/* Which service buttons a client's board shows. A record with none set
   shows only Custom request. */
function servicesFor(rec) {
  const set = rec && Array.isArray(rec.services) ? rec.services.filter((x) => SERVICES.includes(x)) : [];
  if (!set.length) return ['custom'];
  return set.includes('custom') ? set : set.concat('custom');
}

function listOf(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function short(text, n) {
  return text.length > n ? text.slice(0, n - 3) + '...' : text;
}

/* One request for one service. The row lands as Received, carries the
   service as its type, and takes its images through attachImage. */
async function addServiceRequest(slug, fromName, service, fields, zone) {
  if (!SERVICES.includes(service)) throw new UserError('Unknown service.');
  const rec = await getRequests(slug);
  if (!servicesFor(rec).includes(service)) throw new UserError('That is not turned on for this board.');
  if (rec.items.length >= MAX_ITEMS) throw new UserError('This board is full. Please email us instead.');
  let title, page, note, quote = null, words = null, link = null;
  const details = [];
  if (service === 'social') {
    const platforms = listOf(fields.platforms).filter((x) => PLATFORMS.includes(x));
    if (!platforms.length) throw new UserError('Choose at least one place for the post to go.');
    const topic = clean(fields.topic, 400);
    if (!topic) throw new UserError('Tell us what the post is about.');
    const goesOut = validDate(fields.goesOut);
    if (!goesOut) throw new UserError('Choose the date it should go out.');
    words = clean(fields.words, 3000) || null;
    title = 'Post for ' + platforms.join(', ') + ': ' + short(topic, 100);
    quote = topic.length > 100 ? topic : null;
    page = 'Social media';
    note = 'To go out ' + goesOut;
    details.push(['Where', platforms.join(', ')], ['Goes out', goesOut]);
  } else if (service === 'website') {
    page = pagesFor(rec).includes(fields.page) ? fields.page : null;
    if (!page) throw new UserError('Choose which page this is about.');
    const what = clean(fields.what, 2000);
    if (!what) throw new UserError('Tell us what to change or add.');
    const section = clean(fields.section, 200);
    link = cleanLink(fields.link);
    title = short(what, 140);
    quote = what.length > 140 ? what : null;
    note = null;
    if (section) details.push(['Section', section]);
  } else if (service === 'newsletter') {
    const issue = clean(fields.issue, 120);
    if (!issue) throw new UserError('Tell us which issue or date this is for.');
    const features = listOf(fields.features).filter((x) => NEWSLETTER_FEATURES.includes(x));
    if (!features.length) throw new UserError('Choose what it should feature.');
    words = clean(fields.words, 3000) || null;
    title = 'Newsletter for ' + issue + ': ' + features.join(', ');
    page = 'Newsletter';
    note = null;
    details.push(['Issue', issue], ['Features', features.join(', ')]);
  } else if (service === 'deck') {
    const what = clean(fields.what, 2000);
    if (!what) throw new UserError('Tell us what the deck is for.');
    const audience = DECK_AUDIENCES.includes(fields.audience) ? fields.audience : null;
    if (!audience) throw new UserError('Choose who the deck is going to.');
    const needBy = fields.needBy ? validDate(fields.needBy) : null;
    if (fields.needBy && !needBy) throw new UserError('Choose a date that works, or leave it blank.');
    words = clean(fields.words, 3000) || null;
    title = 'Pitch deck for ' + audience.toLowerCase() + ': ' + short(what, 100);
    quote = what.length > 100 ? what : null;
    page = 'Pitch deck';
    note = needBy ? 'Deadline ' + needBy : null;
    details.push(['Going to', audience]);
    if (needBy) details.push(['Deadline', needBy]);
  } else {
    const what = clean(fields.what, 2000);
    if (!what) throw new UserError('Tell us what you need.');
    const needBy = fields.needBy ? validDate(fields.needBy) : null;
    if (fields.needBy && !needBy) throw new UserError('Choose a date that works, or leave it blank.');
    title = short(what, 140);
    quote = what.length > 140 ? what : null;
    page = 'Custom request';
    note = needBy ? 'Needed by ' + needBy : null;
    if (needBy) details.push(['Needed by', needBy]);
  }
  const item = {
    id: newId(),
    kind: service,
    service,
    title,
    quote,
    page,
    status: 'received',
    note,
    details,
    words,
    images: [],
    liveUrl: null,
    seeUrl: null,
    from: clean(fromName, 80) || null,
    date: localDate(zone),
    source: 'portal',
    link,
    image: null,
    confirm: null,
    history: [{ at: new Date().toISOString(), type: 'created', note: null }],
  };
  rec.items.unshift(item);
  await saveRequests(slug, rec);
  return item;
}

async function addSocialPost(slug, fromName, fields, zone) {
  return addServiceRequest(slug, fromName, 'social', fields, zone);
}

/* One image onto an existing row of this client's board. */
async function attachImage(slug, id, upload) {
  const rec = await getRequests(slug);
  const item = rec.items.find((i) => i.id === id);
  if (!item || item.source !== 'portal') throw new UserError('That request was not found.');
  item.images = Array.isArray(item.images) ? item.images : [];
  if (item.images.length >= MAX_IMAGES) throw new UserError('That is the most images a request can carry. Please send the rest by email.');
  const image = await saveImage(slug, upload);
  item.images.push(image);
  try {
    await saveRequests(slug, rec);
  } catch (err) {
    await deleteImage(slug, image.fileId).catch(() => {});
    throw err;
  }
  return { count: item.images.length };
}

/* Their answer to a row that is waiting on them (status needs).
   approve: it is right, the row is done and confirmed.
   not_yet: it needs work, the row goes to Received with their note.
   answer:  their reply to a question, the row goes to Received.
   decide:  they tapped one of the row's options (ask: 'decide'), or wrote
            their own under Something else. The row goes to Received and
            carries the choice, so it is checked off on their screen the
            moment they tap, with nobody on our side updating anything. */
function applyAnswer(rec, id, kind, text, note) {
  if (!['approve', 'not_yet', 'answer', 'decide'].includes(kind)) throw new UserError('Unknown answer.');
  const body = clean(text, 4000);
  if (kind !== 'approve' && !body) throw new UserError(kind === 'decide' ? 'Pick one first.' : 'Add a few words first.');
  const item = rec.items.find((i) => i.id === id);
  if (!item) throw new UserError('That request was not found.');
  if (item.status !== 'needs') throw new UserError('That one is not waiting on you.');
  const at = new Date().toISOString();
  item.history = Array.isArray(item.history) ? item.history : [];
  if (kind === 'approve') {
    item.status = 'done';
    item.confirm = { state: 'yes', note: body || null, at };
  } else if (kind === 'not_yet') {
    item.status = 'received';
    item.confirm = { state: 'not_yet', note: body, at };
  } else if (kind === 'decide') {
    const extra = clean(note, 4000);
    item.status = 'received';
    item.decision = { choice: body, note: extra || null, at };
    item.answer = { text: extra ? body + '. ' + extra : body, at };
  } else {
    item.status = 'received';
    item.answer = { text: body, at };
  }
  item.history.push({ at, type: kind, note: body || null });
  return item;
}

async function answerNeeds(slug, id, kind, text, note) {
  const rec = await getRequests(slug);
  const item = applyAnswer(rec, id, kind, text, note);
  await saveRequests(slug, rec);
  return item;
}

/* The "What we need from you" walkthrough sends every answer at once, on
   its final Submit. One read, every answer applied, one write, so a
   half-sent set never happens. An answer to a row that is no longer
   waiting (answered elsewhere already) is skipped, not an error. */
async function answerMany(slug, answers) {
  if (!Array.isArray(answers) || !answers.length) throw new UserError('Nothing to send yet.');
  if (answers.length > 40) throw new UserError('Too many answers at once.');
  const rec = await getRequests(slug);
  const saved = [];
  const skipped = [];
  for (const a of answers) {
    const id = String((a && a.id) || '');
    const item = rec.items.find((i) => i.id === id);
    if (!item || item.status !== 'needs') { skipped.push(id); continue; }
    applyAnswer(rec, id, String(a.kind || ''), a.text, a.note);
    saved.push(id);
  }
  if (saved.length) await saveRequests(slug, rec);
  return { saved, skipped };
}

/* ---------- review mode ----------
   The board goes through its requests one at a time. Each choice is a
   draft saved on the record as it is made (record.review.drafts); nothing
   changes on the board until submitReview applies the whole set at once.

   accept  it is right. A Done row becomes confirmed.
   change  it needs work. A Done row reopens into Received with the note.
           Any other row keeps its place and carries the note.
   edit    reword what they asked. The text updates and the old wording
           stays in the row's history. */

const CHOICES = ['accept', 'change', 'edit'];

async function saveReviewDraft(slug, id, draft) {
  const rec = await getRequests(slug);
  const item = rec.items.find((i) => i.id === id);
  if (!item) throw new UserError('That request was not found.');
  rec.review = rec.review || { drafts: {} };
  rec.review.drafts = rec.review.drafts || {};
  const choice = draft && draft.choice;
  if (!choice) {
    delete rec.review.drafts[id];
  } else {
    if (!CHOICES.includes(choice)) throw new UserError('Pick Accept, Change or Edit.');
    rec.review.drafts[id] = {
      choice,
      note: clean(draft.note, 1000),
      text: choice === 'edit' ? clean(draft.text, 2000) : '',
      at: new Date().toISOString(),
    };
  }
  await saveRequests(slug, rec);
  return { saved: true, drafts: Object.keys(rec.review.drafts).length };
}

function lineFor(n, item, d, before) {
  const head = n + '. [' + (item.page || 'Whole site') + '] ' + before;
  const NL = '\n   ';
  if (d.choice === 'accept') return head + NL + 'ACCEPT: it is right.' + (d.note ? ' Note: ' + d.note : '');
  if (d.choice === 'change') return head + NL + 'CHANGE: ' + d.note;
  return head + NL + 'EDIT, now reads: ' + d.text + (d.note ? NL + 'Note: ' + d.note : '');
}

async function submitReview(slug) {
  const rec = await getRequests(slug);
  const drafts = (rec.review && rec.review.drafts) || {};
  const ids = Object.keys(drafts);
  if (!ids.length) throw new UserError('Nothing to send yet. Choose Accept, Change or Edit on at least one request.');
  const at = new Date().toISOString();
  const lines = [];
  const tally = { accept: 0, change: 0, edit: 0 };
  let n = 0;
  for (const id of ids) {
    const d = drafts[id];
    const item = rec.items.find((i) => i.id === id);
    if (!item) continue;
    if (d.choice === 'change' && !d.note) throw new UserError('Add a short note on every request you marked Change.');
    if (d.choice === 'edit' && !d.text) throw new UserError('Add the new wording on every request you marked Edit.');
  }
  for (const id of ids) {
    const d = drafts[id];
    const item = rec.items.find((i) => i.id === id);
    if (!item) continue;
    n += 1;
    tally[d.choice] += 1;
    const before = item.quote || item.title;
    item.history = Array.isArray(item.history) ? item.history : [];
    if (d.choice === 'accept') {
      if (item.status === 'done') item.confirm = { state: 'yes', note: null, at };
      item.review = { state: 'accepted', note: d.note || null, at };
      item.history.push({ at, type: 'accepted', note: d.note || null });
    } else if (d.choice === 'change') {
      if (item.status === 'done') {
        item.confirm = { state: 'not_yet', note: d.note, at };
        item.status = 'received';
        item.reopenedFrom = item.liveUrl || null;
      }
      item.review = { state: 'change', note: d.note, at };
      item.history.push({ at, type: 'change', note: d.note });
    } else {
      item.history.push({ at, type: 'edit', note: d.note || null, from: before, to: d.text });
      item.title = d.text.length > 140 ? d.text.slice(0, 137) + '...' : d.text;
      item.quote = d.text.length > 140 ? d.text : null;
      item.review = { state: 'edit', note: d.note || null, at };
    }
    lines.push(lineFor(n, item, d, before));
  }
  rec.review = { drafts: {}, lastSubmittedAt: at, submissions: ((rec.review && rec.review.submissions) || 0) + 1 };
  await saveRequests(slug, rec);
  const summary = 'Review submitted: ' + n + ' requests. Accept ' + tally.accept + ', Change ' + tally.change + ', Edit ' + tally.edit + '.\n\n' + lines.join('\n\n');
  return { count: n, tally, summary };
}

function counts(rec) {
  const c = { needs: 0, received: 0, in_progress: 0, done: 0, unconfirmed: 0 };
  (rec.items || []).forEach((i) => {
    if (c[i.status] !== undefined) c[i.status] += 1;
    if (i.status === 'done' && !(i.confirm && i.confirm.state === 'yes')) c.unconfirmed += 1;
  });
  return c;
}

module.exports = {
  PAGES,
  STATUSES,
  MAX_IMAGE_BYTES,
  FILE_PREFIX,
  connectBlobs,
  getRequests,
  saveRequests,
  getImage,
  addRequest,
  confirmRequest,
  saveReviewDraft,
  submitReview,
  addSocialPost,
  addServiceRequest,
  servicesFor,
  SERVICES,
  DECK_AUDIENCES,
  NEWSLETTER_FEATURES,
  attachImage,
  answerNeeds,
  answerMany,
  pagesFor,
  UserError,
  MAX_IMAGES,
  PLATFORMS,
  counts,
};
