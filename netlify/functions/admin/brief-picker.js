/* ============================================================
   Me&Co., admin: build this client's brief
   ------------------------------------------------------------
   This page is the mechanism that makes stage 2 customised rather
   than generic. After a real discovery call, Melody opens
   /admin/<slug>/brief, ticks the sections that actually came up,
   drops individual questions that do not apply, writes a one line
   note in her own voice, and saves. Only what she ticked renders
   at /portal/<slug>/brief.

   Nothing here invents questions. Everything offered comes out of
   data/discovery-bank.json, which is a plain editable file: adding
   a question to the bank makes it selectable here on the next
   request, with no code change.

   Also here, because it is the other half of the same loop:
   /admin/inquiries, the real list of stage 1 submissions and magic
   link requests. An inquiry that lands nowhere a human looks is the
   same as no inquiry at all.
   ============================================================ */

const { allSections, defaultSections, resolveBrief, fieldKey, resolveVariant } = require('../portal/discovery-bank.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">`;

const STYLE = `
  :root {
    --oxford:#22315E; --blue:#2A4FBF; --blue-ink:#1E3A94; --lime:#F3C7B8; --lime-ink:#6f8a05;
    --paper:#FAF8F2; --white:#fff; --panel:#F1EEE3; --panel-2:#E4E0D0;
    --ink:#1a1a1a; --ink-soft:#4a4638; --ink-faint:#7c7767; --green:#4a7a1e; --green-bg:#EAF6E1;
    --sans:'DM Sans',-apple-system,sans-serif; --display:'Fraunces',sans-serif; --mono:'JetBrains Mono',monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); line-height: 1.6; }
  header { padding: 1.4rem clamp(1.2rem, 5vw, 3rem); background: var(--white); border-bottom: 1px solid var(--panel-2); }
  .kicker { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--lime-ink); font-weight: 700; margin: 0.4rem 0 0.2rem; }
  h1 { font-family: var(--display); font-weight: 800; font-size: clamp(1.4rem, 4vw, 1.9rem); margin: 0; color: var(--oxford); }
  h2 { font-family: var(--display); color: var(--oxford); font-size: 1.15rem; margin: 2rem 0 0.4rem; }
  .back { font-family: var(--mono); font-size: 0.74rem; font-weight: 700; color: var(--blue-ink); }
  main { max-width: 58rem; margin: 0 auto; padding: 1.6rem clamp(1.2rem, 5vw, 3rem) 7rem; }
  .lead { color: var(--ink-soft); font-size: 0.95rem; max-width: 60ch; }

  .sec {
    background: var(--white); border: 1px solid var(--panel-2); border-radius: 14px;
    margin-top: 0.8rem; overflow: hidden;
  }
  .sec.on { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(30,69,251,0.12); }
  .sec-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; cursor: pointer; }
  .sec-head input { width: 20px; height: 20px; margin-top: 3px; flex: none; accent-color: var(--blue); }
  .sec-head b { font-family: var(--display); font-size: 1.02rem; color: var(--oxford); display: block; }
  .sec-head span { display: block; color: var(--ink-soft); font-size: 0.87rem; }
  .sec-head .count { font-family: var(--mono); font-size: 0.68rem; color: var(--ink-faint); margin-left: auto; white-space: nowrap; }
  .qs { display: none; padding: 0 18px 16px 50px; }
  .sec.on .qs { display: block; }
  .q { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; border-top: 1px solid var(--panel); font-size: 0.9rem; color: var(--ink-soft); }
  .q input { width: 17px; height: 17px; margin-top: 3px; flex: none; accent-color: var(--blue); }
  .q.off { opacity: 0.45; text-decoration: line-through; }

  .tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 1rem; }
  select, textarea, input[type="text"] {
    font-family: var(--sans); font-size: 15px; color: var(--ink); background: var(--white);
    border: 1px solid var(--panel-2); border-radius: 10px; padding: 10px 12px; min-height: 44px;
  }
  textarea { width: 100%; resize: vertical; }
  .btn {
    font-family: var(--display); font-weight: 700; font-size: 0.9rem; min-height: 44px;
    border: 1.5px solid var(--oxford); background: none; color: var(--oxford); border-radius: 999px;
    padding: 10px 20px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
  }
  .btn.solid { background: var(--oxford); color: var(--white); }
  .btn.solid:hover { background: #061529; }
  .btn[disabled] { opacity: 0.5; pointer-events: none; }
  .savebar {
    position: fixed; bottom: 0; left: 0; right: 0; background: var(--white); border-top: 1px solid var(--panel-2);
    padding: 12px clamp(1.2rem, 5vw, 3rem); display: flex; gap: 12px; align-items: center; justify-content: space-between;
  }
  .savebar .status { font-family: var(--mono); font-size: 0.72rem; color: var(--ink-faint); }
  table { width: 100%; border-collapse: collapse; margin-top: 0.8rem; background: var(--white); border-radius: 12px; overflow: hidden; }
  th, td { text-align: left; padding: 11px 14px; border-bottom: 1px solid var(--panel-2); font-size: 0.88rem; vertical-align: top; }
  th { font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
  td.small { font-family: var(--mono); font-size: 0.72rem; color: var(--ink-faint); white-space: nowrap; }
  .pill { display: inline-block; font-family: var(--mono); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: var(--panel); color: var(--ink-soft); }
  .pill.lead { background: var(--lime); color: #3d4d02; }
  .pill.link { background: var(--green-bg); color: var(--green); }
  .answers { background: var(--white); border: 1px solid var(--panel-2); border-radius: 14px; padding: 18px; margin-top: 0.8rem; }
  .answers dt { font-size: 0.84rem; color: var(--ink-faint); margin-top: 0.7rem; }
  .answers dd { margin: 0.15rem 0 0; white-space: pre-wrap; }
  code { font-family: var(--mono); font-size: 0.78rem; word-break: break-all; }`;

function renderBriefPicker(client, state) {
  const brief = (state && state.brief) || {};
  const variant = resolveVariant(brief.variant);
  const chosen = Array.isArray(brief.sections) && brief.sections.length ? brief.sections : defaultSections(variant);
  const excluded = brief.excluded || [];
  const answers = (state && state.briefAnswers) || null;

  const sections = allSections(variant)
    .map((s) => {
      const on = chosen.indexOf(s.id) !== -1;
      const qs = s.fields
        .map((f) => {
          const key = fieldKey(s.id, f.id);
          const off = excluded.indexOf(key) !== -1;
          return `
          <label class="q${off ? ' off' : ''}" data-qwrap="${escapeHtml(key)}">
            <input type="checkbox" data-question="${escapeHtml(key)}"${off ? '' : ' checked'}>
            <span>${escapeHtml(f.label || f.id)}${f.required ? ' <em>(required in the form)</em>' : ''}</span>
          </label>`;
        })
        .join('');
      return `
      <div class="sec${on ? ' on' : ''}" data-sec="${escapeHtml(s.id)}">
        <label class="sec-head">
          <input type="checkbox" data-section="${escapeHtml(s.id)}"${on ? ' checked' : ''}>
          <span>
            <b>${escapeHtml(s.title)}</b>
            <span>${escapeHtml(s.blurb || '')}</span>
          </span>
          <span class="count">${s.fields.length} q</span>
        </label>
        <div class="qs">${qs}</div>
      </div>`;
    })
    .join('');

  const resolved = resolveBrief(state);

  const answersBlock = answers
    ? `
    <h2>What they sent back</h2>
    <p class="lead">${
      answers.submittedAt
        ? 'Submitted ' + escapeHtml(String(answers.submittedAt).slice(0, 16).replace('T', ' ')) + '.'
        : 'Not submitted yet, this is an in progress autosave from ' + escapeHtml(String(answers.updatedAt || '').slice(0, 16).replace('T', ' ')) + '.'
    }</p>
    <div class="answers"><dl>${Object.keys(answers.answers || {})
      .filter((k) => answers.answers[k])
      .map((k) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(answers.answers[k])}</dd>`)
      .join('')}</dl></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Brief sections &middot; ${escapeHtml(client.name || client.slug)}</title>
${HEAD}<style>${STYLE}</style>
</head>
<body>
  <header>
    <a class="back" href="/admin/${escapeHtml(client.slug)}">&larr; ${escapeHtml(client.name || client.slug)}</a>
    <p class="kicker">Stage 2, after the discovery call</p>
    <h1>Build this client's brief</h1>
  </header>
  <main>
    <p class="lead">Tick the sections that actually came up on the call. Untick any single question that does not apply. What is left is exactly what they see, nothing more. They currently have <b id="live-count">${resolved.fieldCount}</b> question${resolved.fieldCount === 1 ? '' : 's'} across <b>${resolved.sections.length}</b> section${resolved.sections.length === 1 ? '' : 's'}, out of ${resolved.totalFieldCount} in the whole bank${resolved.customised ? '' : ', and nothing has been chosen for them yet, so this is still the full default set'}.</p>

    <div class="tools">
      <label>Vocabulary
        <select id="org-type">
          <option value="nonprofit"${variant === 'nonprofit' ? ' selected' : ''}>Nonprofit wording</option>
          <option value="business"${variant === 'business' ? ' selected' : ''}>Business wording</option>
        </select>
      </label>
      <button class="btn" type="button" id="apply-defaults">Select every section</button>
      <button class="btn" type="button" id="clear-all">Clear all</button>
      <a class="btn" href="/portal/${escapeHtml(client.slug)}/brief" target="_blank" rel="noopener">Preview what they see &rarr;</a>
    </div>

    <h2>A note in your own words</h2>
    <p class="lead">Shown at the top of their brief. One or two lines referring to the actual call is what makes it read as built for them.</p>
    <textarea id="brief-note" rows="3" placeholder="Rochelle, this is the short version we talked about Tuesday. I dropped everything about events since that is on hold.">${escapeHtml(brief.note || '')}</textarea>

    <h2>Sections</h2>
    ${sections}
    ${answersBlock}
  </main>
  <div class="savebar">
    <span class="status" id="status">Nothing saved yet this visit.</span>
    <button class="btn solid" id="save">Save this brief</button>
  </div>
  <script>
  (function () {
    var SLUG = ${JSON.stringify(client.slug)};
    var DEFAULTS = ${JSON.stringify({ nonprofit: defaultSections('nonprofit'), business: defaultSections('business') })};

    function syncSection(sec) {
      var box = sec.querySelector('[data-section]');
      sec.classList.toggle('on', box.checked);
    }
    document.addEventListener('change', function (e) {
      var sec = e.target.closest('.sec');
      if (sec) syncSection(sec);
      if (e.target.hasAttribute && e.target.hasAttribute('data-question')) {
        var wrap = e.target.closest('[data-qwrap]');
        if (wrap) wrap.classList.toggle('off', !e.target.checked);
      }
      updateCount();
    });

    function updateCount() {
      var n = 0;
      [].slice.call(document.querySelectorAll('.sec')).forEach(function (sec) {
        if (!sec.querySelector('[data-section]').checked) return;
        n += sec.querySelectorAll('[data-question]:checked:not([disabled])').length;
      });
      document.getElementById('live-count').textContent = n;
    }

    document.getElementById('apply-defaults').addEventListener('click', function () {
      var set = DEFAULTS[document.getElementById('org-type').value] || [];
      [].slice.call(document.querySelectorAll('.sec')).forEach(function (sec) {
        var box = sec.querySelector('[data-section]');
        box.checked = set.indexOf(sec.getAttribute('data-sec')) !== -1;
        syncSection(sec);
      });
      [].slice.call(document.querySelectorAll('[data-question]:not([disabled])')).forEach(function (q) {
        q.checked = true;
        q.closest('[data-qwrap]').classList.remove('off');
      });
      updateCount();
    });

    document.getElementById('clear-all').addEventListener('click', function () {
      [].slice.call(document.querySelectorAll('[data-section]')).forEach(function (b) { b.checked = false; syncSection(b.closest('.sec')); });
      updateCount();
    });

    var saveBtn = document.getElementById('save');
    saveBtn.addEventListener('click', function () {
      var sections = [];
      var excluded = [];
      [].slice.call(document.querySelectorAll('.sec')).forEach(function (sec) {
        var id = sec.getAttribute('data-sec');
        if (sec.querySelector('[data-section]').checked) sections.push(id);
        [].slice.call(sec.querySelectorAll('[data-question]')).forEach(function (q) {
          if (!q.checked && !q.disabled) excluded.push(q.getAttribute('data-question'));
        });
      });
      var status = document.getElementById('status');
      saveBtn.disabled = true;
      status.textContent = 'Saving...';
      fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-brief',
          slug: SLUG,
          brief: {
            sections: sections,
            excluded: excluded,
            variant: document.getElementById('org-type').value,
            note: document.getElementById('brief-note').value
          }
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          saveBtn.disabled = false;
          status.textContent = r.ok ? ('Saved. ' + sections.length + ' sections live for this client.') : (r.error || 'Did not save.');
        })
        .catch(function () { saveBtn.disabled = false; status.textContent = 'Did not save, try again.'; });
    });

    updateCount();
  })();
  </script>
</body>
</html>`;
}

function renderInquiryList(records) {
  const inquiries = records.filter((r) => r.type === 'inquiry');
  const links = records.filter((r) => r.type === 'magic-link');

  const inquiryRows = inquiries.length
    ? inquiries
        .map(
          (r) => `
      <tr>
        <td class="small">${escapeHtml(String(r.createdAt || '').slice(0, 16).replace('T', ' '))}</td>
        <td><b>${escapeHtml(r.org || '')}</b><br>${escapeHtml(r.name || '')}<br><a href="mailto:${escapeHtml(r.email || '')}">${escapeHtml(r.email || '')}</a>${
            r.phone ? '<br>' + escapeHtml(r.phone) : ''
          }</td>
        <td>${
          r.qualified === false
            ? '<span class="pill lead">Needs review</span> <span class="small">' +
              escapeHtml((r.qualificationReasons || []).join('; ')) +
              '</span><br>'
            : r.qualified === true && r.bookingLinkSent === false
              ? '<span class="pill lead">Send the link by hand</span> <span class="small">' +
                escapeHtml(r.bookingLinkNote || '') +
                '</span><br>'
              : ''
        }${escapeHtml(r.need || '')}${r.site ? '<br><code>' + escapeHtml(r.site) + '</code>' : ''}${
            r.urgent ? '<br><span class="pill lead">Urgent</span> ' + escapeHtml(r.urgent) : ''
          }</td>
        <td>${escapeHtml(r.budget || 'not said')}<br><span class="small">${escapeHtml(r.timeline || '')}</span>${
            r.deadlineReason ? '<br>' + escapeHtml(r.deadlineReason) : ''
          }</td>
        <td>${escapeHtml(r.orgType || '')}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="5">No inquiries yet.</td></tr>';

  const linkRows = links.length
    ? links
        .map(
          (r) => `
      <tr>
        <td class="small">${escapeHtml(String(r.createdAt || '').slice(0, 16).replace('T', ' '))}</td>
        <td>${escapeHtml(r.email || '')}</td>
        <td>${r.slug ? '<span class="pill link">' + escapeHtml(r.slug) + '</span>' : '<span class="pill">no match</span>'}</td>
        <td>${r.url ? '<code>' + escapeHtml(r.url) + '</code>' : 'no link minted'}</td>
        <td class="small">${escapeHtml(String(r.expiresAt || '').slice(0, 10))}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="5">No sign in link requests yet.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Inquiries &middot; Me&Co. Admin</title>
${HEAD}<style>${STYLE}</style>
</head>
<body>
  <header>
    <a class="back" href="/admin">&larr; All clients</a>
    <p class="kicker">Stage 1</p>
    <h1>Inquiries and sign in links</h1>
  </header>
  <main>
    <h2>Inquiries</h2>
    <p class="lead">Everything submitted at /start/inquiry. The next real step on any of these is a booked call, not a proposal.</p>
    <table>
      <tr><th>When</th><th>Who</th><th>What they need</th><th>Budget and timing</th><th>Type</th></tr>
      ${inquiryRows}
    </table>

    <h2>Sign in link requests</h2>
    <p class="lead">Nothing here was emailed. Copy the link and send it yourself, the way every other client-facing message goes out. Links expire on their own after 7 days.</p>
    <table>
      <tr><th>When</th><th>Email</th><th>Matched</th><th>Link</th><th>Expires</th></tr>
      ${linkRows}
    </table>
  </main>
</body>
</html>`;
}

module.exports = { renderBriefPicker, renderInquiryList };
