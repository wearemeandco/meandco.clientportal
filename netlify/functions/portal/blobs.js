/* ============================================================
   Me&Co.: client portal data layer
   ------------------------------------------------------------
   One JSON record per client, keyed by slug.
   Shape:
   {
     slug, name, repeatClient,
     cards: [{ id, project, type, label, status, locked, unlockNote }],
     activity: [{ date, text, cardId }]
   }

   Two backends, same interface either way:
   - MORA_PORTAL_LOCAL_DATA set (dev, branch-deploy and deploy-preview
     contexts): plain JSON files under data/clients/. No cloud account
     needed to run this on your own machine.
   - Otherwise (production): Netlify Blobs, store 'clients'.

   Netlify does not reliably inject the Blobs siteID and token into
   Functions, so clientsStore() passes them explicitly from
   NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN.
   ============================================================ */

const path = require('path');
const fs = require('fs');

const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA;
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'clients');

// Single source of truth for how every call site opens the 'clients'
// store, so the explicit-credentials fix only has to live in one place.
function clientsStore() {
  // Netlify's own function access first, the saved token as a fallback. See store.js.
  return require('./store').openStore('clients');
}

function localPath(slug) {
  return path.join(DATA_DIR, slug + '.json');
}

// An offboarding card stays locked until the final invoice for that
// project is paid, unless the project was paid upfront, which is tracked
// separately since there is no other signal for it. Computed fresh on
// every read so it always reflects real invoice status, never a stale
// stored flag, EXCEPT when admin has manually unlocked it
// (setCardStatus's unlock path). That override wins.
function applyComputedLocks(state) {
  if (!state) return state;
  const paidUpfront = state.paidUpfrontProjects || [];
  (state.cards || []).forEach((card) => {
    if (card.lockRule !== 'invoice' || card.manualUnlock) return;
    const siblingInvoice = (state.cards || []).find((c) => c.project === card.project && /invoice/.test(c.id));
    const invoicePaid = siblingInvoice && siblingInvoice.status === 'complete';
    const upfront = paidUpfront.includes(card.project);
    card.locked = !(invoicePaid || upfront);
  });
  return state;
}

/* Dates are stamped in the client's own timezone, never UTC.

   The studio runs on Pacific. A client in an eastern timezone is stamped
   in theirs, and CLIENT_TIMEZONE below is the register of who is where.

   Stamping in UTC is silently wrong: anything a Miami client submits
   between 8pm and midnight their time carries tomorrow's date, roughly
   17 percent of the day. From a machine on Pacific time the window is
   7 hours wide, closer to 29 percent. Nobody notices until a client asks
   why the portal says they replied on a day they did not. */
const CLIENT_TIMEZONE = {};
const STUDIO_TIMEZONE = 'America/New_York';

function localDate(slug) {
  const zone = CLIENT_TIMEZONE[slug] || STUDIO_TIMEZONE;
  // en-CA gives YYYY-MM-DD, which is the format every date field here uses.
  return new Date().toLocaleDateString('en-CA', { timeZone: zone });
}

function readBundledFile(slug) {
  try {
    return JSON.parse(fs.readFileSync(localPath(slug), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/* Read from Blobs, fall back to the file bundled with the deploy.

   Reads try Blobs first and serve the bundled data/clients/<slug>.json only
   when Blobs has no record for that slug or the read throws, so a portal
   never renders blank. Writes go to Blobs only. */
async function getClientState(slug) {
  if (USE_LOCAL_FILES) {
    return applyComputedLocks(readBundledFile(slug));
  }
  let raw = null;
  let readOk = false;
  try {
    raw = await clientsStore().get(slug, { type: 'json' });
    readOk = true;
  } catch (err) {
    // A Blobs outage or a credentials problem must never take a portal
    // down. Log it and serve the bundled copy, which is stale at worst.
    console.error('[blobs] read failed for "' + slug + '", serving bundled copy: ' + err.message);
  }
  const bundled = readBundledFile(slug);
  if (readOk && bundled && bundled.publishRev && (!raw || raw.publishRev !== bundled.publishRev)) {
    raw = mergePublished(raw, bundled);
    try {
      await clientsStore().setJSON(slug, raw);
      console.log('[blobs] published repo record for "' + slug + '" at rev ' + bundled.publishRev);
    } catch (err) {
      // Serve the published copy anyway; the write is retried next read.
      console.error('[blobs] publish write failed for "' + slug + '": ' + err.message);
    }
  }
  if (!raw) raw = bundled;
  if (raw) await applySentForms(slug, raw);
  return applyComputedLocks(raw) || null;
}

/* Publishing a repo edit to the live portal.

   Production renders the Blobs record, so an edit to
   data/clients/<slug>.json used to change nothing a client sees until
   someone holding a Netlify token rewrote Blobs by hand. That is how
   Melody's page sat frozen for weeks while her file was correct.

   The fix is a handshake. Bump "publishRev" in the repo file (any new
   string, a date works) and deploy. On the next read the function, which
   always has Blobs access, sees the bundled rev differs from the live
   one, merges, writes, and from then on the live record carries that rev
   so admin edits made afterwards are never overwritten again. A file
   with no publishRev never touches Blobs, so every other client behaves
   exactly as before.

   The repo copy wins on everything we author (cards, copy, statuses).
   What the client wrote themselves is kept from the live record:
   onboarding and brief answers newer than the repo's, and any activity
   entry the repo does not already carry. */
function mergePublished(live, repo) {
  const out = JSON.parse(JSON.stringify(repo));
  if (!live) return out;
  const newer = (a, b) => String((a && (a.submittedAt || a.updatedAt)) || '') > String((b && (b.submittedAt || b.updatedAt)) || '');
  const liveAnswers = live.onboardingAnswers || {};
  out.onboardingAnswers = out.onboardingAnswers || {};
  Object.keys(liveAnswers).forEach((cardId) => {
    if (!out.onboardingAnswers[cardId] || newer(liveAnswers[cardId], out.onboardingAnswers[cardId])) {
      out.onboardingAnswers[cardId] = liveAnswers[cardId];
    }
  });
  if (live.briefAnswers && (!out.briefAnswers || newer(live.briefAnswers, out.briefAnswers))) out.briefAnswers = live.briefAnswers;
  if (live.brief && !out.brief) out.brief = live.brief;
  const seen = new Set((out.activity || []).map((a) => a.date + '|' + a.text));
  (live.activity || []).forEach((a) => {
    if (!seen.has(a.date + '|' + a.text)) {
      out.activity = out.activity || [];
      out.activity.push(a);
      seen.add(a.date + '|' + a.text);
    }
  });
  return out;
}

/* A form card the client has sent shows as complete. The send is recorded
   in the client answers store, so the card moves on without anyone editing
   the client's file. */
async function applySentForms(slug, state) {
  const answersStore = require('./answers-store');
  const formCards = (state.cards || []).filter((card) =>
    card.status !== 'complete' && (card.form === true || /onboarding-questions/.test(card.id)));
  await Promise.all(formCards.map(async (card) => {
    const record = await answersStore.getCardAnswers(slug, card.id);
    if (record && record.submittedAt) card.status = 'complete';
  }));
}

async function saveClientState(slug, state) {
  if (USE_LOCAL_FILES) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(localPath(slug), JSON.stringify(state, null, 2));
    return state;
  }
  await clientsStore().setJSON(slug, state);
  return state;
}

async function appendActivity(slug, text, cardId) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  state.activity = state.activity || [];
  state.activity.unshift({
    date: localDate(slug),
    text,
    cardId: cardId || null,
  });
  return saveClientState(slug, state);
}

async function setCardStatus(slug, cardId, status, unlockNote) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const card = (state.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('No card "' + cardId + '" for slug: ' + slug);
  card.status = status;
  if (unlockNote) {
    card.locked = false;
    card.manualUnlock = true;
    state.activity = state.activity || [];
    state.activity.unshift({
      date: localDate(slug),
      text: unlockNote,
      cardId,
    });
  }
  return saveClientState(slug, state);
}

async function addCardItem(slug, cardId, item) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const card = (state.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('No card "' + cardId + '" for slug: ' + slug);
  card.items = card.items || [];
  // A file item's url is the real portal route that serves it (see
  // files.js), computed here so a file behaves exactly like a link item
  // everywhere else in the codebase, no special-case rendering needed.
  const url = item.fileId ? '/portal/' + slug + '/file/' + item.fileId : item.url || null;
  card.items.push({
    id: item.id || (item.title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
    type: item.type || 'link',
    title: item.title,
    description: item.description || '',
    url,
    fileId: item.fileId || null,
    mimeType: item.mimeType || null,
    content: item.content || null,
  });
  state.activity = state.activity || [];
  state.activity.unshift({
    date: localDate(slug),
    text: 'Added "' + item.title + '" to ' + card.label,
    cardId,
  });
  return saveClientState(slug, state);
}

async function addCard(slug, card) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  if (!card || !card.id) throw new Error('A new card needs an id.');
  state.cards = state.cards || [];
  if (state.cards.some((c) => c.id === card.id)) {
    throw new Error('Card "' + card.id + '" already exists for slug: ' + slug);
  }
  state.cards.push(card);
  return saveClientState(slug, state);
}

async function setPaidUpfront(slug, project, paidUpfront) {
  const raw = USE_LOCAL_FILES
    ? JSON.parse(fs.readFileSync(localPath(slug), 'utf8'))
    : await clientsStore().get(slug, { type: 'json' });
  if (!raw) throw new Error('No portal state for slug: ' + slug);
  raw.paidUpfrontProjects = raw.paidUpfrontProjects || [];
  const idx = raw.paidUpfrontProjects.indexOf(project);
  if (paidUpfront && idx === -1) raw.paidUpfrontProjects.push(project);
  if (!paidUpfront && idx !== -1) raw.paidUpfrontProjects.splice(idx, 1);
  // Internal billing-status change, not client news, no activity entry.
  return saveClientState(slug, raw);
}

/* Stage 2 of intake. Two halves, stored on the same client record:

   state.brief        which sections and questions Melody selected for
                      this client after their real discovery call. Written
                      from /admin/<slug>/brief. See discovery-bank.js.
   state.briefAnswers what the client wrote back. Autosaved on every step
                      forward, so a half finished brief survives a closed
                      tab, and stamped with submittedAt only on a real send.

   Only the final send writes an activity entry. An autosave is not news,
   and an activity feed that says "brief updated" nine times is a feed
   nobody reads. */
async function setBriefSelection(slug, brief) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  state.brief = Object.assign({}, state.brief, brief, { updated: new Date().toISOString() });
  return saveClientState(slug, state);
}

async function saveBriefAnswers(slug, answers, submitted) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const previous = state.briefAnswers || {};
  state.briefAnswers = {
    answers: Object.assign({}, previous.answers, answers),
    updatedAt: new Date().toISOString(),
    submittedAt: submitted ? new Date().toISOString() : previous.submittedAt || null,
  };
  if (submitted) {
    state.activity = state.activity || [];
    state.activity.unshift({
      date: localDate(slug),
      text: 'Discovery brief sent back to Melody.',
      cardId: null,
    });
    // Every renderer that decides what a client needs to do next reads
    // the card, never briefAnswers, so a submit that stops here leaves
    // the Discovery card reading "Not started" to a client who just
    // finished it. Moved off "not_started" only when exactly one
    // Discovery card is waiting on a brief: a client with two projects
    // open at once is real (caraballo, meandco both carry a second
    // "-discovery" card already past this stage) and guessing which of
    // two waiting cards this submission belongs to would move the wrong
    // one, so that case is left for a real write instead of a guess.
    const waiting = (state.cards || []).filter(
      (c) => /-discovery$/.test(c.id) && c.status === 'not_started'
    );
    if (waiting.length === 1) {
      waiting[0].status = 'in_progress';
    }
  }
  return saveClientState(slug, state);
}

/* Onboarding answers, saved into the client's own portal state.

   A submitted answer set is automatic and visible: the client can see
   it, edit it, update it and send it again from their own portal.
   Posting to Netlify Forms alone is not enough, because the answers then
   live in Netlify's dashboard and nowhere the client can see, and their
   card still reads "not started" after they have filled the whole thing
   in.

   Same shape as saveBriefAnswers above, keyed by card so a client with
   more than one question set does not overwrite themselves. Answers merge
   rather than replace, so a partial resubmit cannot wipe an earlier one.
   Only a real submit writes activity and flips the card, because an
   autosave is not news. */
async function saveOnboardingAnswers(slug, cardId, answers, submitted) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const card = (state.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('No card "' + cardId + '"');

  state.onboardingAnswers = state.onboardingAnswers || {};
  const previous = state.onboardingAnswers[cardId] || {};
  state.onboardingAnswers[cardId] = {
    answers: Object.assign({}, previous.answers, answers),
    updatedAt: new Date().toISOString(),
    submittedAt: submitted ? new Date().toISOString() : previous.submittedAt || null,
  };

  // The answers are written back onto the items themselves too, so every
  // existing renderer (card detail, the dashboard accordion, the DOCX
  // export) shows them without needing to know this feature exists.
  // Client-written text is the only untrusted input that reaches these
  // fields. item.notes is rendered as trusted HTML in three places (the
  // card page, the dashboard accordion, and Melody's admin editor,
  // which puts it inside a contenteditable), on the documented assumption
  // that only an authenticated admin ever writes it. That assumption
  // stopped being true the moment clients could save here, so it gets
  // escaped on the way in rather than trusting three separate renderers.
  //
  // Newlines become real breaks, because Melody's answers separate three
  // sub-answers with blank lines and HTML collapsed them into one
  // run-on sentence on her live portal.
  const escapeForNotes = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\r\n|\r|\n/g, '<br>');

  // Only a real submit publishes to the card. An autosave keeps the draft
  // in onboardingAnswers and nowhere else, because the form promises
  // "nothing is sent until you confirm below" and half-typed text
  // appearing in the client's own dashboard makes that promise false.
  if (submitted) {
    for (const item of card.items || []) {
      const value = state.onboardingAnswers[cardId].answers[item.id];
      if (typeof value === 'string' && value.trim()) {
        item.notes = escapeForNotes(value);
        item.status = 'complete';
      }
    }
  }

  if (submitted) {
    card.status = 'complete';
    state.activity = state.activity || [];
    state.activity.unshift({
      date: localDate(slug),
      text: 'You sent back your ' + String(card.label || 'onboarding').toLowerCase() + ' answers.',
      cardId,
    });
  }
  return saveClientState(slug, state);
}

function findItem(state, cardId, itemId) {
  const card = (state.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('No card "' + cardId + '"');
  const item = (card.items || []).find((i) => i.id === itemId);
  if (!item) throw new Error('No item "' + itemId + '" on card "' + cardId + '"');
  return { card, item };
}

// The project name is a shared grouping key, not a per-card field, every
// card whose project matches gets renamed together so the group stays
// intact. Renaming the individual cards one at a time is not the same
// operation and splits the group.
async function renameProject(slug, oldName, newName) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  let matched = 0;
  (state.cards || []).forEach((card) => {
    if (card.project === oldName) {
      card.project = newName;
      matched += 1;
    }
  });
  if (!matched) throw new Error('No cards found under project "' + oldName + '"');
  return saveClientState(slug, state);
}

async function updateCardFields(slug, cardId, fields) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const card = (state.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('No card "' + cardId + '"');
  // A manual lock toggle from the editor overrides lockRule's computed
  // value going forward, same reasoning as the old unlock-with-note flow,
  // just without requiring a separate form now that this is inline.
  if (Object.prototype.hasOwnProperty.call(fields, 'locked') && card.lockRule) {
    card.manualUnlock = true;
  }
  const wasLocked = card.locked;
  Object.assign(card, fields);
  if (Object.prototype.hasOwnProperty.call(fields, 'locked') && wasLocked !== card.locked && !card.locked) {
    // Only announce unlocking, a client-relevant "this is ready now"
    // moment. Re-locking is an internal correction, not client news.
    state.activity = state.activity || [];
    state.activity.unshift({
      date: localDate(slug),
      text: card.label + ' (' + card.project + ') is now available.',
      cardId,
    });
  }
  return saveClientState(slug, state);
}

async function updateItemFields(slug, cardId, itemId, fields) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const { item } = findItem(state, cardId, itemId);
  Object.assign(item, fields);
  return saveClientState(slug, state);
}

async function deleteCardItem(slug, cardId, itemId) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const card = (state.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('No card "' + cardId + '"');
  card.items = (card.items || []).filter((i) => i.id !== itemId);
  return saveClientState(slug, state);
}

async function setChecklist(slug, cardId, itemId, checklist) {
  const state = await getClientState(slug);
  if (!state) throw new Error('No portal state for slug: ' + slug);
  const { item } = findItem(state, cardId, itemId);
  item.checklist = checklist;
  return saveClientState(slug, state);
}

module.exports = {
  clientsStore,
  mergePublished,
  getClientState,
  saveClientState,
  appendActivity,
  setCardStatus,
  addCardItem,
  addCard,
  setPaidUpfront,
  updateCardFields,
  updateItemFields,
  deleteCardItem,
  setChecklist,
  renameProject,
  setBriefSelection,
  saveBriefAnswers,
  saveOnboardingAnswers,
};
