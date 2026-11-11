/* ============================================================
   Me&Co.: client request board, presentation
   ------------------------------------------------------------
   Two pieces:

   renderRequestsSection(client, rec)  the "Requests" section on the
                                       dashboard, same project/accordion
                                       shell as every other section
   renderRequestsPage(client, rec)     the board itself, at
                                       /portal/<slug>/requests

   Built on theme.js, so it wears the same tokens as every other page.
   Content only: no branding file is touched.

   Everything the client or the team typed is escaped on the way out.
   Links are only emitted when they are http(s).
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('./theme.js');
const { isDecision, decisionControlsHtml, DECISION_CSS, decisionScript } = require('./decision-card.js');
const { counts, pagesFor, servicesFor, MAX_IMAGE_BYTES, MAX_IMAGES, PLATFORMS, NEWSLETTER_FEATURES, DECK_AUDIENCES } = require('./requests-store.js');

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u) {
  return typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] : '';
}

function isVisible(rec) {
  return !!rec && rec.visible !== false;
}

/* ---------- dashboard section ---------- */

function renderRequestsSection(client, rec, index) {
  if (!isVisible(rec)) return '';
  const c = counts(rec);
  const open = c.needs + c.received + c.in_progress;
  const total = (rec.items || []).length;
  let pill;
  let summary;
  if (c.needs) {
    pill = '<span class="pill pill-needs">Needs you</span>';
    summary = c.needs + (c.needs === 1 ? ' question for you' : ' questions for you');
  } else if (open) {
    pill = '<span class="pill pill-in_progress">' + open + ' open</span>';
    summary = open + ' open &middot; ' + c.done + ' done';
  } else if (total) {
    pill = '<span class="pill pill-complete">All done</span>';
    summary = c.done + ' done';
  } else {
    pill = '<span class="pill pill-not_started">None yet</span>';
    summary = 'Nothing asked for yet';
  }
  const href = '/portal/' + encodeURIComponent(client.slug) + '/requests';
  const lead = total
    ? 'Everything you have asked us for, where it stands, and a place to ask for more.'
    : 'Ask for a change to your page or site here, and watch it move from Received to Done.';
  return `
      <section class="project${c.needs ? ' project-needs' : ''}" data-index="${index}" id="requests-section">
        <button class="project-head" type="button" aria-expanded="false">
          <span class="project-head-main">
            <span class="project-name">Requests</span>
            <span class="project-summary">${summary}</span>
          </span>
          ${pill}
          <span class="chev" aria-hidden="true">&#9662;</span>
        </button>
        <div class="project-body" hidden>
          <div class="card-acc">
            <div class="card-acc-body" style="display:block;padding-top:1rem">
              <div class="row-desc"><p>${esc(lead)}</p></div>
              <a class="btn btn-primary btn-block" href="${href}">Open your request board</a>
              ${total ? `<a class="btn btn-quiet btn-block" href="${href}-review">Go through them one by one</a>` : ''}
            </div>
          </div>
        </div>
      </section>`;
}

/* ---------- board page ---------- */

const COLUMNS = [
  { key: 'needs', title: 'Needs your answer', cls: 'col-needs' },
  { key: 'received', title: 'Received', cls: 'col-received' },
  { key: 'in_progress', title: 'In progress', cls: 'col-progress' },
  { key: 'done', title: 'Done', cls: 'col-done' },
];

/* The "Connect your Airtable" row. The page only ever knows the date it
   was saved and the last 4 characters; the token itself is never read back. */
function secretFormHtml(item) {
  return `<div class="needs-box secret-box" data-secret-box="${esc(item.secret)}">
      <label for="sec-${esc(item.secret)}">Your Airtable token</label>
      <div class="secret-line">
        <input id="sec-${esc(item.secret)}" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="300" data-secret-input placeholder="Paste it here">
        <button class="mini" type="button" data-secret-show aria-pressed="false">Show</button>
      </div>
      <label for="secb-${esc(item.secret)}">Link or name of your Cultural Harvest base (optional)</label>
      <input id="secb-${esc(item.secret)}" type="text" autocomplete="off" maxlength="300" data-secret-base placeholder="Paste the link, or just the name">
      <div class="err" role="alert" hidden></div>
      <button class="mini mini-yes" type="button" data-secret-save="${esc(item.secret)}">Save</button>
    </div>`;
}

function secretRowHtml(item) {
  const meta = item.secretMeta;
  let body;
  if (meta) {
    body = `<p class="note">Received, thank you. Saved on ${esc(shortDate(meta.savedAt))}, token ending in ${esc(meta.last4)}.</p>
      <details class="words"><summary>Send a different token</summary>${secretFormHtml(item)}</details>`;
  } else {
    body = `<p class="note">This lets us work in your Airtable for you. It takes about two minutes, and you only do it once.</p>
      <ol class="secret-steps">
        <li>Go to <a href="https://airtable.com/create/tokens" target="_blank" rel="noopener noreferrer">airtable.com/create/tokens</a> and choose Create token.</li>
        <li>Name it CHC.</li>
        <li>Under Scopes, add data.records:read, data.records:write and schema.bases:read.</li>
        <li>Under Access, add your Cultural Harvest base.</li>
        <li>Choose Create token, copy it, and paste it below.</li>
      </ol>
      <p class="note">Only Me&Co. can use it, and it is never shown on this page again.</p>
      ${secretFormHtml(item)}`;
  }
  return `<li class="req ${esc(item.status)}" data-page="${esc(item.page || 'Whole site')}" data-id="${esc(item.id)}">
      <p class="req-page">${esc(item.page || 'Whole site')}</p>
      <p class="req-t">${esc(item.title)}</p>
      ${body}
      <p class="meta"><span>${esc(item.from || '')}</span><span>${esc(shortDate(item.date))}</span></p>
    </li>`;
}

/* ---------- emails on a board ----------
   A row can carry an email (item.email: sender, pick, options with
   subject, preview, body, and build notes) and two plain lines
   (item.explain: what it is, where it shows up). The body is the source
   document's light markdown: **bold**, a line of only **[Label]** is the
   button, blank lines split paragraphs. Everything is escaped first. */
function mdLite(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
  return blocks.map((b) => {
    const t = b.trim();
    if (!t) return '';
    const cta = t.match(/^\*\*\[(.+?)\]\*\*$/);
    if (cta) return `<p class="em-cta"><span>${esc(cta[1])}</span></p>`;
    const html = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/ {2,}\n|\n/g, '<br>');
    return `<p>${html}</p>`;
  }).join('');
}
function emailHtml(item) {
  const e = item.email;
  if (!e || !Array.isArray(e.options) || !e.options.length) return '';
  const opts = e.options.map((o) => `
      <section class="em" aria-label="Option ${esc(o.letter)}">
        <div class="em-env">
          <p class="em-opt">Option ${esc(o.letter)}${o.name ? ' · ' + esc(o.name) : ''}${o.letter === e.pick ? ' <span class="em-pick">Our pick</span>' : ''}</p>
          <p><b>From</b> ${esc(e.sender || 'Me&Co.')}</p>
          <p><b>Subject</b> ${esc(o.subject || '')}</p>
          ${o.preview ? `<p class="em-pre">${esc(o.preview)}</p>` : ''}
        </div>
        <div class="em-paper"><div class="em-mark"><i></i>Me&amp;Co.</div>${mdLite(o.body)}</div>
      </section>`).join('');
  const notes = (e.build_notes || []).length
    ? `<details class="em-notes"><summary>Before this can send</summary>${e.build_notes.map((n) => `<p>${esc(n)}</p>`).join('')}</details>`
    : '';
  return `<div class="em-wrap">${opts}</div>${notes}`;
}
function explainHtml(item) {
  const x = item.explain;
  if (!x) return '';
  return `<div class="em-explain">
      ${x.what_it_is ? `<p><b>What it is</b> ${esc(x.what_it_is)}</p>` : ''}
      ${x.where_it_shows_up ? `<p><b>Where it shows up</b> ${esc(x.where_it_shows_up)}</p>` : ''}
    </div>`;
}
function journeyHtml(rec, slug) {
  if (!Array.isArray(rec.journey) || !rec.journey.length) return '';
  const byTitle = {};
  (rec.items || []).forEach((it) => { byTitle[it.title] = it; });
  const needOrder = (rec.items || []).filter((i) => i.status === 'needs');
  const dot = (title, kind) => {
    const it = byTitle[title];
    if (!it) return '';
    const state = it.status === 'needs' ? 'open' : 'answered';
    const k = needOrder.indexOf(it);
    const href = '/portal/' + encodeURIComponent(slug) + '/requests' + (k >= 0 ? '?one=' + k : '');
    return `<a class="jdot ${kind} ${state}" href="${href}" title="${esc(title)}"><span class="sr">${esc(title)}</span></a>`;
  };
  const stages = rec.journey.map((st) => {
    const ch = (st.choose || []).map((t) => dot(t, 'choose')).join('');
    const wr = (st.write || []).map((t) => dot(t, 'write')).join('');
    if (!ch && !wr) return '';
    return `<div class="jstage"><p class="jname">${esc(st.stage)}</p><div class="jdots">${ch}${wr}</div></div>`;
  }).join('');
  return `<div class="panel journey"><h2>The founder's email journey</h2>
    <div class="jmap">${stages}</div>
    <p class="foot">Filled dots have copy to choose from. Hollow dots need writing. A dot turns lime once you have answered it. Tap any dot to open that email.</p></div>`;
}

function rowHtml(item, slug, pageLinks) {
  if (item.secret) return secretRowHtml(item);
  const done = item.status === 'done';
  const confirmed = !!(item.confirm && item.confirm.state === 'yes');
  const reopened = !!(item.confirm && item.confirm.state === 'not_yet' && item.status !== 'done');
  const live = safeUrl(item.liveUrl);
  const link = safeUrl(item.link);
  const img = item.image && /^rq-[a-f0-9]{24}$/.test(item.image.fileId || '')
    ? '/portal/' + encodeURIComponent(slug) + '/file/' + item.image.fileId
    : null;
  const quote = item.quote && item.quote !== item.title
    ? `<details class="words"><summary>Your words</summary><p>${esc(item.quote)}</p></details>`
    : '';
  const imgs = (Array.isArray(item.images) ? item.images : [])
    .filter((x) => x && /^rq-[a-f0-9]{24}$/.test(x.fileId || ''))
    .map((x) => '/portal/' + encodeURIComponent(slug) + '/file/' + x.fileId);
  const seeIt = safeUrl(item.seeUrl);
  const details = (Array.isArray(item.details) ? item.details : [])
    .map((d) => `<p class="note"><b>${esc(d[0])}:</b> ${esc(d[1])}</p>`).join('');
  const words = item.words
    ? `<details class="words"><summary>What you want it to say</summary><p>${esc(item.words)}</p></details>`
    : '';
  const answered = item.decision && item.decision.choice
    ? `<p class="note"><b>You decided:</b> ${esc(item.decision.note ? item.decision.choice + '. ' + item.decision.note : item.decision.choice)}</p>`
    : item.answer && item.answer.text
      ? `<p class="note">Your answer: ${esc(item.answer.text)}</p>`
      : '';
  let needsControls = '';
  if (isDecision(item)) {
    needsControls = decisionControlsHtml(item);
  } else if (item.status === 'needs' && item.ask === 'answer') {
    needsControls = `<div class="needs-box" data-needs="${esc(item.id)}">
      <label>Your answer</label><textarea maxlength="4000" placeholder="Type your answer here"></textarea>
      <div class="err" hidden></div>
      <button class="mini mini-yes" type="button" data-answer="${esc(item.id)}">Send my answer</button></div>`;
  } else if (item.status === 'needs' && item.ask === 'approve' && seeIt) {
    needsControls = `<div class="needs-box" data-needs="${esc(item.id)}">
      <p class="ask">Is this right?</p>
      <div class="confirm-btns">
        <button class="mini mini-yes" type="button" data-approve="${esc(item.id)}">Yes, approve</button>
        <button class="mini" type="button" data-needs-notyet="${esc(item.id)}">Not yet</button>
      </div></div>`;
  }
  let confirm = '';
  if (done && confirmed) {
    confirm = `<p class="confirmed">You confirmed this is right.</p>
      <button class="mini" type="button" data-notyet="${esc(item.id)}">Actually, not yet</button>`;
  } else if (done) {
    confirm = `<div class="confirm" data-confirm-for="${esc(item.id)}">
      <p class="ask">Is this right?</p>
      <div class="confirm-btns">
        <button class="mini mini-yes" type="button" data-yes="${esc(item.id)}">Yes, this is right</button>
        <button class="mini" type="button" data-notyet="${esc(item.id)}">Not yet</button>
      </div></div>`;
  }
  const siteLink = safeUrl(pageLinks && pageLinks[item.page || 'Whole site']);
  const reviewNote = item.review && item.review.state === 'change' && !reopened && item.review.note
    ? `<p class="reopened">You asked for a change: ${esc(item.review.note)}</p>`
    : '';
  const reopenedNote = reopened
    ? `<p class="reopened">You told us this is not right yet: ${esc(item.confirm.note || '')}</p>`
    : '';
  return `<li class="req ${esc(item.status)}" data-page="${esc(item.page || 'Whole site')}" data-id="${esc(item.id)}" data-dc-title="${esc(item.title)}">
      <p class="req-page">${esc(item.page || 'Whole site')}</p>
      <p class="req-t">${esc(item.title)}</p>
      ${explainHtml(item)}
      ${emailHtml(item)}
      ${quote}
      ${item.note ? `<p class="note">${esc(item.note)}</p>` : ''}
      ${reopenedNote}
      ${reviewNote}
      ${item.email || item.explain ? (details ? `<details class="em-about"><summary>About this email</summary>${details}</details>` : '') : details}
      ${words}
      ${answered}
      ${imgs.map((u) => `<a class="shot" href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="Image you sent" loading="lazy"></a>`).join('')}
      ${seeIt ? `<p class="note"><a href="${esc(seeIt)}" target="_blank" rel="noopener">See it</a></p>` : ''}
      ${img ? `<a class="shot" href="${img}" target="_blank" rel="noopener"><img src="${img}" alt="Your screenshot" loading="lazy"></a>` : ''}
      ${link ? `<p class="note"><a href="${esc(link)}" target="_blank" rel="noopener">Your link</a></p>` : ''}
      ${siteLink ? `<p class="note"><a href="${esc(siteLink)}" target="_blank" rel="noopener">See this page on the site preview</a></p>` : ''}
      ${done && live ? `<p class="note"><a href="${esc(live)}" target="_blank" rel="noopener">See it live</a></p>` : ''}
      ${confirm}
      ${needsControls}
      <p class="meta"><span>${esc(item.from || '')}</span><span>${esc(shortDate(item.date))}</span></p>
    </li>`;
}

function renderRequestsPage(client, rec, opts) {
  const slug = client.slug;
  const oneIdx = opts && Number.isInteger(opts.one) ? opts.one : null;
  const needsList = (rec.items || []).filter((i) => i.status === 'needs');
  let oneHtml = '';
  if (oneIdx !== null && rec.journey) {
    const base = '/portal/' + encodeURIComponent(slug) + '/requests';
    if (!needsList.length) {
      oneHtml = `<div class="panel one"><h2>All answered</h2><p class="foot">Every email has your answer. Thank you.</p><p><a class="back" href="${base}">See them all</a></p></div>`;
    } else {
      const k = Math.min(Math.max(oneIdx, 0), needsList.length - 1);
      const it = needsList[k];
      oneHtml = `<div class="panel one">
        <p class="one-step">${k + 1} of ${needsList.length} waiting on you</p>
        <div class="one-bar"><i style="width:${Math.round(((k + 1) / needsList.length) * 100)}%"></i></div>
        <ul class="one-card">${rowHtml(it, slug, rec.pageLinks)}</ul>
        <div class="one-nav">${k > 0 ? `<a class="back" href="${base}?one=${k - 1}">&larr; Back</a>` : '<span></span>'}<a class="back" href="${base}">See them all</a>${k < needsList.length - 1 ? `<a class="back" href="${base}?one=${k + 1}">Next &rarr;</a>` : '<span></span>'}</div>
      </div>`;
    }
  }
  const items = (rec.items || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const c = counts(rec);
  const allPages = pagesFor(rec).concat(items.map((i) => i.page || 'Whole site'));
  const pagesPresent = allPages.filter((p, k) => allPages.indexOf(p) === k && items.some((i) => (i.page || 'Whole site') === p));
  const chips = ['All'].concat(pagesPresent).map((p) => {
    const n = p === 'All' ? items.length : items.filter((i) => (i.page || 'Whole site') === p).length;
    return `<button type="button" class="chip" data-filter="${esc(p)}" aria-pressed="${p === 'All' ? 'true' : 'false'}">${esc(p)} <span>${n}</span></button>`;
  }).join('');
  const cols = COLUMNS.map((col) => {
    const rows = items.filter((i) => i.status === col.key);
    if (col.key === 'needs' && !rows.length) return '';
    return `<details class="col ${col.cls}" ${col.key === 'done' ? 'data-done' : 'open'}>
      <summary><span class="dot"></span><span class="col-title">${col.title}</span><span class="count" data-count="${col.key}">${rows.length}</span></summary>
      <ul>${rows.map((i) => rowHtml(i, slug, rec.pageLinks)).join('') || '<li class="empty">Nothing here right now.</li>'}</ul>
    </details>`;
  }).join('');
  const STATUS_LABEL = { needs: 'Needs your answer', received: 'Received', in_progress: 'In progress', done: 'Done' };
  const inOrder = (rec.items || []).map((it, k) => [it, k]).sort((a, b) => String(a[0].date || '').localeCompare(String(b[0].date || '')) || a[1] - b[1]).map((x) => x[0]);
  const listRow = (i, k) => {
    const href = (i.status === 'done' && safeUrl(i.liveUrl)) || safeUrl(i.seeUrl) || safeUrl(i.liveUrl) || safeUrl(rec.pageLinks && rec.pageLinks[i.page || 'Whole site']);
    return `<li class="lrow" data-page="${esc(i.page || 'Whole site')}" data-open="${esc(i.id)}" tabindex="0" role="button" aria-label="Open ${esc(i.title || 'this request')}">
      <span class="l-n">${k + 1}</span>
      <span class="l-date">${esc(shortDate(i.date))}${i.from ? `<span class="l-from">${esc(i.from)}</span>` : ''}</span>
      <p class="l-t"><span class="l-page">${esc(i.page || 'Whole site')}</span>${esc(i.title)}</p>
      <span class="pill ${esc(i.status)}">${esc(STATUS_LABEL[i.status] || i.status)}</span>
      <span class="l-link">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">See it</a>` : ''}</span>
    </li>`;
  };
  const numbered = inOrder.map((i, k) => [i, k]);
  const openRows = numbered.filter(([i]) => i.status !== 'done').map(([i, k]) => listRow(i, k)).join('');
  const doneList = numbered.filter(([i]) => i.status === 'done');
  const listRows = (openRows ? `<ol class="list" aria-label="Open requests, in the order they came in">${openRows}</ol>` : '')
    + (doneList.length ? `<details class="done-acc"><summary><span>Completed</span><span class="done-n">${doneList.length}</span><span class="chev" aria-hidden="true">&#9662;</span></summary><ol class="list" aria-label="Completed requests">${doneList.map(([i, k]) => listRow(i, k)).join('')}</ol></details>` : '');
  const services = servicesFor(rec);
  const SVC_LABEL = { social: 'Social media', website: 'Website', newsletter: 'Newsletter', deck: 'Pitch deck', custom: 'Custom request' };
  const noteBoard = !!rec.journey;
  const serviceButtons = noteBoard
    ? `<div class="panel" id="what">
    <h2>Add a note</h2>
    <p class="foot" style="margin:0 0 0.7rem">Anything about the emails as a whole: the voice, timing, something missing. It lands on this board and reaches the team.</p>
    <div class="svc-row" role="group" aria-label="Add a note"><button type="button" class="svc-btn" data-open-service="custom">Add a note</button></div>
  </div>`
    : `<div class="panel" id="what">
    <h2>What do you need?</h2>
    <div class="svc-row" role="group" aria-label="Choose what you need">${services.map((sv) => `<button type="button" class="svc-btn" data-open-service="${sv}">${SVC_LABEL[sv]}</button>`).join('')}</div>
  </div>`;
  const imgField = `<div><label>Images (optional)</label>
        <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple data-images>
        <p class="hint">Up to ${MAX_IMAGES} images, PNG, JPG, WebP or GIF. Big photos are shrunk before they are sent.</p>
        <p class="hint" data-img-list></p></div>`;
  const FORMS = {
    social: { title: 'Request a social media post', send: 'Send post request', body: `
      <fieldset class="plats"><legend>Where should it go?</legend>
        ${PLATFORMS.map((x) => `<label class="check"><input type="checkbox" name="platforms" value="${esc(x)}"> ${esc(x)}</label>`).join('')}
      </fieldset>
      <div><label for="social-topic">What is it about?</label>
        <textarea id="social-topic" name="topic" maxlength="400" placeholder="Our next market day, and the new vendors joining"></textarea></div>
      <div><label for="social-date">Date it should go out</label><input id="social-date" name="goesOut" type="date"></div>
      <div><label for="social-words">The words you want (optional)</label>
        <textarea id="social-words" name="words" maxlength="3000" placeholder="Write it exactly how you want it said, or leave this blank and we will draft it"></textarea></div>
      ${imgField}` },
    website: { title: 'Ask for a change to your website', send: 'Send request', body: `
      <div><label for="web-page">Which page</label>
        <select id="web-page" name="page"><option value="">Choose a page</option>${pagesFor(rec).filter((x) => x !== 'Social media').map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
      <div><label for="web-section">Which section (optional)</label>
        <input id="web-section" name="section" maxlength="200" placeholder="The photo at the top, the events list"></div>
      <div><label for="web-what">What should we change or add?</label>
        <textarea id="web-what" name="what" maxlength="2000" placeholder="Make the photo smaller"></textarea></div>
      <div><label for="web-link">Link (optional)</label>
        <input id="web-link" name="link" type="url" inputmode="url" placeholder="Paste a link"></div>
      ${imgField}` },
    newsletter: { title: 'Plan a newsletter', send: 'Send newsletter request', body: `
      <div><label for="nl-issue">Which issue or date</label>
        <input id="nl-issue" name="issue" maxlength="120" placeholder="December issue, or 15 December"></div>
      <fieldset class="plats"><legend>What should it feature?</legend>
        ${NEWSLETTER_FEATURES.map((x) => `<label class="check"><input type="checkbox" name="features" value="${esc(x)}"> ${esc(x)}</label>`).join('')}
      </fieldset>
      <div><label for="nl-words">The words you want (optional)</label>
        <textarea id="nl-words" name="words" maxlength="3000" placeholder="Anything you already know you want to say"></textarea></div>
      ${imgField}` },
    deck: { title: 'Plan a pitch deck', send: 'Send deck request', body: `
      <div><label for="dk-what">What is it for?</label>
        <textarea id="dk-what" name="what" maxlength="2000" placeholder="A funder meeting in January"></textarea></div>
      <div><label for="dk-aud">Who is it going to?</label>
        <select id="dk-aud" name="audience"><option value="">Choose one</option>${DECK_AUDIENCES.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
      <div><label for="dk-by">Deadline (optional)</label><input id="dk-by" name="needBy" type="date"></div>
      <div><label for="dk-words">What should it include? (optional)</label>
        <textarea id="dk-words" name="words" maxlength="3000" placeholder="Numbers, stories, photos, anything you already know"></textarea></div>
      ${imgField}` },
    custom: { title: noteBoard ? 'Add a note' : 'Custom request', send: noteBoard ? 'Save note' : 'Send request', body: `
      <div><label for="cu-what">${noteBoard ? 'Your note' : 'What do you need?'}</label>
        <textarea id="cu-what" name="what" maxlength="2000" placeholder="Tell us in your own words"></textarea></div>
      <div><label for="cu-by">Needed by (optional)</label><input id="cu-by" name="needBy" type="date"></div>
      ${imgField}` },
  };
  const dialogs = services.map((sv) => `<dialog class="svc" id="dlg-${sv}" aria-labelledby="dlg-${sv}-h">
    <div class="svc-head"><h2 id="dlg-${sv}-h">${FORMS[sv].title}</h2><button type="button" class="svc-x" data-close aria-label="Close">&times;</button></div>
    <form class="svc-form" data-service="${sv}" novalidate>
      ${FORMS[sv].body}
      <div class="err" role="alert" hidden></div>
      <div class="svc-actions"><button type="button" class="mini" data-close>Cancel</button><button class="primary-btn" type="submit">${FORMS[sv].send}</button></div>
    </form>
  </dialog>`).join('');
  const banner = opts && opts.banner ? `<div class="banner-msg" role="status">${esc(opts.banner)}</div>` : '';
  const score = [
    c.needs ? `<span class="s-need">${c.needs} for you</span>` : '',
    `<span class="s-rec">${c.received} received</span>`,
    `<span class="s-prog">${c.in_progress} in progress</span>`,
    `<span class="s-done">${c.done} done</span>`,
  ].join('');
  const pageOptions = pagesFor(rec).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const boot = JSON.stringify({ slug, clientName: client.name || '', maxBytes: MAX_IMAGE_BYTES, maxImages: MAX_IMAGES }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Your requests &middot; ${esc(client.name)} &middot; Me&Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
  header { background: var(--white); border-bottom: var(--rule-strong); padding: clamp(1.1rem, 4vw, 1.8rem) clamp(1.1rem, 5vw, 2.2rem) clamp(1.2rem, 4vw, 1.6rem); }
  .header-inner { max-width: 72rem; margin: 0 auto; }
  .back { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 44px; font-family: var(--display); font-size: 0.95rem; font-weight: 700; color: var(--oxford); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  h1 { font-weight: 800; font-size: clamp(1.45rem, 5.5vw, 1.95rem); margin: 0.4rem 0 0; letter-spacing: -0.015em; line-height: 1.15; }
  .lede { color: var(--ink-soft); margin: 0.5rem 0 0; max-width: 40rem; font-size: 0.95rem; }
  main { max-width: 72rem; margin: 0 auto; padding: clamp(1.2rem, 4vw, 2rem) clamp(1.1rem, 5vw, 2.2rem) 4rem; }
  .panel { background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard); padding: clamp(1.1rem, 5vw, 1.8rem); margin-bottom: 1.5rem; }
  .panel h2 { margin: 0; font-size: clamp(1.15rem, 4.5vw, 1.4rem); }
  .intro { background: var(--lime); border: var(--rule); border-radius: var(--radius); padding: 1rem 1.2rem; margin-bottom: 1.5rem; font-size: 1rem; color: var(--oxford); }
  .intro p { margin: 0; }
  .intro .sig { font-family: var(--display); font-weight: 700; margin-top: 0.4rem; }
  .banner-msg { background: var(--green-bg); border: 1.5px solid var(--green); color: var(--green); border-radius: var(--radius-sm); padding: 0.8rem 1rem; margin-bottom: 1.2rem; font-weight: 500; }
  .score { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.9rem; }
  .score span { font-family: var(--mono); font-size: 0.78rem; font-weight: 700; padding: 0.35rem 0.7rem; border-radius: 6px; border: 1.5px solid var(--oxford); background: var(--paper); }
  .score .s-need { background: var(--lavender); }
  .score .s-prog { background: var(--lime); }
  .score .s-done { background: var(--green-bg); color: var(--green); border-color: var(--green); }
  .chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0 1.2rem; }
  .chip { font-family: var(--display); font-weight: 700; font-size: 0.85rem; min-height: 44px; padding: 0.4rem 0.9rem; border-radius: var(--radius-btn); border: var(--rule); background: var(--white); color: var(--oxford); cursor: pointer; }
  .chip span { font-family: var(--mono); font-size: 0.72rem; margin-left: 0.25rem; opacity: 0.7; }
  .chip[aria-pressed="true"] { background: var(--oxford); color: var(--white); }
  .board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; align-items: start; }
  .col { background: var(--panel); border: 0; border-radius: 12px; padding: 0.6rem 0.6rem 0.8rem; min-width: 0; }
  .col summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; min-height: 44px; }
  .col summary::-webkit-details-marker { display: none; }
  .col-title { font-family: var(--display); font-weight: 700; font-size: 1rem; color: var(--oxford); }
  .dot { width: 11px; height: 11px; border-radius: 50%; flex: none; border: 1.5px solid var(--oxford); background: var(--panel-2); }
  .col-needs .dot { background: var(--lavender); } .col-progress .dot { background: var(--lime); } .col-done .dot { background: var(--green); border-color: var(--green); }
  .count { margin-left: auto; font-family: var(--mono); font-size: 0.78rem; font-weight: 700; }
  .col ul { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; gap: 0.6rem; }
  .req { background: var(--white); border: 0; border-radius: 8px; padding: 0.7rem 0.8rem; min-width: 0; box-shadow: 0 1px 1px rgba(34,49,94, 0.18), 0 0 1px rgba(34,49,94, 0.2); }
  .list-top { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .list-top .views { margin-bottom: 0; }
  .add-btn { font-family: var(--display); font-weight: 700; font-size: 0.9rem; min-height: 44px; padding: 0.4rem 1.1rem; border-radius: var(--radius-btn); border: var(--rule); background: var(--lime); color: var(--oxford); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
  .views { display: inline-flex; gap: 0.4rem; margin-bottom: 1rem; }
  .lrow[data-open] { cursor: pointer; }
  .em-explain { display: grid; gap: 0.25rem; margin: 0.4rem 0 0.6rem; }
  .em-explain p { margin: 0; font-size: 0.92rem; color: var(--ink-soft); }
  .em-explain b { color: var(--oxford); }
  .em-wrap { display: grid; gap: 0.8rem; margin: 0.6rem 0; }
  @media (min-width: 900px) { .one .em-wrap { grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); } }
  .em { border: var(--rule); border-radius: var(--radius-sm); overflow: hidden; background: var(--white); min-width: 0; }
  .em-env { padding: 0.7rem 0.85rem; border-bottom: var(--rule-soft); display: grid; gap: 0.15rem; font-size: 0.86rem; color: var(--ink-soft); }
  .em-env p { margin: 0; overflow-wrap: anywhere; }
  .em-env b { color: var(--oxford); }
  .em-opt { font-family: var(--mono); font-size: 0.72rem !important; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oxford) !important; font-weight: 700; }
  .em-pick { background: var(--blue); color: var(--white); border-radius: var(--radius-pill); padding: 0.05rem 0.4rem; margin-left: 0.3rem; }
  .em-pre { color: var(--ink-faint); }
  .em-paper { background: #FFFCF5; color: #22315E; padding: 1rem 1rem 1.1rem; font-size: 0.95rem; line-height: 1.6; overflow-wrap: anywhere; }
  .em-paper p { margin: 0 0 0.7rem; }
  .em-mark { display: flex; align-items: center; gap: 0.4rem; font-weight: 800; letter-spacing: 0.06em; margin-bottom: 0.7rem; }
  .em-mark i { width: 14px; height: 14px; border-radius: 50%; background: #E4572E; display: inline-block; }
  .em-cta span { display: inline-block; background: #E4572E; color: #22315E; font-weight: 700; padding: 0.55rem 0.9rem; border-radius: 10px; }
  .em-notes, .em-about { font-size: 0.86rem; color: var(--ink-soft); margin: 0.2rem 0 0.6rem; }
  .em-notes summary, .em-about summary { cursor: pointer; font-weight: 700; color: var(--oxford); }
  .em-notes p { margin: 0.4rem 0 0; }
  .journey .jmap { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 0.8rem 0; }
  .jstage { flex: 1 1 140px; min-width: 0; border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.6rem 0.7rem; background: var(--paper); }
  .jname { margin: 0 0 0.4rem; font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oxford); }
  .jdots { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .jdot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--oxford); display: inline-block; }
  .jdot.choose.open { background: var(--blue); border-color: var(--blue); }
  .jdot.write.open { background: var(--white); border-color: var(--blue); }
  .jdot.answered { background: var(--lime); border-color: var(--oxford); }
  .jdot:focus-visible { outline: 3px solid var(--oxford); outline-offset: 2px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .one-step { margin: 0; font-family: var(--mono); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oxford); }
  .one-bar { height: 6px; background: var(--panel); border-radius: 99px; overflow: hidden; margin: 0.5rem 0 0.8rem; }
  .one-bar i { display: block; height: 100%; background: var(--oxford); }
  .one-card { list-style: none; margin: 0; padding: 0; }
  .one-nav { display: flex; justify-content: space-between; gap: 0.6rem; margin-top: 0.8rem; flex-wrap: wrap; }
  .view-btn { font-family: var(--display); font-weight: 700; font-size: 0.85rem; min-height: 44px; padding: 0.4rem 1.1rem; border-radius: var(--radius-btn); border: var(--rule); background: var(--white); color: var(--oxford); cursor: pointer; }
  .view-btn[aria-pressed="true"] { background: var(--oxford); color: var(--white); }
  #list { display: grid; gap: 0.8rem; }
  #list[hidden] { display: none; }
  .done-acc { border-radius: var(--radius-sm); background: var(--panel); }
  .done-acc > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; min-height: 48px; padding: 0.4rem 1rem; font-family: var(--display); font-weight: 700; color: var(--oxford); }
  .done-acc > summary::-webkit-details-marker { display: none; }
  .done-acc .done-n { font-family: var(--mono); font-size: 0.78rem; background: var(--green-bg); color: var(--green); border-radius: 6px; padding: 0.15rem 0.5rem; }
  .done-acc .chev { margin-left: auto; transition: transform 0.2s; }
  .done-acc[open] .chev { transform: rotate(180deg); }
  .done-acc .list { margin: 0 0.5rem 0.5rem; }
  .list { list-style: none; margin: 0; padding: 0; border: var(--rule-soft); border-radius: var(--radius-sm); background: var(--white); }
  .list[hidden], .board[hidden], .foot[hidden] { display: none; }
  .lrow { display: grid; grid-template-columns: 2.2rem 7.5rem minmax(0, 1fr) 9.5rem 4.5rem; gap: 0.4rem 0.9rem; align-items: center; padding: 0.75rem 0.9rem; border-top: var(--rule-soft); }
  .lrow:first-child { border-top: 0; }
  .lrow[hidden] { display: none; }
  .l-n, .l-date { font-family: var(--mono); font-size: 0.74rem; color: var(--ink-faint); }
  .l-from { display: block; font-family: var(--sans); font-size: 0.78rem; color: var(--ink-soft); margin-top: 0.15rem; }
  .l-t { margin: 0; font-size: 0.94rem; line-height: 1.4; min-width: 0; }
  .l-page { display: block; font-family: var(--mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-faint); }
  .pill { justify-self: start; font-family: var(--mono); font-size: 0.72rem; font-weight: 700; padding: 0.3rem 0.6rem; border-radius: 6px; border: 1.5px solid var(--oxford); background: var(--paper); white-space: nowrap; }
  .pill.needs { background: var(--lavender); } .pill.in_progress { background: var(--lime); }
  .pill.done { background: var(--green-bg); color: var(--green); border-color: var(--green); }
  .l-link a { font-weight: 700; color: var(--oxford); }
  @media (max-width: 700px) {
    .lrow { grid-template-columns: 2rem minmax(0, 1fr) auto; }
    .l-date { grid-column: 2; grid-row: 1; }
    .l-t { grid-column: 2 / 4; grid-row: 2; }
    .pill { grid-column: 3; grid-row: 1; justify-self: end; }
    .l-link { grid-column: 2 / 4; grid-row: 3; }
  }
  .req[hidden] { display: none; }
  .req-page { margin: 0; font-family: var(--mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-faint); }
  .req-t { margin: 0.15rem 0 0; font-size: 0.94rem; line-height: 1.45; }
  .note { margin: 0.35rem 0 0; font-size: 0.84rem; color: var(--ink-soft); }
  .reopened { margin: 0.35rem 0 0; font-size: 0.84rem; color: var(--oxford); background: var(--lavender); border-radius: 8px; padding: 0.4rem 0.6rem; }
  .words { margin-top: 0.35rem; font-size: 0.84rem; color: var(--ink-soft); }
  .words summary { cursor: pointer; font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; min-height: 32px; display: flex; align-items: center; }
  .words p { margin: 0.2rem 0 0; font-style: italic; }
  .shot img { display: block; max-width: 100%; max-height: 7rem; border-radius: 8px; border: var(--rule-soft); margin-top: 0.4rem; }
  .meta { display: flex; justify-content: space-between; gap: 0.5rem; margin: 0.5rem 0 0; font-family: var(--mono); font-size: 0.68rem; color: var(--ink-faint); }
  .empty { color: var(--ink-faint); font-size: 0.88rem; padding: 0.4rem 0.2rem; }
  .ask, .confirmed { margin: 0.5rem 0 0.3rem; font-size: 0.86rem; font-weight: 500; }
  .confirmed { color: var(--green); }
  .confirm-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .mini { font-family: var(--display); font-weight: 700; font-size: 0.85rem; min-height: 44px; padding: 0.4rem 0.9rem; border-radius: var(--radius-btn); border: var(--rule); background: var(--white); color: var(--oxford); cursor: pointer; }
  .mini-yes { background: var(--green-bg); border-color: var(--green); color: var(--green); }
  .notyet-box { margin-top: 0.5rem; display: grid; gap: 0.5rem; }
  form { display: grid; gap: 0.9rem; margin-top: 1rem; }
  label { font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; display: block; margin-bottom: 0.3rem; }
  input, textarea, select { font: inherit; font-size: 16px; color: var(--ink); background: var(--paper); border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.7rem 0.8rem; width: 100%; }
  input:focus, textarea:focus, select:focus { border-color: var(--oxford); background: var(--white); outline: none; }
  textarea { min-height: 6rem; resize: vertical; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  .hint { font-size: 0.82rem; color: var(--ink-soft); margin: 0.3rem 0 0; }
  .primary-btn { font-family: var(--display); font-weight: 700; font-size: 0.95rem; color: var(--white); background: var(--oxford); border: var(--rule-strong); border-radius: var(--radius-btn); min-height: 48px; padding: 0.75rem 1.5rem; cursor: pointer; box-shadow: var(--shadow-hard); justify-self: start; }
  .primary-btn:disabled { opacity: 0.6; cursor: default; }
  .err { background: #FBEDE7; border: 1.5px solid #E8B7A2; color: #8f3517; border-radius: var(--radius-sm); padding: 0.7rem 0.9rem; font-size: 0.92rem; }
  .err[hidden] { display: none; }
  .plats { border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem 0.8rem; margin: 0; }
  .plats legend { font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; padding: 0 0.3rem; }
  .check { display: flex; align-items: center; gap: 0.6rem; min-height: 44px; font-family: var(--sans); font-size: 1rem; font-weight: 400; letter-spacing: 0; text-transform: none; margin: 0; }
  .check input { width: 22px; height: 22px; padding: 0; }
  .needs-box { margin-top: 0.6rem; display: grid; gap: 0.5rem; }
  .secret-line { display: flex; gap: 0.5rem; align-items: stretch; }
  .secret-line input { flex: 1; min-width: 0; }
  .secret-box input { font: inherit; padding: 0.6rem 0.7rem; border: var(--rule); border-radius: var(--radius-sm); background: var(--white); color: var(--ink); }
  .secret-steps { margin: 0.4rem 0; padding-left: 1.2rem; font-size: 0.92rem; }
  .secret-steps li { margin: 0.2rem 0; }
  .svc-row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.9rem; }
  .svc-btn { font-family: var(--display); font-weight: 700; font-size: 1rem; min-height: 52px; padding: 0.5rem 1.2rem; border-radius: var(--radius-btn); border: var(--rule-strong); background: var(--white); color: var(--oxford); cursor: pointer; box-shadow: var(--shadow-hard); flex: 1 1 9rem; }
  .svc-btn:hover { background: var(--lime); }
  dialog.svc { border: var(--rule-strong); border-radius: var(--radius); box-shadow: var(--shadow-hard-lg); padding: 1.1rem clamp(1rem, 4vw, 1.6rem) 1.4rem; width: min(36rem, calc(100% - 1.5rem)); max-height: calc(100vh - 1.5rem); max-height: calc(100dvh - 1.5rem); overflow-y: auto; background: var(--white); color: var(--ink); }
  dialog.svc::backdrop { background: rgba(34,49,94, 0.55); }
  .svc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.6rem; }
  .svc-head h2 { margin: 0; font-size: clamp(1.15rem, 4.5vw, 1.4rem); }
  .svc-x { font-size: 1.6rem; line-height: 1; min-width: 44px; min-height: 44px; border: var(--rule); border-radius: var(--radius-btn); background: var(--white); color: var(--oxford); cursor: pointer; }
  .svc-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: space-between; align-items: center; }
  .foot { font-size: 0.85rem; color: var(--ink-faint); margin-top: 1.2rem; }
  @media (max-width: 900px) { .board { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px) { .board { grid-template-columns: 1fr; } .row2 { grid-template-columns: 1fr; } }
${DECISION_CSS}
</style>
</head>
<body>
<header><div class="header-inner">
  <div class="mark"><span class="dot"></span>Me&Co.</div>
  <a class="back" href="/portal/${esc(encodeURIComponent(slug))}">&larr; Back to your portal</a>
  <h1>Your requests</h1>
  <p class="lede">Everything you have asked us for, in one place. Each one moves across as the work happens, and Done links to where it is live.</p>
</div></header>
<main>
  ${banner}
  ${rec.intro ? `<div class="intro"><p>${esc(rec.intro)}</p><p class="sig">Melody</p></div>` : ''}
  ${oneHtml}
  ${journeyHtml(rec, slug)}
  ${oneHtml ? '' : serviceButtons}
  <div class="panel">
    <h2>Where things stand</h2>
    <div class="score">${score}</div>
    ${items.length ? `<p class="foot" style="margin:0.9rem 0 0"><a href="/portal/${esc(encodeURIComponent(slug))}/${rec.journey ? 'requests?one=0' : 'requests-review'}">${rec.journey ? 'Go through them one by one' : 'Go through them one by one: Accept, Change or Edit each request'}</a></p>` : ''}
    <div class="chips" role="group" aria-label="Show requests for a page">${chips}</div>
    <div class="list-top"><div class="views" role="group" aria-label="Choose a view"><button type="button" class="view-btn" data-view="list" aria-pressed="true">List</button><button type="button" class="view-btn" data-view="board" aria-pressed="false">Board</button></div>
    ${services.length === 1 ? `<button type="button" class="add-btn" data-open-service="${services[0]}">${noteBoard ? '+ Add a note' : '+ Add a request'}</button>` : '<a class="add-btn" href="#what">+ Add a request</a>'}</div>
    <div id="list">${listRows}</div>
    <div class="board" id="board" hidden>${cols}</div>
    <p class="foot" data-foot-list>Open requests first, in the order they came in. Finished ones are under Completed. Switch to Board to answer or confirm each one.</p>
    <p class="foot" data-foot-board hidden>Newest first. Requests you send by email land here too. When something is Done, tell us if it is right or not yet.</p>
  </div>

  ${dialogs}
</main>
<script>
(function () {
  var BOOT = ${boot};
  var FORM_ACTION = '/forms/client-request.html';
  var PORTAL = '/.netlify/functions/portal?slug=' + encodeURIComponent(BOOT.slug);
  var BOARD_URL = 'https://clients.weareme.co/portal/' + encodeURIComponent(BOOT.slug) + '/requests';

  // Page filter chips.
  var chips = document.querySelectorAll('.chip');
  function applyFilter(f) {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.filter === f ? 'true' : 'false'); });
    document.querySelectorAll('.req, .lrow').forEach(function (r) { r.hidden = !(f === 'All' || r.dataset.page === f); });
    document.querySelectorAll('.col').forEach(function (col) {
      var n = col.querySelectorAll('.req:not([hidden])').length;
      var c = col.querySelector('.count'); if (c) c.textContent = n;
    });
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { applyFilter(c.dataset.filter); }); });
  var viewBtns = document.querySelectorAll('[data-view]');
  function setView(v) {
    viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'); });
    document.getElementById('list').hidden = v !== 'list';
    document.getElementById('board').hidden = v !== 'board';
    document.querySelector('[data-foot-list]').hidden = v !== 'list';
    document.querySelector('[data-foot-board]').hidden = v !== 'board';
  }
  viewBtns.forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
  // A row in the list opens that request on the board, where its full text and answers are.
  function openRow(r) {
    setView('board');
    var card = document.querySelector('.req[data-id="' + r.dataset.open + '"]');
    if (!card) return;
    var col = card.closest('details'); if (col) col.open = true;
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true });
  }
  document.querySelectorAll('.lrow[data-open]').forEach(function (r) {
    r.addEventListener('click', function () { openRow(r); });
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(r); } });
  });

  // Done starts closed on a phone so the page is not a wall.
  if (window.matchMedia('(max-width: 600px)').matches) {
    var d = document.querySelector('.col[data-done]'); if (d) d.removeAttribute('open');
  } else {
    var d2 = document.querySelector('.col[data-done]'); if (d2) d2.setAttribute('open', '');
  }

  function postPortal(body) {
    return fetch(PORTAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || !j.ok) {
            var e = new Error((j && j.error) || 'That did not save. Please try again in a moment.');
            e.status = res.status; throw e;
          }
          return j;
        });
      });
  }
  // The notification to Me&Co.. The board already holds the request
  // by the time this runs, so a failure here is reported but never loses it.
  function notify(fields, file) {
    var fd = new FormData();
    fd.append('form-name', 'client-request');
    fd.append('client', BOOT.clientName);
    fd.append('slug', BOOT.slug);
    fd.append('board', BOARD_URL);
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k] == null ? '' : fields[k]); });
    if (file) fd.append('screenshot', file, file.name);
    return fetch(FORM_ACTION, { method: 'POST', body: fd }).then(function (r) { if (!r.ok) throw new Error('notify ' + r.status); });
  }
  function done(msg) { location.href = location.pathname + '?msg=' + encodeURIComponent(msg); }

  // Big images are shrunk in the browser first so a phone photo still fits.
  function prepare(file, shrinkOver) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      if (!/^image\\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Please attach a PNG, JPG, WebP or GIF image.'));
      if (file.size <= (shrinkOver || 3 * 1024 * 1024)) return resolve(file);
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 2000 / Math.max(img.width, img.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (!b || b.size > BOOT.maxBytes) return reject(new Error('That image is over 4 MB. Please choose a smaller screenshot.'));
          resolve(new File([b], file.name.replace(/\\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('We could not read that image. Try a PNG or JPG.')); };
      img.src = url;
    });
  }
  function toBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('We could not read that image.')); };
      r.readAsDataURL(file);
    });
  }

  // Service buttons open a box. Each box sends one row to the board first,
  // then each image on its own request, then one notification that carries
  // what fits. The board already holds everything by the time it is sent.
  function openDialog(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDialog(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  document.querySelectorAll('[data-open-service]').forEach(function (b) {
    b.addEventListener('click', function () { var d = document.getElementById('dlg-' + b.dataset.openService); if (d) openDialog(d); });
  });
  document.querySelectorAll('dialog.svc').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) closeDialog(d); });
  });
  var deep = /^#new-(social|website|newsletter|deck|custom)$/.exec(location.hash);
  if (deep && document.getElementById('dlg-' + deep[1])) openDialog(document.getElementById('dlg-' + deep[1]));

  document.querySelectorAll('input[data-images]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var n = inp.files.length, out = inp.closest('div').querySelector('[data-img-list]');
      out.textContent = n ? n + (n === 1 ? ' image chosen' : ' images chosen') : '';
    });
  });

  document.querySelectorAll('form.svc-form').forEach(function (fm) {
    fm.addEventListener('submit', function (e) {
      e.preventDefault();
      var svc = fm.dataset.service, box = fm.querySelector('.err'), btn = fm.querySelector('button[type=submit]'), label = btn.textContent;
      function fail(m) { box.textContent = m; box.hidden = false; }
      box.hidden = true;
      var f = { action: 'request-service', service: svc };
      Array.prototype.forEach.call(fm.elements, function (el) {
        if (!el.name || el.type === 'file') return;
        if (el.type === 'checkbox') { if (el.checked) (f[el.name] = f[el.name] || []).push(el.value); return; }
        f[el.name] = el.value.trim();
      });
      var imgInput = fm.querySelector('input[data-images]');
      var files = imgInput ? Array.prototype.slice.call(imgInput.files) : [];
      if (files.length > BOOT.maxImages) return fail('Please choose ' + BOOT.maxImages + ' images or fewer.');
      btn.disabled = true; btn.textContent = 'Sending...';
      var prepared = [], itemId = null;
      Promise.all(files.map(function (x) { return prepare(x, 1.5 * 1024 * 1024); })).then(function (list) {
        prepared = list;
        return postPortal(f);
      }).then(function (res) {
        itemId = res.item.id;
        return prepared.reduce(function (chain, x, i) {
          return chain.then(function () {
            btn.textContent = 'Sending image ' + (i + 1) + ' of ' + prepared.length + '...';
            return toBase64(x).then(function (b64) { return postPortal({ action: 'request-attach', id: itemId, image: { name: x.name, data: b64 } }); });
          });
        }, Promise.resolve());
      }).then(function () {
        var join = function (v) { return Array.isArray(v) ? v.join(', ') : (v || ''); };
        var main = svc === 'social' ? f.topic : svc === 'newsletter' ? f.issue : f.what;
        var pageName = svc === 'social' ? 'Social media' : svc === 'newsletter' ? 'Newsletter' : svc === 'deck' ? 'Pitch deck' : svc === 'custom' ? 'Custom request' : f.page;
        var fd = new FormData();
        fd.append('form-name', 'client-request'); fd.append('client', BOOT.clientName); fd.append('slug', BOOT.slug); fd.append('board', BOARD_URL);
        fd.append('kind', svc); fd.append('requestId', itemId); fd.append('page', pageName || '');
        fd.append('request', main || ''); fd.append('link', f.link || ''); fd.append('note', '');
        fd.append('platforms', join(f.platforms)); fd.append('goesOut', f.goesOut || ''); fd.append('needBy', f.needBy || '');
        fd.append('words', f.words || ''); fd.append('section', f.section || ''); fd.append('features', join(f.features) || f.audience || ''); fd.append('issue', f.issue || '');
        var budget = 6.5 * 1024 * 1024, used = 0, attached = 0;
        prepared.forEach(function (x, i) { if (i < BOOT.maxImages && used + x.size <= budget) { used += x.size; attached++; fd.append('image' + (i + 1), x, x.name); } });
        fd.append('imageCount', prepared.length + ' on the board, ' + attached + ' attached here');
        return fetch(FORM_ACTION, { method: 'POST', body: fd }).then(function (r) { if (!r.ok) throw new Error('notify'); });
      }).then(function () { done(svc === 'social' ? 'Got it. Your post request is on the board under Received.' : 'Got it. Your request is on the board under Received.'); },
              function (ex) {
        if (itemId && ex && ex.message === 'notify') return done('Your request is on the board. If you do not hear from us in a day, send us a quick email.');
        btn.disabled = false; btn.textContent = label;
        fail(ex && ex.status === 401 ? 'Your session expired. Open your portal link again, then send this.' : (ex && ex.message) || 'That did not send. Please try again.');
      });
    });
  });

  // The Airtable token box. The value goes to the portal over the signed in
  // session and nowhere else; the notification carries only the last 4.
  document.addEventListener('click', function (e) {
    var show = e.target.closest('[data-secret-show]');
    var save = e.target.closest('[data-secret-save]');
    if (show) {
      var inp = show.closest('.secret-box').querySelector('[data-secret-input]');
      var on = inp.type === 'password';
      inp.type = on ? 'text' : 'password';
      show.textContent = on ? 'Hide' : 'Show';
      show.setAttribute('aria-pressed', on ? 'true' : 'false');
      return;
    }
    if (!save) return;
    var box = save.closest('.secret-box'), input = box.querySelector('[data-secret-input]'), baseEl = box.querySelector('[data-secret-base]'), err = box.querySelector('.err');
    var val = input.value.trim();
    err.hidden = true;
    if (!val) { err.textContent = 'Paste your token first.'; err.hidden = false; return; }
    save.disabled = true; var lbl = save.textContent; save.textContent = 'Saving...';
    postPortal({ action: 'secret-save', secret: save.dataset.secretSave, value: val, base: baseEl ? baseEl.value.trim() : '' })
      .then(function (res) {
        input.value = '';
        var line = 'Airtable token received for ' + BOOT.slug + ' (ends in ' + res.last4 + ')';
        return notify({ kind: 'secret-received', requestId: 'secret-' + save.dataset.secretSave, page: 'Whole site', request: line, link: '', note: '' }, null)
          .then(function () { done('Received, thank you. Your Airtable token is saved safely.'); },
                function () { done('Received, thank you. Your Airtable token is saved safely. If you do not hear from us in a day, send us a quick email.'); });
      })
      .catch(function (ex) {
        save.disabled = false; save.textContent = lbl;
        err.textContent = ex && ex.status === 401 ? 'Your session expired. Open your portal link again, then paste it again.' : (ex && ex.message) || 'That did not save. Please try again.';
        err.hidden = false;
      });
  });

  // Confirming a Done row.
  function itemTitle(id) { var li = document.querySelector('.req[data-id="' + id + '"] .req-t'); return li ? li.textContent : ''; }
  function itemPage(id) { var li = document.querySelector('.req[data-id="' + id + '"]'); return li ? li.dataset.page : ''; }
  document.addEventListener('click', function (e) {
    var yes = e.target.closest('[data-yes]');
    var no = e.target.closest('[data-notyet]');
    var sendNo = e.target.closest('[data-send-notyet]');
    var ans = e.target.closest('[data-answer]');
    var appr = e.target.closest('[data-approve]');
    var nnoy = e.target.closest('[data-needs-notyet]');
    var sendNeedsNo = e.target.closest('[data-send-needs-notyet]');
    function needAction(id, kind, text, errBox, btn, msg) {
      btn.disabled = true;
      postPortal({ action: 'request-answer', id: id, kind: kind, text: text })
        .then(function () {
          return notify({ kind: kind === 'approve' ? 'approved' : kind === 'answer' ? 'answer' : 'not-yet', requestId: id, page: itemPage(id), request: itemTitle(id), link: '', note: text }, null)
            .then(function () { done(msg); }, function () { done('Your answer is on the board. If you do not hear from us in a day, send us a quick email.'); });
        })
        .catch(function (ex) { btn.disabled = false; if (errBox) { errBox.textContent = ex.message; errBox.hidden = false; } else alert(ex.message); });
    }
    if (ans) {
      var nb = ans.closest('.needs-box'); var tx = nb.querySelector('textarea').value.trim(); var eb2 = nb.querySelector('.err');
      if (!tx) { eb2.textContent = 'Type your answer first.'; eb2.hidden = false; return; }
      return needAction(ans.dataset.answer, 'answer', tx, eb2, ans, 'Thank you. We have your answer.');
    }
    if (appr) return needAction(appr.dataset.approve, 'approve', '', null, appr, 'Thank you. We have marked that as approved.');
    if (nnoy) {
      var box0 = nnoy.closest('.needs-box'); if (box0.querySelector('textarea')) return;
      var tb = document.createElement('div');
      tb.innerHTML = '<label>What needs to change?</label><textarea maxlength="1000" placeholder="A few words is enough"></textarea><div class="err" hidden></div><button class="mini" type="button" data-send-needs-notyet="' + nnoy.dataset.needsNotyet + '">Send</button>';
      box0.appendChild(tb); tb.querySelector('textarea').focus(); return;
    }
    if (sendNeedsNo) {
      var bx2 = sendNeedsNo.closest('.needs-box'); var nt = bx2.querySelector('textarea').value.trim(); var eb3 = bx2.querySelector('.err');
      if (!nt) { eb3.textContent = 'Add a short note about what needs to change.'; eb3.hidden = false; return; }
      return needAction(sendNeedsNo.dataset.sendNeedsNotyet, 'not_yet', nt, eb3, sendNeedsNo, 'Thank you. We will take another look and be back to you.');
    }
    if (yes) {
      yes.disabled = true;
      var id = yes.dataset.yes;
      postPortal({ action: 'request-confirm', id: id, answer: 'yes' })
        .then(function () { done('Thank you. We have marked that as confirmed.'); })
        .catch(function (ex) { yes.disabled = false; alert(ex.message); });
    } else if (no) {
      var li = no.closest('.req');
      if (li.querySelector('.notyet-box')) return;
      var box = document.createElement('div'); box.className = 'notyet-box';
      box.innerHTML = '<label>What is still off?</label><textarea maxlength="1000" placeholder="A few words is enough"></textarea><div class="err" hidden></div><button class="mini" type="button" data-send-notyet="' + no.dataset.notyet + '">Send</button>';
      li.appendChild(box);
      box.querySelector('textarea').focus();
    } else if (sendNo) {
      var bx = sendNo.closest('.notyet-box'); var note = bx.querySelector('textarea').value.trim(); var eb = bx.querySelector('.err');
      if (!note) { eb.textContent = 'Add a short note about what is still off.'; eb.hidden = false; return; }
      sendNo.disabled = true; var rid = sendNo.dataset.sendNotyet;
      postPortal({ action: 'request-confirm', id: rid, answer: 'not_yet', note: note })
        .then(function () {
          return notify({ kind: 'not-yet', requestId: rid, page: itemPage(rid), request: itemTitle(rid), link: '', note: note }, null)
            .then(function () { done('Thank you. We have reopened that one and will take another look.'); },
                  function () { done('We have reopened that one. If you do not hear from us in a day, send us a quick email.'); });
        })
        .catch(function (ex) { sendNo.disabled = false; eb.textContent = ex.message; eb.hidden = false; });
    }
  });
})();
</script>
<script>${decisionScript(slug, client.name)}</script>
</body>
</html>`;
}


/* ---------- review mode ----------
   /portal/<slug>/requests-review: the board goes through its requests one
   at a time. Choices save as drafts on the record; Submit applies them all
   and sends one notification. See requests-store.js submitReview. */

const STATUS_WORD = { needs: 'Needs your answer', received: 'Received', in_progress: 'In progress', done: 'Done' };

function renderReviewPage(client, rec) {
  const slug = client.slug;
  const drafts = (rec.review && rec.review.drafts) || {};
  const order = { done: 0, in_progress: 1, received: 2, needs: 3 };
  const items = (rec.items || [])
    .filter((i) => i.source !== 'mora' || (i.status === 'needs' && i.ask === 'decide'))
    .slice()
    .sort((a, b) => (order[a.status] - order[b.status]) || String(b.date || '').localeCompare(String(a.date || '')))
    .map((i) => {
      const live = safeUrl(i.liveUrl);
      const site = safeUrl(rec.pageLinks && rec.pageLinks[i.page || 'Whole site']);
      return {
        id: i.id,
        page: i.page || 'Whole site',
        title: i.title,
        quote: i.quote || null,
        key: i.status,
        status: STATUS_WORD[i.status] || '',
        note: i.note || null,
        from: i.from || '',
        date: shortDate(i.date),
        live,
        site,
        // The exact spot to show next to the question: the See it link
        // first, then the live link, then the page link.
        see: safeUrl(i.seeUrl) || live || site,
        draft: drafts[i.id] || null,
      };
    });
  const boot = JSON.stringify({ slug, clientName: client.name || '', items }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Go through your requests &middot; ${esc(client.name)} &middot; Me&Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
  body { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; overflow-x: hidden; }
  [hidden] { display: none !important; }
  button { font-family: inherit; }

  /* top bar: the studio mark, progress, a way out */
  .top { position: sticky; top: 0; z-index: 20; background: var(--white); box-shadow: 0 2px 14px -10px rgba(34,49,94, 0.45); }
  .top-in { display: flex; align-items: center; gap: clamp(0.7rem, 3vw, 1.6rem); padding: 0.55rem clamp(1rem, 4vw, 2rem); min-height: 56px; }
  .top .mark { flex: none; }
  .top .mark span.w { display: none; }
  .meter-wrap { flex: 1; display: flex; align-items: center; gap: 0.8rem; min-width: 0; }
  .count { font-family: var(--mono); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
  .bar { flex: 1; height: 8px; border-radius: 4px; background: var(--panel-2); overflow: hidden; }
  .bar span { display: block; height: 100%; width: 0; background: var(--oxford); border-radius: 4px; transition: width 0.5s var(--ease-out); }
  .exit { flex: none; display: inline-flex; align-items: center; min-height: 44px; font-family: var(--display); font-size: 0.9rem; font-weight: 700; color: var(--oxford); text-decoration: none; padding: 0 0.2rem; }
  .meter-wrap[hidden] + .exit { margin-left: auto; }
  .x-long { display: none; }
  @media (min-width: 640px) { .top .mark span.w { display: inline; } .x-long { display: inline; } }

  /* the stage and its slides */
  .stage { position: relative; flex: 1; display: flex; flex-direction: column; }
  .slide { flex: 1; display: flex; flex-direction: column; min-height: 0; width: 100%; }
  .slide.in-fwd { animation: slideInFwd 0.42s var(--ease-out) both; }
  .slide.in-back { animation: slideInBack 0.42s var(--ease-out) both; }
  .slide.in-fade { animation: fadeUp 0.55s var(--ease-out) both; }
  .slide.out-fwd, .slide.out-back { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .slide.out-fwd { animation: slideOutFwd 0.3s ease-in both; }
  .slide.out-back { animation: slideOutBack 0.3s ease-in both; }
  @keyframes slideInFwd { from { opacity: 0; transform: translateX(7vw); } to { opacity: 1; transform: none; } }
  @keyframes slideInBack { from { opacity: 0; transform: translateX(-7vw); } to { opacity: 1; transform: none; } }
  @keyframes slideOutFwd { to { opacity: 0; transform: translateX(-7vw); } }
  @keyframes slideOutBack { to { opacity: 0; transform: translateX(7vw); } }

  .body { flex: 1; width: 100%; max-width: 82rem; margin: 0 auto; padding: clamp(1.1rem, 4vw, 2.2rem) clamp(1rem, 4vw, 2rem) 1.5rem; }
  .narrow { max-width: 42rem; }
  .center { text-align: center; }

  /* one request */
  .grid { display: flex; flex-direction: column; gap: 1.1rem; }
  .ask { display: contents; }
  .head { order: 1; }
  .spot { order: 2; }
  .acts { order: 3; }
  .kicker { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.7rem; margin: 0 0 0.8rem; }
  .tag { font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-faint); margin: 0; }
  .chip { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 0.28rem 0.6rem; border-radius: var(--radius-pill); background: var(--panel); color: var(--oxford); }
  .chip.done { background: var(--green-bg); color: var(--green); }
  .chip.needs { background: var(--lavender); color: var(--oxford); }
  .chip.in_progress { background: var(--lime); color: var(--oxford); }
  .q { font-family: var(--display); font-weight: 800; color: var(--oxford); font-size: clamp(1.55rem, 6.4vw, 2.5rem); line-height: 1.16; letter-spacing: -0.02em; margin: 0; }
  .where { margin: 0.9rem 0 0; font-size: 1rem; color: var(--ink-soft); }
  .words { margin: 1rem 0 0; padding: 0.75rem 0.95rem; background: var(--white); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); font-size: 0.9rem; color: var(--ink-soft); }
  .words b { display: block; font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 0.2rem; }
  .words i { font-style: italic; }

  .choices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin: 0; }
  .choice { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem; min-height: 84px; padding: 0.6rem 0.4rem; border: 0; border-radius: var(--radius-sm); background: var(--white); color: var(--oxford); cursor: pointer; box-shadow: var(--shadow-sm), 0 0 0 1.5px rgba(34,49,94, 0.1); transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s; }
  .choice:hover { transform: translateY(-2px); box-shadow: 0 10px 22px -12px rgba(34,49,94, 0.4), 0 0 0 1.5px rgba(34,49,94, 0.2); }
  .choice .big { font-family: var(--display); font-weight: 800; font-size: 1.15rem; }
  .choice .sm { font-size: 0.78rem; color: var(--ink-soft); line-height: 1.25; }
  .choice .key { display: none; position: absolute; top: 6px; right: 8px; font-family: var(--mono); font-size: 0.62rem; color: var(--ink-faint); }
  @media (hover: hover) and (min-width: 960px) { .choice .key { display: block; } }
  .choice[aria-pressed="true"] { box-shadow: 0 10px 22px -12px rgba(34,49,94, 0.45), 0 0 0 2.5px var(--oxford); }
  .choice[aria-pressed="true"][data-c="accept"] { background: var(--green-bg); }
  .choice[aria-pressed="true"][data-c="change"] { background: var(--lavender); }
  .choice[aria-pressed="true"][data-c="edit"] { background: var(--lime); }
  .choice[aria-pressed="true"] .sm { color: var(--oxford); }

  .field { margin-top: 0.9rem; background: var(--white); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); padding: 0.8rem 0.9rem 0.9rem; animation: fadeUp 0.35s var(--ease-out) backwards; }
  .field label { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; display: block; margin: 0 0 0.4rem; color: var(--oxford); }
  textarea { font: inherit; font-size: 16px; line-height: 1.5; color: var(--ink); background: var(--paper); border: var(--rule-soft); border-radius: 10px; padding: 0.7rem 0.8rem; width: 100%; min-height: 5.5rem; resize: vertical; display: block; }
  textarea:focus { border-color: var(--oxford); background: var(--white); outline: none; }
  .ask-box { margin: 0; padding: 1rem 1.05rem 1.05rem; background: var(--lavender); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); }
  .ask-box .tag { color: var(--oxford); }
  .ask-box .qs { font-family: var(--display); font-weight: 700; font-size: 1.15rem; line-height: 1.35; margin: 0.3rem 0 0.8rem; color: var(--oxford); }
  .ask-box label { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; display: block; margin: 0 0 0.4rem; }
  .ask-box textarea { background: var(--white); min-height: 6.5rem; }
  .err { background: #FBEDE7; color: #8f3517; border-radius: var(--radius-sm); padding: 0.7rem 0.9rem; font-size: 0.92rem; margin-top: 0.8rem; box-shadow: var(--shadow-sm); }

  /* the spot on their site */
  .spot { background: var(--white); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
  .spot-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.3rem 1rem; padding: 0.55rem 0.9rem; background: var(--panel); }
  .spot-bar b { font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.09em; text-transform: uppercase; }
  .spot-bar a { font-family: var(--display); font-weight: 700; font-size: 0.9rem; display: inline-flex; align-items: center; min-height: 40px; }
  .frame { position: relative; background: var(--paper); height: 62vh; min-height: 22rem; }
  .frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: var(--white); }
  .frame .wait { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1rem; text-align: center; color: var(--ink-faint); font-size: 0.9rem; }
  .spot-open { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap; padding: 0.9rem; }
  .spot-open p { margin: 0; font-size: 0.92rem; color: var(--ink-soft); flex: 1 1 12rem; }
  .spot-note { margin: 0; padding: 0.5rem 0.9rem 0.7rem; font-size: 0.8rem; color: var(--ink-faint); }
  .none-spot { padding: 0.9rem; font-size: 0.92rem; color: var(--ink-soft); margin: 0; }

  @media (min-width: 960px) {
    .grid { display: grid; grid-template-columns: minmax(22rem, 30rem) minmax(0, 1fr); gap: 2.2rem; align-items: start; }
    .grid.solo { grid-template-columns: minmax(0, 40rem); justify-content: center; }
    .ask { display: block; position: sticky; top: 4.7rem; max-height: calc(100vh - 11.5rem); overflow-y: auto; padding: 0.2rem 0.3rem 0.8rem 0; }
    .head { margin-bottom: 1.3rem; }
    .grid:not(.solo) .q { font-size: clamp(1.45rem, 2.1vw, 2rem); line-height: 1.2; }
    .grid:not(.solo) .choice { min-height: 72px; }
    .grid:not(.solo) .words { margin-top: 0.8rem; }
    .frame { height: clamp(26rem, calc(100vh - 14.5rem), 62rem); }
    .spot { position: sticky; top: 4.7rem; }
    .grid.solo .ask { position: static; max-height: none; overflow: visible; }
  }

  /* buttons and the foot bar */
  .foot { position: sticky; bottom: 0; z-index: 15; background: var(--white); box-shadow: 0 -8px 24px -16px rgba(34,49,94, 0.4); padding: 0.7rem clamp(1rem, 4vw, 2rem) calc(0.7rem + env(safe-area-inset-bottom)); margin-top: auto; }
  .foot-in { max-width: 82rem; margin: 0 auto; display: flex; align-items: center; gap: 0.8rem; }
  .foot .mid { flex: 1; text-align: center; font-size: 0.8rem; color: var(--ink-faint); min-height: 1.2rem; }
  .foot .hint { display: none; }
  @media (hover: hover) and (min-width: 960px) { .foot .hint { display: inline; } }
  .btn2 { font-family: var(--display); font-weight: 700; font-size: 1rem; min-height: 52px; padding: 0.6rem 1.4rem; border-radius: var(--radius-btn); border: 0; background: var(--panel); color: var(--oxford); cursor: pointer; transition: transform 0.2s var(--ease-out), box-shadow 0.2s; }
  .btn2:hover:not(:disabled) { transform: translateY(-1px); }
  .btn2.primary { background: var(--oxford); color: var(--white); box-shadow: 0 10px 20px -12px rgba(34,49,94, 0.7); min-width: 8rem; }
  .btn2.lime { background: var(--lime); color: var(--oxford); box-shadow: 0 10px 20px -12px rgba(34,49,94, 0.5); }
  .btn2.big { min-height: 60px; font-size: 1.15rem; padding: 0.7rem 2.4rem; }
  .btn2:disabled { opacity: 0.45; cursor: default; }
  .btn2.link { background: none; box-shadow: none; text-decoration: underline; }

  /* start, end, thanks */
  .hero { padding-top: clamp(1.2rem, 8vh, 4rem); }
  .hero h1 { font-weight: 800; font-size: clamp(2rem, 8vw, 3.4rem); line-height: 1.08; letter-spacing: -0.025em; margin: 0.4rem 0 0; }
  .hero .sub { font-size: clamp(1.05rem, 3.4vw, 1.3rem); color: var(--ink-soft); margin: 1rem 0 0; }
  .three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin: 1.8rem 0 0; text-align: left; }
  .three div { background: var(--white); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); padding: 0.9rem 0.9rem 1rem; }
  .three b { display: block; font-family: var(--display); font-size: 1.1rem; color: var(--oxford); }
  .three span { font-size: 0.85rem; color: var(--ink-soft); line-height: 1.4; display: block; margin-top: 0.15rem; }
  .cta { margin-top: 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
  .fine { font-size: 0.85rem; color: var(--ink-faint); margin: 0; }
  .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin: 1.5rem 0 0; }
  .totals div { background: var(--white); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); padding: 0.9rem 0.4rem; text-align: center; }
  .totals strong { display: block; font-family: var(--display); font-weight: 800; font-size: clamp(1.7rem, 7vw, 2.4rem); line-height: 1; color: var(--oxford); }
  .totals span { font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  .totals .a strong { color: var(--green); }
  .recap { list-style: none; margin: 1.5rem 0 0; padding: 0; display: grid; gap: 0.45rem; text-align: left; }
  .recap button { width: 100%; display: flex; align-items: center; gap: 0.7rem; text-align: left; background: var(--white); border: 0; border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); padding: 0.65rem 0.8rem; cursor: pointer; font-size: 0.92rem; color: var(--ink); min-height: 48px; }
  .recap .t { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .recap .n { font-family: var(--mono); font-size: 0.68rem; color: var(--ink-faint); flex: none; min-width: 1.6rem; }
  .recap .chip { flex: none; }
  .recap .chip.accept { background: var(--green-bg); color: var(--green); }
  .recap .chip.change { background: var(--lavender); }
  .recap .chip.edit { background: var(--lime); }
  .recap .chip.answer { background: var(--lavender); }
  .tick { width: 4.2rem; height: 4.2rem; border-radius: 50%; background: var(--lime); color: var(--oxford); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; animation: pulse 2s ease-in-out 2; }
  @media (max-width: 520px) {
    .choice .big { font-size: 1rem; }
    .three { grid-template-columns: 1fr; }
    .totals { grid-template-columns: repeat(2, 1fr); }
    .btn2.primary { min-width: 0; flex: 1; }
    .foot .btn2 { padding-left: 1rem; padding-right: 1rem; }
  }
  @media (prefers-reduced-motion: reduce) { .slide.out-fwd, .slide.out-back { display: none; } }
</style>
</head>
<body>
<div class="top"><div class="top-in">
  <div class="mark"><span class="dot"></span><span class="w">Me&Co.</span></div>
  <div class="meter-wrap" id="meter" hidden><span class="count" id="count"></span><div class="bar" aria-hidden="true"><span id="fill"></span></div></div>
  <a class="exit" id="exit" href="/portal/${esc(encodeURIComponent(slug))}/requests">Leave<span class="x-long">, answers are saved</span></a>
</div></div>
<main class="stage" id="stage"></main>
<script>
(function () {
  var BOOT = ${boot};
  var items = BOOT.items;
  var PORTAL = '/.netlify/functions/portal?slug=' + encodeURIComponent(BOOT.slug);
  var BOARD = '/portal/' + encodeURIComponent(BOOT.slug) + '/requests';
  var ANS = 'My answer: ';
  var stage = document.getElementById('stage');
  var meter = document.getElementById('meter');
  var wide = window.matchMedia('(min-width: 960px)');
  var idx = items.length;
  var view = 'start';
  var cur = null;
  var preload = null;
  var autoTimer = null;
  var current = null; // hooks for the open request slide: { commit, next, back, pick }
  items.forEach(function (it) { it.d = it.draft || { choice: '', note: '', text: '' }; });
  for (var k = 0; k < items.length; k++) { if (!items[k].draft) { idx = k; break; } }

  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (a) { e.setAttribute(a, attrs[a]); }); if (text != null) e.textContent = text; return e; }
  function post(body) {
    return fetch(PORTAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) { var e = new Error(j.error || 'That did not save. Please try again.'); e.status = r.status; throw e; } return j; }); });
  }
  function save(it) {
    var d = it.d;
    return post({ action: 'review-save', id: it.id, choice: d.choice || '', note: d.note || '', text: d.text || '' });
  }
  function need(it) {
    if (it.d.choice === 'change' && !it.d.note.trim()) return 'Add a short note about what needs to change.';
    if (it.d.choice === 'edit' && !it.d.text.trim()) return 'Type the new wording.';
    return '';
  }
  function isAnswer(it) { return it.key === 'needs' && it.d.choice === 'change'; }
  function errText(ex) { return ex.status === 401 ? 'Your session expired. Open your portal link again, then come back.' : ex.message; }

  /* ---------- slides ---------- */
  function clearPreload() { if (preload) { preload.remove(); preload = null; } }
  function swap(node, dir) {
    var old = cur; cur = node;
    node.classList.add('slide'); node.classList.add('in-' + (dir || 'fade'));
    if (old) { old.classList.remove('in-fwd', 'in-back', 'in-fade'); old.classList.add('out-' + (dir === 'back' ? 'back' : 'fwd')); old.setAttribute('aria-hidden', 'true'); old.querySelectorAll('iframe').forEach(function (f) { f.remove(); }); setTimeout(function () { old.remove(); }, 340); }
    stage.append(node);
    window.scrollTo(0, 0);
  }
  function setMeter() {
    if (view !== 'item') { meter.hidden = true; return; }
    meter.hidden = false;
    document.getElementById('count').textContent = (idx + 1) + ' of ' + items.length;
    document.getElementById('fill').style.width = ((idx + 1) / items.length * 100) + '%';
  }
  function foot(left, mid, right) {
    var f = el('div', { 'class': 'foot' }); var fi = el('div', { 'class': 'foot-in' });
    var m = el('div', { 'class': 'mid', 'aria-live': 'polite' });
    fi.append(left || el('span'), m, right || el('span')); f.append(fi);
    if (mid) m.append(mid);
    return { node: f, mid: m };
  }

  /* ---------- start ---------- */
  function renderStart() {
    view = 'start'; current = null; clearPreload(); setMeter();
    var s = el('div'); var b = el('div', { 'class': 'body narrow center hero' });
    var done = items.filter(function (it) { return it.draft; }).length;
    var mins = Math.max(2, Math.ceil(items.length / 5));
    b.append(el('p', { 'class': 'tag' }, 'Your request review'));
    b.append(el('h1', null, items.length + (items.length === 1 ? ' request' : ' requests') + ', about ' + mins + ' minutes.'));
    b.append(el('p', { 'class': 'sub' }, 'We will show you one request at a time, right next to the spot on your site it is about. Tell us if it is right, needs work, or should be worded differently.'));
    var three = el('div', { 'class': 'three' });
    [['Accept', 'It is right. Nothing more to do.'], ['Change', 'It needs work. Tell us what.'], ['Edit', 'Reword what you asked.']].forEach(function (r) { var d = el('div'); d.append(el('b', null, r[0]), el('span', null, r[1])); three.append(d); });
    b.append(three);
    var cta = el('div', { 'class': 'cta' });
    var go = el('button', { type: 'button', 'class': 'btn2 lime big' }, done ? 'Pick up where you left off' : 'Start');
    go.addEventListener('click', function () { if (idx >= items.length) renderEnd('fwd'); else renderItem(idx, 'fwd'); });
    cta.append(go, el('p', { 'class': 'fine' }, (done ? 'You have already gone through ' + done + ' of ' + items.length + '. ' : '') + 'Your answers save as you go. Nothing is sent until you press Submit at the end.'));
    b.append(cta); s.append(b);
    swap(s, '');
    go.focus({ preventScroll: true });
  }

  /* ---------- one request ---------- */
  function renderItem(i, dir) {
    clearTimeout(autoTimer); clearPreload();
    idx = i; view = 'item'; setMeter();
    var it = items[i];
    var slide = el('div');
    var body = el('div', { 'class': 'body' });
    var grid = el('div', { 'class': 'grid' + (it.see ? '' : ' solo') });
    var ask = el('div', { 'class': 'ask' });

    // head: where, status, the big question, where it stands, their words
    var head = el('div', { 'class': 'head' });
    var kick = el('div', { 'class': 'kicker' });
    kick.append(el('p', { 'class': 'tag' }, it.page), el('span', { 'class': 'chip ' + it.key }, it.status));
    head.append(kick, el('h1', { 'class': 'q' }, it.title));
    if (it.key !== 'needs') {
      var say = { done: 'This one is done.', in_progress: 'We are working on this now.', received: 'We have this and it is in line to be worked on.' }[it.key];
      var wp = el('p', { 'class': 'where' }, (say ? say + ' ' : '') + (it.note || ''));
      if (wp.textContent.trim()) head.append(wp);
    }
    if (it.quote) { var w = el('p', { 'class': 'words' }); w.append(el('b', null, 'Your words'), el('i', null, it.quote)); head.append(w); }

    // actions: the three choices, or the question and answer box
    var acts = el('div', { 'class': 'acts' });
    var er = el('div', { 'class': 'err', role: 'alert', hidden: '' });
    function showErr(ex) { er.textContent = typeof ex === 'string' ? ex : errText(ex); er.hidden = false; }
    var savedMsg = el('span', null, it.draft ? 'Saved' : '');
    var btns = [], editBox = null, ea = null, noteBox = null, ta = null, ans = null;

    function commit() {
      if (ans) { var v = ans.value.trim(); it.d.note = v ? ANS + v : ''; it.d.choice = v ? 'change' : ''; it.d.text = ''; }
      if (ta) it.d.note = ta.value;
      if (ea) it.d.text = ea.value;
    }
    var timer;
    function queueSave() {
      savedMsg.textContent = 'Saving...'; clearTimeout(timer);
      timer = setTimeout(function () { save(it).then(function () { savedMsg.textContent = 'Saved'; er.hidden = true; }).catch(showErr); }, 600);
    }

    if (it.key === 'needs') {
      var box = el('div', { 'class': 'ask-box' });
      box.append(el('p', { 'class': 'tag' }, 'We need your answer'), el('p', { 'class': 'qs' }, it.note || 'Please tell us more about this one.'), el('label', { 'for': 'ans' }, 'Your answer'));
      ans = el('textarea', { id: 'ans', maxlength: '950', placeholder: 'Type your answer here' });
      ans.value = (it.d.note || '').indexOf(ANS) === 0 ? it.d.note.slice(ANS.length) : '';
      box.append(ans); acts.append(box, er);
      ans.addEventListener('input', function () {
        commit(); it.draft = it.d.choice ? it.d : null;
        if (!it.d.choice) { savedMsg.textContent = ''; save(it).catch(showErr); } else queueSave();
        refreshNext();
      });
    } else {
      var ch = el('div', { 'class': 'choices', role: 'group', 'aria-label': 'Your answer' });
      [['accept', 'Accept', 'It is right', '1'], ['change', 'Change', 'Needs work', '2'], ['edit', 'Edit', 'Reword it', '3']].forEach(function (c) {
        var bt = el('button', { type: 'button', 'class': 'choice', 'data-c': c[0], 'aria-pressed': 'false' });
        bt.append(el('span', { 'class': 'key' }, c[3]), el('span', { 'class': 'big' }, c[1]), el('span', { 'class': 'sm' }, c[2]));
        bt.addEventListener('click', function () { pick(c[0]); });
        btns.push(bt); ch.append(bt);
      });
      editBox = el('div', { 'class': 'field' });
      editBox.append(el('label', { 'for': 'edit' }, 'Reword what you asked'));
      ea = el('textarea', { id: 'edit', maxlength: '2000' }); editBox.append(ea);
      noteBox = el('div', { 'class': 'field' });
      var nl = el('label', { 'for': 'note' }, 'Add a note (optional)');
      ta = el('textarea', { id: 'note', maxlength: '1000' }); noteBox.append(nl, ta);
      ea.value = it.d.text || ''; ta.value = it.d.note || '';
      acts.append(ch, editBox, noteBox, er);
      [ta, ea].forEach(function (x) { x.addEventListener('input', function () { commit(); queueSave(); }); });
    }

    function paint() {
      btns.forEach(function (bt) { bt.setAttribute('aria-pressed', String(it.d.choice === bt.getAttribute('data-c'))); });
      if (editBox) {
        editBox.hidden = it.d.choice !== 'edit';
        noteBox.hidden = !it.d.choice;
        nl.textContent = it.d.choice === 'change' ? 'What needs to change?' : 'Add a note (optional)';
      }
    }
    function pick(c) {
      clearTimeout(autoTimer);
      var was = it.d.choice;
      it.d.choice = was === c ? '' : c;
      if (it.d.choice === 'edit' && !it.d.text) { it.d.text = it.quote || it.title; ea.value = it.d.text; }
      if (it.d.choice !== 'edit') { it.d.text = ''; ea.value = ''; }
      it.draft = it.d.choice ? it.d : null;
      paint(); refreshNext();
      if (!it.d.choice || it.d.choice === 'accept') { savedMsg.textContent = it.d.choice ? 'Saved' : ''; save(it).catch(showErr); }
      if (it.d.choice === 'accept') { autoTimer = setTimeout(function () { if (view === 'item' && idx === i && it.d.choice === 'accept') goNext(); }, 650); }
      else if (it.d.choice === 'edit') { ea.focus(); ea.select(); }
      else if (it.d.choice === 'change') { ta.focus(); }
    }

    // the spot on their site
    var spot = null;
    if (it.see) {
      spot = el('div', { 'class': 'spot' });
      var sb = el('div', { 'class': 'spot-bar' });
      sb.append(el('b', null, 'The spot on your site'), el('a', { href: it.see, target: '_blank', rel: 'noopener' }, 'Open in a new tab'));
      spot.append(sb);
      var loadFrame = function () {
        var fr = el('div', { 'class': 'frame' });
        fr.append(el('div', { 'class': 'wait' }, 'Loading your page...'));
        var f = el('iframe', { src: it.see, title: 'Your site: ' + it.title, referrerpolicy: 'no-referrer', sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms' });
        fr.append(f);
        spot.append(fr, el('p', { 'class': 'spot-note' }, 'If the page does not show up here, use Open in a new tab.'));
        return fr;
      };
      if (wide.matches) loadFrame();
      else {
        var op = el('div', { 'class': 'spot-open' });
        op.append(el('p', null, 'See the exact spot on your site, right here.'));
        var ob = el('button', { type: 'button', 'class': 'btn2' }, 'Show it here');
        ob.addEventListener('click', function () { op.remove(); var fr = loadFrame(); fr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
        op.append(ob); spot.append(op);
      }
    }

    // foot: Back, a quiet status, Next
    var back = el('button', { type: 'button', 'class': 'btn2' }, 'Back'); back.disabled = i === 0;
    var next = el('button', { type: 'button', 'class': 'btn2 primary' });
    function refreshNext() { next.textContent = i === items.length - 1 ? 'Finish' : (it.d.choice ? 'Next' : 'Skip'); }
    var hint = el('span', { 'class': 'hint' }, 'Press Enter for next');
    var ft = foot(back, null, next); ft.mid.append(savedMsg, document.createTextNode(' '), hint);
    function goNext() {
      clearTimeout(autoTimer); commit();
      var msg = need(it); if (msg) { showErr(msg); return; }
      next.disabled = true;
      save(it).then(function () { if (i + 1 >= items.length) renderEnd('fwd'); else renderItem(i + 1, 'fwd'); }).catch(function (ex) { next.disabled = false; showErr(ex); });
    }
    function goBack() { clearTimeout(autoTimer); commit(); if (it.d.choice) save(it).catch(function () {}); renderItem(i - 1, 'back'); }
    back.addEventListener('click', function () { if (i > 0) goBack(); });
    next.addEventListener('click', goNext);
    current = { next: goNext, back: function () { if (i > 0) goBack(); }, pick: it.key === 'needs' ? null : pick };

    ask.append(head, acts);
    grid.append(ask);
    if (spot) { grid.append(spot); }
    body.append(grid); slide.append(body, ft.node);
    paint(); refreshNext();
    swap(slide, dir);

    // warm up the next spot (large screens only), then keep just the two frames
    var nx = items[i + 1];
    if (wide.matches && nx && nx.see) {
      preload = el('iframe', { src: nx.see, title: 'Loading the next page', tabindex: '-1', 'aria-hidden': 'true', referrerpolicy: 'no-referrer', sandbox: 'allow-scripts allow-same-origin' });
      preload.style.cssText = 'position:fixed;left:-20px;top:0;width:10px;height:10px;opacity:0;pointer-events:none;border:0';
      document.body.append(preload);
    }
  }

  /* ---------- end ---------- */
  function renderEnd(dir) {
    view = 'end'; current = null; clearTimeout(autoTimer); clearPreload(); setMeter();
    var t = { accept: 0, change: 0, edit: 0, answer: 0, none: 0 };
    items.forEach(function (it) { if (isAnswer(it)) t.answer++; else t[it.d.choice || 'none']++; });
    var slide = el('div'); var b = el('div', { 'class': 'body narrow center hero' });
    b.append(el('p', { 'class': 'tag' }, 'All done'), el('h1', null, 'Ready to send your answers?'));
    b.append(el('p', { 'class': 'sub' }, 'Pressing Submit sends all of it to us at once and updates your board. You can still tap any request below to change your answer first.'));
    var tot = el('div', { 'class': 'totals' });
    [['accept', 'Accept'], ['change', 'Change'], ['edit', 'Edit']].concat(t.answer ? [['answer', 'Answered']] : []).forEach(function (r) { var d = el('div', { 'class': r[0] === 'accept' ? 'a' : '' }); d.append(el('strong', null, String(t[r[0]])), el('span', null, r[1])); tot.append(d); });
    b.append(tot);
    if (t.none) b.append(el('p', { 'class': 'fine', style: 'margin-top:0.9rem' }, t.none + (t.none === 1 ? ' request was skipped and stays as it is.' : ' requests were skipped and stay as they are.')));
    var ul = el('ul', { 'class': 'recap' });
    items.forEach(function (it, n) {
      if (!it.d.choice) return;
      var li = el('li'); var bt = el('button', { type: 'button' });
      var kind = isAnswer(it) ? 'answer' : it.d.choice;
      bt.append(el('span', { 'class': 'n' }, String(n + 1)), el('span', { 'class': 't' }, it.title), el('span', { 'class': 'chip ' + kind }, { accept: 'Accept', change: 'Change', edit: 'Edit', answer: 'Answered' }[kind]));
      bt.addEventListener('click', function () { renderItem(n, 'back'); });
      li.append(bt); ul.append(li);
    });
    if (ul.children.length) b.append(ul);
    var er = el('div', { 'class': 'err', role: 'alert', hidden: '' }); b.append(er);
    var backB = el('button', { type: 'button', 'class': 'btn2' }, 'Go back');
    var sub = el('button', { type: 'button', 'class': 'btn2 primary' }, 'Submit');
    backB.addEventListener('click', function () { renderItem(items.length - 1, 'back'); });
    sub.addEventListener('click', function () {
      if (t.accept + t.change + t.edit + t.answer === 0) { er.textContent = 'Choose Accept, Change or Edit on at least one request first.'; er.hidden = false; return; }
      sub.disabled = true; sub.textContent = 'Sending...'; er.hidden = true;
      post({ action: 'review-submit' }).then(function (res) {
        var fd = new FormData();
        fd.append('form-name', 'client-request'); fd.append('client', BOOT.clientName); fd.append('slug', BOOT.slug);
        fd.append('board', 'https://clients.weareme.co' + BOARD); fd.append('kind', 'review-submission');
        fd.append('requestId', ''); fd.append('page', ''); fd.append('request', res.summary); fd.append('link', ''); fd.append('note', '');
        return fetch('/forms/client-request.html', { method: 'POST', body: fd }).then(function (r) { if (!r.ok) throw new Error('notify'); })
          .then(function () { renderThanks(res.count, true); }, function () { renderThanks(res.count, false); });
      }).catch(function (ex) { sub.disabled = false; sub.textContent = 'Submit'; er.textContent = ex.status === 401 ? 'Your session expired. Open your portal link again, then press Submit.' : ex.message; er.hidden = false; });
    });
    var ft = foot(backB, null, sub);
    slide.append(b, ft.node);
    swap(slide, dir);
  }

  /* ---------- thank you ---------- */
  function renderThanks(count, notified) {
    view = 'thanks'; current = null; setMeter();
    var slide = el('div'); var b = el('div', { 'class': 'body narrow center hero' });
    b.append(el('div', { 'class': 'tick', 'aria-hidden': 'true' }, 'OK'.slice(0, 0) + '✓'));
    b.append(el('h1', null, 'Thank you.'));
    b.append(el('p', { 'class': 'sub' }, notified
      ? 'Your review is on its way to us and your board is updated. We will go through your ' + count + (count === 1 ? ' answer' : ' answers') + ' and get back to you.'
      : 'Your review is saved on your board. If you do not hear from us in a day, send us a quick email.'));
    var cta = el('div', { 'class': 'cta' });
    var a = el('a', { 'class': 'btn2 primary big', href: BOARD, style: 'text-decoration:none;display:inline-flex;align-items:center' }, 'Back to your request board');
    cta.append(a); b.append(cta); slide.append(b);
    swap(slide, 'fwd');
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey) return;
    var tg = e.target, tag = tg && tg.tagName;
    var typing = tag === 'TEXTAREA' || tag === 'INPUT';
    if (typing) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && current) { e.preventDefault(); current.next(); } return; }
    if (e.ctrlKey || e.metaKey) return;
    if (!current) return;
    if (e.key === 'ArrowRight' || (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A')) { e.preventDefault(); current.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); current.back(); }
    else if (current.pick && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); current.pick(['accept', 'change', 'edit'][Number(e.key) - 1]); }
  });

  if (!items.length) { var e0 = el('div', { 'class': 'body narrow center hero' }); e0.append(el('h1', null, 'Nothing to go through yet.')); stage.append(e0); }
  else renderStart();
})();
</script>
</body>
</html>`;
}

module.exports = { renderRequestsSection, renderRequestsPage, renderReviewPage, isVisible };
