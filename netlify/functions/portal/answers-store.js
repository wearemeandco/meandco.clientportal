/* ============================================================
   Me&Co.: client answers store
   ------------------------------------------------------------
   What a client types into a portal form (onboarding questions, a
   stepped questionnaire) is kept in its own Netlify Blobs store,
   'client-answers', key `<slug>/<cardId>`. The client's page itself
   keeps coming from data/clients/<slug>.json; this store only holds
   their answers, which are layered onto the form when it opens.

   Netlify Forms is still the copy Melody receives. This store is
   what lets a client leave and come back on another device.
   ============================================================ */

const STORE = 'client-answers';
const ON_NETLIFY = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const USE_LOCAL_FILES = !!process.env.MORA_PORTAL_LOCAL_DATA && !ON_NETLIFY;

// In-memory stand-in for local runs and tests.
const memory = new Map();

function openStore() {
  const { getStore } = require('@netlify/blobs');
  // Netlify's own function access first; the stored site token is only a fallback.
  try {
    return getStore(STORE);
  } catch (err) {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) return getStore({ name: STORE, siteID, token });
    throw err;
  }
}

function keyFor(slug, cardId) {
  return String(slug) + '/' + String(cardId);
}

/* The saved record for one card, or null. A read failure is logged and
   treated as nothing saved, so the form still opens. */
async function getCardAnswers(slug, cardId) {
  const key = keyFor(slug, cardId);
  if (USE_LOCAL_FILES) return memory.get(key) || null;
  try {
    return (await openStore().get(key, { type: 'json' })) || null;
  } catch (err) {
    console.error('[answers] read failed for "' + key + '": ' + err.message);
    return null;
  }
}

/* Merges these answers over what was saved before and writes the record.
   A blank never replaces an answer already saved, and if the earlier record
   cannot be read the save fails rather than writing over it. */
async function saveCardAnswers(slug, cardId, answers, submitted) {
  const key = keyFor(slug, cardId);
  const previous = USE_LOCAL_FILES
    ? memory.get(key) || {}
    : (await openStore().get(key, { type: 'json' })) || {};
  const merged = Object.assign({}, previous.answers);
  Object.keys(answers || {}).forEach((id) => {
    const value = answers[id];
    const blank = value == null || (typeof value === 'string' && value.trim() === '');
    if (blank && merged[id] != null && String(merged[id]).trim() !== '') return;
    merged[id] = value;
  });
  const now = new Date().toISOString();
  const record = {
    answers: merged,
    updatedAt: now,
    submittedAt: submitted ? now : previous.submittedAt || null,
  };
  if (USE_LOCAL_FILES) {
    memory.set(key, record);
    return record;
  }
  await openStore().setJSON(key, record);
  return record;
}

module.exports = { STORE, getCardAnswers, saveCardAnswers };
