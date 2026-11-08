/* ============================================================
   Me&Co. — shared styling for itemRowHtml's output
   ------------------------------------------------------------
   Both card-detail.js (the full page) and dashboard.js (the
   inline accordion) render the exact same item markup via
   itemRowHtml, so they need the exact same CSS for it.
   Hand-copied blocks in two places drift. Always check the code
   for redundancy like that. One source, required by both,
   changed in one place.

   The client-facing rules this file holds to:
   - Nothing a client reads is under 14px. Item status at 0.64rem
     uppercase monospace with letter spacing is roughly 10px, which
     is not readable on a phone.
   - Checklists get real breathing room and a green tick, so a
     three-line checklist reads as three steps rather than a block.
   - Every button is at least 48px tall and wraps instead of
     overflowing on a narrow screen.
   - Colour tokens come from theme.js, shared with the invoices
     and receipts, so the palette here is the studio's four and
     never a third or fourth accent invented locally.
   ============================================================ */

const ITEM_STYLES = `
  .item { border-top: var(--rule-soft); padding: 1.1rem 0; }
  .item:first-child { border-top: none; }
  .item-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  /* The item type badge (LINK, NOTE, DOC). Lavender, not grey: on the
     live portal this is the small pink-purple chip to the left of the
     item title, and lavender is a real studio token that belongs on
     the client-facing pages. */
  .tag {
    font-family: var(--mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 0.2rem 0.5rem; border-radius: var(--radius-pill); font-weight: 700;
    background: var(--lavender); color: var(--oxford);
  }
  .item h4 { font-family: var(--display); font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--oxford); letter-spacing: -0.005em; flex: 1 1 12rem; min-width: 0; }
  .item-badges { margin-left: auto; display: flex; align-items: center; gap: 0.4rem; }
  /* Same treatment as the dashboard's .pill. These are the status chips
     inside an expanded card, and they carry the same lime and lavender
     the dashboard does, so one card never shows two different visual
     languages for the same word. */
  .item-status {
    font-family: var(--mono); font-size: 0.68rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.28rem 0.7rem; border-radius: var(--radius-pill); white-space: nowrap;
  }
  .item-status-complete { background: var(--lime); color: var(--oxford); }
  .item-status-in_progress { background: var(--lavender); color: var(--oxford); }
  .item-status-not_started { background: var(--white); color: var(--ink-faint); box-shadow: inset 0 0 0 1px var(--panel-2); }
  .item-desc { font-size: 0.94rem; color: var(--ink-soft); margin: 0.45rem 0 0; }
  .item-desc p { margin: 0 0 0.5rem; }
  .item-desc p:last-child { margin-bottom: 0; }
  .item-missing { font-size: 0.88rem; color: var(--ink-faint); font-style: italic; margin: 0.5rem 0 0; }
  /* "External" is the one chip on the page that stays fully round, and
     it is dark: navy ground, white text. It is a warning that the next
     tap leaves the portal, so it reads as the heaviest label here
     rather than the lightest, which grey-on-grey made it. */
  .pill-external {
    font-family: var(--mono); font-size: 0.66rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--white); background: var(--oxford); border-radius: 999px;
    padding: 0.28rem 0.8rem; display: inline-block; white-space: nowrap;
  }

  .item-view-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem 0.9rem; margin-top: 0.8rem; }
  .item-dest { font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.04em; color: var(--ink-faint); }
  /* Chunked copy: short paragraphs, bold lead-ins and real lists, so a
     card scans in a glance instead of reading as one run-on block. */
  .item-desc, .item-body, .row-desc { line-height: 1.6; }
  .item-desc ul, .item-body ul, .row-desc ul { margin: 0.4rem 0 0.6rem; padding-left: 1.15rem; }
  .item-desc li, .item-body li, .row-desc li { margin: 0.25rem 0; }
  .item-desc strong, .item-body strong, .row-desc strong { color: var(--oxford); font-weight: 700; }
  .item-body p + p, .item-desc p + p { margin-top: 0.6rem; }
  .embed-open-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    font-family: var(--display); font-weight: 700; font-size: 0.95rem; line-height: 1.2;
    text-transform: uppercase; letter-spacing: 0.06em;
    min-height: 48px; padding: 0.7rem 1.6rem; border-radius: var(--radius-btn);
    /* Blue, not lime. This is the "View this document" / "Open in a new
       tab" control and on the live portal it is solid blue with white
       text, the same accent as the header's meeting button. Lime was
       wrong twice over: it is the Complete colour now, so a lime action
       button sat directly under a lime COMPLETE pill meaning something
       entirely different. Blue is the site's action colour, so it takes
       the site's blue glow on hover rather than the sticker shadow. */
    color: var(--white); background: var(--blue); border: 2px solid var(--blue);
    cursor: pointer; text-decoration: none; text-align: center;
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .embed-open-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(30, 69, 251, 0.35); }
  .embed-open-btn:active { transform: translateY(2px); box-shadow: none; }

  .embed-overlay {
    position: fixed; inset: 0; z-index: 5000; background: var(--paper);
    display: none; flex-direction: column;
  }
  .embed-overlay.open { display: flex; }
  .embed-overlay-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
    padding: 0.6rem 0.9rem; background: var(--oxford); flex: none;
  }
  .embed-overlay-bar .embed-title { font-family: var(--display); font-weight: 700; color: var(--white); font-size: 0.95rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .embed-exit-btn {
    flex: none; font-family: var(--display); font-weight: 700; font-size: 0.88rem;
    min-height: 44px; background: var(--lime); color: var(--oxford); border: none;
    border-radius: var(--radius-btn); padding: 0.5rem 1.1rem; cursor: pointer;
  }
  .embed-exit-btn:hover { background: var(--white); }
  .embed-overlay iframe { flex: 1; width: 100%; border: none; background: var(--paper); }

  .item-body { margin-top: 0.7rem; font-size: 0.96rem; color: var(--ink-soft); }
  .item-body p { margin: 0 0 0.8rem; }
  .item-body p:last-child { margin-bottom: 0; }

  .checklist { list-style: none; margin: 0.9rem 0 0; padding: 0; }
  .checklist li {
    display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.94rem;
    padding: 0.45rem 0; color: var(--ink-soft); border-top: var(--rule-soft);
  }
  .checklist li:first-child { border-top: none; }
  .checklist li.done { color: var(--ink-faint); text-decoration: line-through; }
  .checklist .check {
    flex: none; width: 1.25rem; height: 1.25rem; border: var(--rule-soft); border-radius: 5px;
    display: flex; align-items: center; justify-content: center; font-size: 0.78rem; margin-top: 0.2rem;
    background: var(--white);
  }
  .checklist li.done .check { background: var(--green-bg); border-color: var(--green); color: var(--green); }

  .instructions { list-style: decimal; margin: 0.9rem 0 0; padding-left: 1.4rem; }
  .instructions li { font-size: 0.96rem; line-height: 1.6; color: var(--ink-soft); padding: 0.4rem 0; }
  .instructions li::marker { font-family: var(--display); font-weight: 700; color: var(--oxford); }

  .item-notes { margin-top: 0.8rem; background: var(--panel); border-radius: var(--radius-sm); padding: 0.75rem 0.95rem; }
  .notes-label { font-family: var(--mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--lime-ink); font-weight: 700; }
  .item-notes p { margin: 0.25rem 0 0; font-size: 0.92rem; color: var(--ink-soft); }
  .empty { color: var(--ink-faint); font-size: 0.94rem; }

  @media (max-width: 34rem) {
    .item-view-row { display: block; }
    .item-dest { display: block; margin-top: 0.4rem; }
    .embed-open-btn { display: flex; width: 100%; }
    .item-badges { margin-left: 0; }
  }
`;

const EMBED_OVERLAY_HTML = `
  <div class="embed-overlay" id="embedOverlay">
    <div class="embed-overlay-bar">
      <span class="embed-title" id="embedTitle"></span>
      <button type="button" class="embed-exit-btn" id="embedExitBtn">Close</button>
    </div>
    <iframe id="embedFrame" src="about:blank" title="Embedded document"></iframe>
  </div>`;

const EMBED_OVERLAY_SCRIPT = `
      var embedOverlay = document.getElementById('embedOverlay');
      var embedFrame = document.getElementById('embedFrame');
      var embedTitle = document.getElementById('embedTitle');
      var embedExitBtn = document.getElementById('embedExitBtn');
      // Matches on [data-embed-src], not the shared .embed-open-btn visual
      // class, because a genuinely external OPEN button reuses that same
      // class for its look but is a plain <a href> with no embed data on
      // it. Selecting by class alone hijacked every external Open click
      // into a broken overlay with src="undefined". Render the real page
      // and click it, rather than assuming the selector is right.
      document.querySelectorAll('[data-embed-src]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          embedFrame.src = btn.dataset.embedSrc;
          embedTitle.textContent = btn.dataset.embedTitle;
          embedOverlay.classList.add('open');
          document.body.style.overflow = 'hidden';
        });
      });
      embedExitBtn.addEventListener('click', function () {
        embedOverlay.classList.remove('open');
        document.body.style.overflow = '';
        embedFrame.src = 'about:blank';
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && embedOverlay.classList.contains('open')) embedExitBtn.click();
      });`;

module.exports = { ITEM_STYLES, EMBED_OVERLAY_HTML, EMBED_OVERLAY_SCRIPT };
