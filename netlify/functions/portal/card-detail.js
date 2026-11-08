/* ============================================================
   Me&Co. — card detail page (Notion-page style)
   ------------------------------------------------------------
   Opened by clicking a dashboard card. Shows that card's real
   sub-items (documents, links, written content), list/grid
   toggle same as the dashboard. Text items print as a properly
   branded page, not a browser default, for the "save as PDF"
   flows (onboarding, offboarding).
   ============================================================ */

const { ITEM_STYLES, EMBED_OVERLAY_HTML, EMBED_OVERLAY_SCRIPT } = require('./item-styles.js');
const { FONT_LINK, TOKENS, BASE } = require('./theme.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TYPE_LABEL = { pdf: 'PDF', html: 'Page', link: 'Link', text: 'Note' };
// These must match STATUS_LABEL in dashboard.js word for word. They did
// not, for a while: the dashboard pill read COMPLETE while the pill
// inside the very same card read DONE, and NOT STARTED YET wrapped onto
// two lines at 360px once the pills went mono uppercase. Same status,
// same word, everywhere. verify-brand.js asserts the two maps agree.
const ITEM_STATUS_LABEL = { complete: 'Complete', in_progress: 'In progress', not_started: 'Not started' };

function statusPillHtml(status) {
  if (!status) return '';
  const label = ITEM_STATUS_LABEL[status] || status;
  return `<span class="item-status item-status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

// Three ways to show the same checklist data, decided by the card, not
// the item: Deliverables is a completion record, checkbox UI,
// done/not-done. Offboarding is live instructions for Melody to
// actually follow, reads as plain numbered steps, no checkbox chrome,
// because it should not read as a checklist at all.
// Onboarding is a real question set, not a checklist someone ticks off
// while reading it, same plain numbered rendering as instructions but
// its own mode name because itemRowHtml also strips the tag and status
// pill for it. List the questions without the checklist mark.
function checklistHtml(checklist, mode) {
  if (!checklist || !checklist.length) return '';
  if (mode === 'instructions' || mode === 'onboarding') {
    const rows = checklist.map((c) => `<li>${escapeHtml(c.text)}</li>`).join('');
    return `<ol class="instructions">${rows}</ol>`;
  }
  const rows = checklist
    .map(
      (c) => `<li class="${c.done ? 'done' : ''}"><span class="check">${c.done ? '&#10003;' : ''}</span>${escapeHtml(c.text)}</li>`
    )
    .join('');
  return `<ol class="checklist">${rows}</ol>`;
}

// item.description, item.notes, and text-item.content are all authored
// through the admin rich text editor (contenteditable, saved as real
// HTML), never from public input. Rendered as trusted HTML here, not
// escaped, same trust boundary as any CMS admin panel: only an
// authenticated admin session can ever write these fields.
function itemRowHtml(item, mode) {
  const type = item.type || 'link';
  const label = TYPE_LABEL[type] || 'Item';
  if (type === 'text') {
    // Onboarding items skip the tag and status pill entirely, the card
    // header already carries status and a "Not started" pill on every
    // question reads as noise, not signal. No "not started" and no
    // NOTE tag on each of these sections.
    // plain: a short status line on a card (Deliverables), not a document,
    // so it carries no tag and no pill either.
    const bare = mode === 'onboarding' || item.plain === true;
    return `
    <div class="item item-text">
      <div class="item-top">${bare ? '' : `<span class="tag">${label}</span>`}<h4>${escapeHtml(item.title)}</h4>${bare ? '' : statusPillHtml(item.status)}</div>
      ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
      ${item.content ? `<div class="item-body">${item.content}</div>` : ''}
      ${checklistHtml(item.checklist, mode)}
      ${item.notes ? `<div class="item-notes"><span class="notes-label">Notes</span><div>${item.notes}</div></div>` : ''}
    </div>`;
  }
  // Embedded items are Mora's own document, opened right there in the
  // portal: no "Link" tag (it isn't a link to anywhere external) and no
  // separate status pill (the card header already shows it, showing it
  // twice on a card that's just this one document is pure repetition).
  // A LINK tag makes no sense on something internal, and the complete
  // button does not belong inside either.
  if (item.embed) {
    return `
    <div class="item item-embed-item">
      <div class="item-top"><h4>${escapeHtml(item.title)}</h4></div>
      ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
      <div class="item-view-row">
        <button type="button" class="embed-open-btn" data-embed-src="${escapeHtml(item.url)}" data-embed-title="${escapeHtml(item.title)}">View</button>
      </div>
    </div>`;
  }
  // An action item is a real one click request: the client presses it and
  // a Netlify Form submission lands, no page to fill in and nothing to
  // write. "Request a PayPal invoice" on the Payments card is the shape:
  // a button of sorts, connected to Netlify Forms, that requests PayPal.
  //
  // Same registration rule as every other form here: the form name and
  // every field must exist in public/forms/ or Netlify silently discards
  // the submission. See onboarding-form.js for the full note.
  if (type === 'action') {
    const formName = escapeHtml(item.formName || '');
    return `
    <div class="item item-action">
      <div class="item-top"><h4>${escapeHtml(item.title)}</h4></div>
      ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
      <form class="item-view-row" name="${formName}" method="POST" data-netlify="true" action="/forms/thanks.html">
        <input type="hidden" name="form-name" value="${formName}" />
        <input type="hidden" name="request" value="${escapeHtml(item.requestValue || item.title)}" />
        <button type="submit" class="embed-open-btn">${escapeHtml(item.buttonLabel || 'Request')}</button>
      </form>
    </div>`;
  }
  // A genuinely external link keeps the type tag, since that's real
  // signal. It does not keep a status pill alongside External, showing
  // both is redundant the same way it is on an embedded item: just
  // external, not external and complete. Open renders as a real button,
  // same visual weight as VIEW and Print or download, not a plain
  // underlined text link. The button always sits at the bottom of the
  // section, after the description and after any checklist or
  // instructions, never above them.
  //
  // The button says what the click does and the line under it says where
  // it goes. A bare "Open" that lands a client on their own live website
  // with no warning reads as a mistake ("why did it take me to my site?").
  // An item can name its own button with buttonLabel; otherwise it is
  // derived from where the link points.
  const dest = linkDestination(item.url);
  return `
  <div class="item">
    <div class="item-top"><h4>${escapeHtml(item.title)}</h4></div>
    ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
    ${checklistHtml(item.checklist, mode)}
    ${item.url
      ? `<div class="item-view-row"><a class="embed-open-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.buttonLabel || dest.label)}</a>${dest.host ? `<span class="item-dest">Opens ${escapeHtml(dest.host)} in a new tab</span>` : ''}</div>`
      : `<p class="item-missing">Not linked yet.</p>`}
    ${item.notes ? `<div class="item-notes"><span class="notes-label">Notes</span><div>${item.notes}</div></div>` : ''}
  </div>`;
}

function linkDestination(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return { label: 'View', host: '' };
  let host = '';
  try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return { label: 'Open link', host: '' }; }
  if (/docs\.google\.com\/document/.test(u)) return { label: 'Open the Google Doc', host: 'Google Docs' };
  if (/docs\.google\.com\/spreadsheets/.test(u)) return { label: 'Open the Google Sheet', host: 'Google Sheets' };
  if (/drive\.google\.com/.test(u)) return { label: 'Open in Google Drive', host: 'Google Drive' };
  if (/(^|\.)(cal\.com|calendly\.com)$/.test(host)) return { label: 'Book a time', host };
  if (/(^|\.)claude\.ai$/.test(host)) return { label: 'Open the guide', host: 'Claude' };
  return { label: 'Go to ' + host, host };
}

// "onboarding-questions" (the real question-gathering stage) is
// deliberately a different pattern than plain "onboarding" (Project 1's
// older "Onboarding Docs" card, a retrospective note, not a question
// set). Keep them off the same regex. Collide them and a docs card
// renders in onboarding mode with a "Start Onboarding Questions" button
// it has no business showing. Render the page and look, rather than
// reading the code and assuming.
// A card can also opt into the structured-form treatment explicitly with
// `"form": true` in its JSON, regardless of its id. CBC's Contract card
// uses it: it needs two real facts back from the client (legal entity
// name, authorized signer) before the agreement can be finalised.
// Renaming a card's id to smuggle in "onboarding-questions" breaks its
// stage ordering and its label, so the flag is the honest mechanism:
// the id drives the stage, the flag drives the render.
function cardMode(cardId, card) {
  if (/offboarding/.test(cardId)) return 'instructions';
  if (/onboarding-questions/.test(cardId)) return 'onboarding';
  if (card && card.form === true) return 'onboarding';
  return 'checkbox';
}

function renderCardDetail(client, card) {
  const mode = cardMode(card.id, card);
  const items = (card.items || []).map((item) => itemRowHtml(item, mode)).join('') || `<p class="empty">Nothing added here yet.</p>`;
  const hasTextItem = (card.items || []).some((i) => i.type === 'text');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${escapeHtml(card.label)} &middot; ${escapeHtml(client.name)} &middot; Me&Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}

  .letterhead { display: none; /* only shown on print */ }

  header { background: var(--white); border-bottom: var(--rule-soft); padding: clamp(1.1rem, 4vw, 1.8rem) clamp(1.1rem, 5vw, 2.2rem) clamp(1.2rem, 4vw, 1.6rem); }
  .header-inner { max-width: 46rem; margin: 0 auto; }
  .back {
    display: inline-flex; align-items: center; gap: 0.35rem; min-height: 44px;
    font-family: var(--display); font-size: 0.95rem; font-weight: 700; color: var(--oxford); text-decoration: none;
  }
  .back:hover { text-decoration: underline; }
  .kicker { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--lime-ink); font-weight: 700; margin: 0.7rem 0 0.25rem; }
  h1 { font-weight: 800; font-size: clamp(1.45rem, 5.5vw, 1.95rem); margin: 0; letter-spacing: -0.015em; }

  main { max-width: 46rem; margin: 0 auto; padding: clamp(1.2rem, 4vw, 2rem) clamp(1.1rem, 5vw, 2.2rem) 4rem; }
  .sheet { background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard); padding: clamp(1.1rem, 5vw, 1.9rem); animation: fadeUp 0.6s var(--ease-out) backwards; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
  .toolbar .views { display: flex; gap: 0.4rem; }
  .toolbar .views button {
    font-family: var(--sans); font-size: 0.88rem; font-weight: 600; min-height: 44px;
    padding: 0.5rem 1rem; border: var(--rule-soft); background: var(--white);
    color: var(--ink-soft); border-radius: var(--radius-btn); cursor: pointer;
  }
  .toolbar .views button.active { background: var(--oxford); color: var(--white); border-color: var(--oxford); }
  .export-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .print-btn {
    display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
    font-family: var(--display); font-weight: 700; font-size: 0.9rem;
    background: var(--white); color: var(--oxford); border: var(--rule);
    border-radius: var(--radius-btn); padding: 0.5rem 1.1rem; cursor: pointer; text-decoration: none;
    box-shadow: var(--shadow-hard-sm);
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .print-btn:hover { background: var(--panel); transform: translateY(-2px); box-shadow: var(--shadow-hard); }
  .print-btn:active { transform: translateY(2px); box-shadow: 0 0 0 0 var(--oxford); }

  .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.8rem; }
  .items-grid .item { border: var(--rule-soft); border-radius: var(--radius-sm); padding: 1rem; background: var(--white); }
  .items-grid[hidden], .items-list[hidden] { display: none; }

  ${ITEM_STYLES}

  @media (max-width: 34rem) {
    .toolbar { flex-direction: column; align-items: stretch; }
    .toolbar .views button, .export-actions .print-btn { flex: 1; }
  }

  @media print {
    body { background: var(--white); }
    header, .toolbar, .item-link, nav { display: none !important; }
    .sheet { box-shadow: none; border-radius: 0; padding: 0; }
    .letterhead {
      display: flex !important; align-items: center; justify-content: space-between;
      border-bottom: 2px solid var(--oxford); padding-bottom: 0.8rem; margin-bottom: 1.5rem;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .letterhead .wordmark { font-family: var(--display); font-weight: 800; font-size: 1.3rem; color: var(--oxford); }
    .letterhead .stamp { font-family: var(--mono); font-size: 0.7rem; color: var(--lime-ink); text-align: right; }
    .print-title { font-family: var(--display); font-weight: 800; font-size: 1.6rem; color: var(--oxford); margin: 0 0 1.5rem; }
    .items-grid[hidden], .items-list[hidden] { display: block !important; }
    main { max-width: 100%; padding: 0; }
    .item { border: none !important; padding: 0 0 1rem !important; }
    .tag, .item-status { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="letterhead">
    <span class="wordmark">Me&Co.</span>
    <span class="stamp">${escapeHtml(client.name)}<br>${new Date().toISOString().slice(0, 10)}</span>
  </div>
  <header>
    <div class="header-inner">
      <div class="mark"><span class="dot"></span>Me&Co.</div>
      <a class="back" href="/portal/${escapeHtml(client.slug)}">&larr; Back to your portal</a>
      <p class="kicker">${escapeHtml(card.project || '')}</p>
      <h1>${escapeHtml(card.label)}</h1>
    </div>
  </header>
  <main>
    <p class="print-title" style="display:none">${escapeHtml(card.label)}</p>
    <div class="sheet">
      <div class="toolbar">
        <div class="views">
          <button type="button" id="view-list" class="active">List</button>
          <button type="button" id="view-grid">Cards</button>
        </div>
        ${hasTextItem ? `<div class="export-actions">
          <button class="print-btn" onclick="window.print()" type="button">Print or save as PDF</button>
          <a class="print-btn docx-btn" href="?format=docx">Download as Word</a>
        </div>` : ''}
      </div>
      <div class="items-list">${items}</div>
      <div class="items-grid" hidden>${items}</div>
    </div>
  </main>
  ${EMBED_OVERLAY_HTML}
  <script>
    (function () {
      var listBtn = document.getElementById('view-list');
      var gridBtn = document.getElementById('view-grid');
      function setView(mode) {
        document.querySelector('.items-list').toggleAttribute('hidden', mode !== 'list');
        document.querySelector('.items-grid').toggleAttribute('hidden', mode !== 'grid');
        listBtn.classList.toggle('active', mode === 'list');
        gridBtn.classList.toggle('active', mode === 'grid');
      }
      listBtn.addEventListener('click', function () { setView('list'); });
      gridBtn.addEventListener('click', function () { setView('grid'); });
    })();
    (function () {
      ${EMBED_OVERLAY_SCRIPT}
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderCardDetail, itemRowHtml, cardMode, linkDestination };
