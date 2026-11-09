/* ============================================================
   Me&Co. — gated client portal
   ------------------------------------------------------------
   One function serves every /portal/<slug> request:

     GET  + valid session cookie -> the dashboard (real Blobs state)
     GET  + ?k=<magic token>     -> sets the session cookie, then the
                                    dashboard. The link Melody sends
                                    an existing client who does not want
                                    to hunt for a passcode.
     GET  without                -> the lock screen
     POST { passcode }           -> checked against the client's
                                    env var, sets a session cookie
     POST { action: save-brief } -> stage 2 discovery answers, session
                                    required, same gate as everything else

   Auth pattern reused from weareme's proven proposal gate:
   env-var passcode per client, HMAC-signed session cookie, fails
   closed on misconfiguration, timing-safe comparison. The token and
   cookie mechanics live in session.js, so the /start sign in page uses
   the identical implementation rather than a second copy of it.
   ============================================================ */

const { getClient } = require('./clients');
const { renderLockScreen } = require('./lock-screen');
const { renderDashboard } = require('./dashboard');
const { renderCardDetail } = require('./card-detail');
const { renderOnboardingForm } = require('./onboarding-form');
const { renderSteppedForm } = require('./stepped-form');
const { renderBriefForm } = require('../intake/brief-form');
const { resolveBrief } = require('./discovery-bank');
const { getClientState, saveBriefAnswers } = require('./blobs');
const answersStore = require('./answers-store');
const { generateDocx } = require('./docx-export');
const { getFile } = require('./files');
const requestsStore = require('./requests-store');
const clientSecrets = require('./client-secrets');
const passcodes = require('./passcodes');
const { handleForgot } = require('./forgot');
const { renderRequestsPage, renderReviewPage, isVisible: boardVisible } = require('./requests-board');
const filesStore = require('./files-store');
const { wakeForPortal } = require('../lib/everly');
const { renderFilesPage } = require('./files-page');
const {
  cookieName,
  safeEqual,
  makeSessionToken,
  verifySessionToken,
  verifyMagicToken,
  readCookie,
  buildCookie,
  clearCookie,
  isSecureRequest,
} = require('./session');
const { isAdminRequest } = require('../admin/admin-session');
const notices = require('./notices');
const { withAdminBar } = require('../admin/admin-bar');

const WRONG_PASSCODE_MESSAGE = 'That passcode did not work. Please check it and try again.';

/* Reserved path segment. /portal/<slug>/brief is stage 2, never a card,
   so no card may ever use this id. Checked before the card lookup below. */
const BRIEF_SEGMENT = 'brief';

/* Reserved the same way: /portal/<slug>/requests is the request board, so
   no card may ever use this id. */
const REQUESTS_SEGMENT = 'requests';
const REVIEW_SEGMENT = 'requests-review';

/* Reserved the same way: /portal/<slug>/files is "Your files and links". */
const FILES_SEGMENT = 'files';
const FILES_MESSAGES = ['Added. It is on your list now.', 'Removed.'];

const BOARD_MESSAGES = [
  'Got it. Your request is on the board under Received.',
  'Your request is on the board. If you do not hear from us in a day, send us a quick email.',
  'Thank you. We have marked that as confirmed.',
  'Thank you. We have reopened that one and will take another look.',
  'We have reopened that one. If you do not hear from us in a day, send us a quick email.',
  'Thank you. Your review is on its way to us and your board is updated.',
  'Your review is saved on your board. If you do not hear from us in a day, send us a quick email.',
  'Got it. Your post request is on the board under Received.',
  'Got it. Your request is on the board under Received.',
  'Thank you. We have your answer.',
  'Thank you. We have marked that as approved.',
  'Thank you. We will take another look and be back to you.',
  'Your answer is on the board. If you do not hear from us in a day, send us a quick email.',
  'Received, thank you. Your Airtable token is saved safely.',
  'Received, thank you. Your Airtable token is saved safely. If you do not hear from us in a day, send us a quick email.',
];

const NO_STORE = {
  'Cache-Control': 'no-store, private, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function html(statusCode, body, extraHeaders) {
  return { statusCode, headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, NO_STORE, extraHeaders || {}), body };
}
function json(statusCode, obj, extraHeaders) {
  return { statusCode, headers: Object.assign({ 'Content-Type': 'application/json' }, NO_STORE, extraHeaders || {}), body: JSON.stringify(obj) };
}
function notFound() {
  return html(404, '<!DOCTYPE html><meta charset="utf-8"><title>Not found</title><div style="font-family:sans-serif;padding:60px;text-align:center"><h1>Not found</h1></div>');
}

function getSlug(event) {
  const q = (event.queryStringParameters && event.queryStringParameters.slug) || '';
  if (q) return q;
  const p = (event.path || '').replace(/\/+$/, '');
  const m = p.match(/\/(?:portal|onboarding-form)\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function getCardId(event) {
  const q = (event.queryStringParameters && event.queryStringParameters.cardId) || '';
  if (q) return q;
  const p = (event.path || '').replace(/\/+$/, '');
  const m = p.match(/\/(?:portal|onboarding-form)\/[^/]+\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function getFormat(event) {
  return (event.queryStringParameters && event.queryStringParameters.format) || '';
}

function isFormRequest(event) {
  if (event.queryStringParameters && event.queryStringParameters.form) return true;
  const p = (event.path || '').replace(/\/+$/, '');
  return /^\/onboarding-form\//.test(p);
}

function getFileId(event) {
  const q = (event.queryStringParameters && event.queryStringParameters.fileId) || '';
  if (q) return q;
  const p = (event.path || '').replace(/\/+$/, '');
  const m = p.match(/\/portal\/[^/]+\/file\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function parseBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

exports.handler = async function (event) {
  requestsStore.connectBlobs(event);
  const slug = getSlug(event);
  const client = await getClient(slug);
  if (!client) return notFound();

  /* An archived portal is closed and a locked one is still being set up.
     Neither shows any data. A locked portal shows its real pages to the
     signed-in admin. */
  if (client.archived || (client.locked && !isAdminRequest(event))) {
    const notice = client.archived ? notices.closedPage() : notices.settingUpPage();
    const isGet = (event.httpMethod || 'GET').toUpperCase() === 'GET';
    return html(isGet ? 200 : 403, notice);
  }

  const secure = isSecureRequest(event);
  const name = cookieName(client.slug);
  const method = (event.httpMethod || 'GET').toUpperCase();

  /* Forgot passcode. Answered before the passcode lookup and always with the
     same reply, matched or not. Padded to a minimum time so the response
     speed does not hint whether an email was on file. */
  if (method === 'POST' && parseBody(event).action === 'forgot') {
    const [message] = await Promise.all([
      handleForgot(client, parseBody(event).email),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    return json(200, { ok: true, message });
  }

  /* Blobs passcode first, then the PORTAL_PASSWORD_<SLUG> variable. */
  const auth = await passcodes.resolveAuth(client);
  const passcode = auth ? auth.secret : '';

  /* A portal with no passcode yet is shown to the signed-in admin, read only,
     and to no one else. */
  if (!passcode && !((event.httpMethod || 'GET').toUpperCase() === 'GET' && isAdminRequest(event))) {
    console.error('[portal] Missing environment variable ' + client.envKey + ' for slug "' + client.slug + '".');
    return html(503, '<!DOCTYPE html><meta charset="utf-8"><div style="font-family:sans-serif;padding:60px;text-align:center"><h1>This portal is not available yet</h1><p>Please contact melody@weareme.co.</p></div>');
  }

  if (method === 'POST') {
    const fields = parseBody(event);

    /* Stage 2 answers. Behind the same session the dashboard is behind,
       checked here rather than trusted from the page that posted them. */
    if (fields.action === 'save-brief') {
      const sessionToken = readCookie(event.headers, name);
      if (!verifySessionToken(sessionToken, client.slug, passcode)) {
        return json(401, { ok: false, error: 'Your session expired. Open your portal link again.' });
      }
      if (!fields.answers || typeof fields.answers !== 'object') {
        return json(400, { ok: false, error: 'No answers were included.' });
      }
      try {
        await saveBriefAnswers(client.slug, fields.answers, !!fields.submit);
        if (fields.submit) await wakeForPortal(client.slug, 'brief-submitted');
        return json(200, { ok: true, submitted: !!fields.submit });
      } catch (err) {
        console.error('[portal] save-brief: ' + err.message);
        return json(500, { ok: false, error: 'That did not save. Try again in a moment.' });
      }
    }

    /* Onboarding answers. Behind the same session as everything else,
       checked here rather than trusted from the page that posted them.
       They must land in the client's own portal, not only in Netlify
       Forms, or a client fills in seven questions and sees no trace of
       it on a card that still reads "not started". */
    if (fields.action === 'save-onboarding') {
      const sessionToken = readCookie(event.headers, name);
      if (!verifySessionToken(sessionToken, client.slug, passcode)) {
        return json(401, { ok: false, error: 'Your session expired. Open your portal link again.' });
      }
      if (!fields.cardId || !fields.answers || typeof fields.answers !== 'object') {
        return json(400, { ok: false, error: 'No answers were included.' });
      }
      try {
        // Only an open card that actually carries a form can take answers.
        // A locked card (an upcoming step) must not be completable by a post.
        const openCards = ((await getClientState(client.slug)) || {}).cards || [];
        const formCard = openCards.find((c) => c.id === fields.cardId);
        if (!formCard || formCard.locked || !(formCard.form === true || /onboarding-questions/.test(formCard.id))) {
          return json(403, { ok: false, error: 'That step is not open yet.' });
        }
        await answersStore.saveCardAnswers(client.slug, fields.cardId, fields.answers, !!fields.submit);
        if (fields.submit) await wakeForPortal(client.slug, 'onboarding-submitted', fields.cardId);
        return json(200, { ok: true, submitted: !!fields.submit });
      } catch (err) {
        console.error('[portal] save-onboarding: ' + err.message);
        return json(500, { ok: false, error: 'That did not save. Try again in a moment.' });
      }
    }

    /* Request board. Same session gate as everything else. */
    if (['request-add', 'request-confirm', 'review-save', 'review-submit', 'request-social', 'request-service', 'request-attach', 'request-answer', 'request-answers', 'secret-save'].indexOf(fields.action) !== -1) {
      const sessionToken = readCookie(event.headers, name);
      if (!verifySessionToken(sessionToken, client.slug, passcode)) {
        return json(401, { ok: false, error: 'Your session expired. Open your portal link again.' });
      }
      try {
        const rec = await requestsStore.getRequests(client.slug);
        if (!boardVisible(rec)) return json(404, { ok: false, error: 'Not found.' });
        if (fields.action === 'secret-save') {
          /* Write only. The value is validated and stored, and the answer
             carries the date and the last 4 characters, nothing else. */
          const out = await clientSecrets.saveSecret(client.slug, String(fields.secret || ''), fields.value, { base: fields.base });
          return json(200, { ok: true, last4: out.last4, savedAt: out.savedAt });
        }
        if (fields.action === 'request-add') {
          const upload = fields.image && typeof fields.image === 'object' ? fields.image : null;
          const item = await requestsStore.addRequest(client.slug, 'Sent from the portal', fields, upload);
          await wakeForPortal(client.slug, 'request-add', item.id);
          return json(200, { ok: true, item: { id: item.id } });
        }
        if (fields.action === 'request-social') {
          const item = await requestsStore.addSocialPost(client.slug, 'Sent from the portal', fields);
          await wakeForPortal(client.slug, 'request-social', item.id);
          return json(200, { ok: true, item: { id: item.id, title: item.title } });
        }
        if (fields.action === 'request-service') {
          const item = await requestsStore.addServiceRequest(client.slug, 'Sent from the portal', String(fields.service || ''), fields);
          await wakeForPortal(client.slug, 'request-service', item.id);
          return json(200, { ok: true, item: { id: item.id, title: item.title } });
        }
        if (fields.action === 'request-attach') {
          const out = await requestsStore.attachImage(client.slug, String(fields.id || ''), fields.image);
          return json(200, { ok: true, count: out.count });
        }
        if (fields.action === 'request-answers') {
          const out = await requestsStore.answerMany(client.slug, fields.answers);
          return json(200, { ok: true, saved: out.saved, skipped: out.skipped });
        }
        if (fields.action === 'request-answer') {
          const item = await requestsStore.answerNeeds(client.slug, String(fields.id || ''), fields.kind, fields.text, fields.note);
          await wakeForPortal(client.slug, 'request-answered', item.id);
          return json(200, { ok: true, item: { id: item.id } });
        }
        if (fields.action === 'review-save') {
          const out = await requestsStore.saveReviewDraft(client.slug, String(fields.id || ''), fields);
          return json(200, { ok: true, drafts: out.drafts });
        }
        if (fields.action === 'review-submit') {
          const out = await requestsStore.submitReview(client.slug);
          await wakeForPortal(client.slug, 'review-submitted');
          return json(200, { ok: true, count: out.count, summary: out.summary });
        }
        const item = await requestsStore.confirmRequest(client.slug, String(fields.id || ''), fields.answer, fields.note);
        await wakeForPortal(client.slug, 'request-confirmed', item.id);
        return json(200, { ok: true, item: { id: item.id } });
      } catch (err) {
        const known = !!err.user;
        if (!known) console.error('[portal] ' + fields.action + ': ' + err.message);
        return json(known ? 400 : 500, { ok: false, error: known ? err.message : 'That did not save. Try again in a moment.' });
      }
    }

    /* Your files and links. Same session gate as everything else. */
    if (fields.action === 'files-add' || fields.action === 'files-remove') {
      const sessionToken = readCookie(event.headers, name);
      if (!verifySessionToken(sessionToken, client.slug, passcode)) {
        return json(401, { ok: false, error: 'Your session expired. Open your portal link again.' });
      }
      try {
        const rec = await filesStore.getFiles(client.slug);
        if (!filesStore.isVisible(rec)) return json(404, { ok: false, error: 'Not found.' });
        if (fields.action === 'files-add') {
          const upload = fields.upload && typeof fields.upload === 'object' ? fields.upload : null;
          const item = await filesStore.addItem(client.slug, 'client', client.name, fields, upload);
          return json(200, { ok: true, item: { id: item.id, url: item.url } });
        }
        // A client removes only what they added. Mora's own items come off in the admin.
        await filesStore.removeItem(client.slug, String(fields.id || ''), false);
        return json(200, { ok: true });
      } catch (err) {
        const known = !!err.user;
        if (!known) console.error('[portal] ' + fields.action + ': ' + err.message);
        return json(known ? 400 : 500, { ok: false, error: known ? err.message : 'That did not save. Try again in a moment.' });
      }
    }

    const attempt = typeof fields.passcode === 'string' ? fields.passcode : '';
    await new Promise((r) => setTimeout(r, 350));

    if (!passcodes.checkPasscode(auth, attempt, safeEqual)) {
      return json(401, { ok: false, error: WRONG_PASSCODE_MESSAGE }, { 'Set-Cookie': clearCookie(name, secure) });
    }

    const cookie = buildCookie(name, makeSessionToken(client.slug, passcode), secure);
    return json(200, { ok: true }, { 'Set-Cookie': cookie });
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST' });
  }

  /* Magic link. A valid ?k= is exchanged for the normal session cookie and
     then bounced to the clean URL, so the credential does not sit in the
     address bar, the history, or any referrer header from that point on.
     The Location carries its own query because Netlify re-appends the original
     query (the token) to a bare path on a rewritten route, which loops. */
  const magic = (event.queryStringParameters && event.queryStringParameters.k) || '';
  /* Already signed in: serve the page as normal instead of redirecting again. */
  if (passcode && magic && !verifySessionToken(readCookie(event.headers, name), client.slug, passcode)) {
    if (verifyMagicToken(magic, client.slug, passcode)) {
      return {
        statusCode: 302,
        headers: Object.assign(
          { Location: '/portal/' + encodeURIComponent(client.slug) + '?signed-in=1', 'Set-Cookie': buildCookie(name, makeSessionToken(client.slug, passcode), secure) },
          NO_STORE
        ),
        body: '',
      };
    }
    // An expired or tampered link falls through to the lock screen with a
    // real explanation, rather than a silent redirect that reads as broken.
    return html(200, renderLockScreen(client, { error: 'That sign in link has expired. Use your passcode below, or ask Melody for a new link.' }));
  }

  const token = readCookie(event.headers, name);
  /* Melody, signed in to her admin, sees the page exactly as the client does,
     with her admin bar on top. Viewing only: every save still needs the
     client's own session. */
  const clientSession = !!passcode && verifySessionToken(token, client.slug, passcode);
  const adminView = !clientSession && method === 'GET' && isAdminRequest(event);
  const page = (h) => (adminView ? withAdminBar(h, client) : h);

  if (clientSession || adminView) {
    try {
      const fileId = getFileId(event);
      if (fileId) {
        if (fileId.indexOf(requestsStore.FILE_PREFIX) === 0) {
          const img = await requestsStore.getImage(client.slug, fileId);
          if (!img) return notFound();
          return {
            statusCode: 200,
            headers: Object.assign({
              'Content-Type': img.mimeType || 'application/octet-stream',
              'Content-Disposition': 'inline; filename="' + String(img.filename || 'screenshot').replace(/[^a-zA-Z0-9._ -]/g, '') + '"',
              'Content-Security-Policy': "default-src 'none'; sandbox",
            }, NO_STORE),
            body: img.buffer.toString('base64'),
            isBase64Encoded: true,
          };
        }
        if (fileId.indexOf(filesStore.FILE_PREFIX) === 0) {
          const up = await filesStore.getUpload(client.slug, fileId);
          if (!up) return notFound();
          const pdf = up.mimeType === 'application/pdf';
          return {
            statusCode: 200,
            headers: Object.assign({
              'Content-Type': up.mimeType || 'application/octet-stream',
              'Content-Disposition': 'inline; filename="' + String(up.filename || 'file').replace(/[^a-zA-Z0-9._ -]/g, '') + '"',
              // A PDF needs the browser's viewer, which a sandbox policy blocks. It is still served
              // with no scripts, no framing and no sniffing.
              'Content-Security-Policy': pdf ? "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" : "default-src 'none'; sandbox",
            }, NO_STORE),
            body: up.buffer.toString('base64'),
            isBase64Encoded: true,
          };
        }
        const file = await getFile(client.slug, fileId);
        if (!file) return notFound();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Content-Disposition': 'inline; filename="' + (file.filename || fileId) + '"',
            ...NO_STORE,
          },
          body: file.buffer.toString('base64'),
          isBase64Encoded: true,
        };
      }
      const state = await getClientState(client.slug);
      if (!state) {
        return html(200, '<!DOCTYPE html><meta charset="utf-8"><div style="font-family:sans-serif;padding:60px;text-align:center"><h1>Your portal is being set up</h1><p>Check back shortly, or contact melody@weareme.co.</p></div>');
      }
      const cardId = getCardId(event);
      if (cardId === REQUESTS_SEGMENT) {
        const rec = await requestsStore.getRequests(client.slug);
        if (!boardVisible(rec)) return notFound();
        const msg = (event.queryStringParameters && event.queryStringParameters.msg) || '';
        const boardRec = await clientSecrets.withSecretRows(client.slug, rec);
        const oneRaw = event.queryStringParameters && event.queryStringParameters.one;
        const one = /^\d{1,3}$/.test(String(oneRaw || '')) ? Number(oneRaw) : null;
        return html(200, page(renderRequestsPage(client, boardRec, { banner: BOARD_MESSAGES.indexOf(msg) !== -1 ? msg : '', one })));
      }
      if (cardId === FILES_SEGMENT) {
        const frec = await filesStore.getFiles(client.slug);
        if (!filesStore.isVisible(frec)) return notFound();
        const fmsg = (event.queryStringParameters && event.queryStringParameters.msg) || '';
        return html(200, page(renderFilesPage(client, frec, { banner: FILES_MESSAGES.indexOf(fmsg) !== -1 ? fmsg : '' })));
      }
      if (cardId === REVIEW_SEGMENT) {
        const rec = await requestsStore.getRequests(client.slug);
        if (!boardVisible(rec)) return notFound();
        return html(200, page(renderReviewPage(client, rec)));
      }
      if (cardId === BRIEF_SEGMENT) {
        // Stage 2. Only the sections Melody selected for this client
        // after their real call, never the whole bank. See discovery-bank.js.
        const resolved = resolveBrief(state);
        return html(
          200,
          renderBriefForm({
            variant: resolved.variant,
            meta: resolved.meta,
            sections: resolved.sections,
            slug: client.slug,
            note: resolved.note,
          })
        );
      }
      if (cardId) {
        const card = (state.cards || []).find((c) => c.id === cardId);
        if (!card) return notFound();
        if (isFormRequest(event)) {
          // A locked card, or one with no form, has no page to fill in.
          if (card.locked || !(card.form === true || /onboarding-questions/.test(card.id))) return notFound();
          // Answers already on the client's file, with the answers store layered on top.
          const stored = await answersStore.getCardAnswers(client.slug, cardId);
          const savedAnswers = Object.assign({}, ((state.onboardingAnswers || {})[cardId] || {}).answers, stored && stored.answers);
          // A card with formStyle "stepped" gets one question per screen.
          if (card.formStyle === 'stepped') return html(200, page(renderSteppedForm(client, card, savedAnswers)));
          return html(200, page(renderOnboardingForm(client, card, savedAnswers)));
        }
        if (getFormat(event) === 'docx') {
          const buffer = await generateDocx(client, card);
          const filename = card.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.docx';
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'Content-Disposition': 'attachment; filename="' + filename + '"',
              ...NO_STORE,
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true,
          };
        }
        return html(200, page(renderCardDetail(client, card)));
      }
      const requestsRec = await requestsStore.getRequests(client.slug).catch((err) => {
        console.error('[portal] requests read: ' + err.message);
        return null;
      });
      const dashRec = requestsRec ? await clientSecrets.withSecretRows(client.slug, requestsRec).catch(() => requestsRec) : requestsRec;
      const filesRec = await filesStore.getFiles(client.slug).catch((err) => {
        console.error('[portal] files read: ' + err.message);
        return null;
      });
      return html(200, page(renderDashboard(client, state, dashRec, filesRec)));
    } catch (err) {
      console.error('[portal] ' + err.message);
      return html(500, '<!DOCTYPE html><meta charset="utf-8"><p>Portal temporarily unavailable.</p>');
    }
  }

  return html(200, renderLockScreen(client), token ? { 'Set-Cookie': clearCookie(name, secure) } : {});
};
