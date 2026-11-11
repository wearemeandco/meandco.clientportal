/* ============================================================
   Me&Co.: decision cards
   ------------------------------------------------------------
   A question on the request board that waits on the client can be one
   of three asks:

     answer    a question in their own words (a text box)
     approve   a draft to look at, Yes or Not yet
     decide    a choice between named options, one tap

   This file is the decide ask, and the quick answer box, shared by the
   request board and the "What we need from you" panel at the top of the
   dashboard, so a decision is made right where the client first sees it.

   Why it exists: a client facing a list of open questions in prose has
   to work out what is being asked, what the choices are, where to reply
   and whether it registered. A decision card answers all four on sight:
   the question, the options as buttons (our pick marked), Something
   else for anything we did not think of, and a tick the moment they tap.

   The tap saves straight to the client's own request record in Blobs
   (portal.js, action request-answer, kind decide), so it is checked off
   on their screen at once and stays checked off. Nobody on our side has
   to update the portal for that to happen. Me&Co. hears about it
   through the same client-request Netlify Form every board answer uses.

   Row shape:
   {
     id, title,              // title is the question, short
     status: 'needs', ask: 'decide',
     why: 'one short line on why it matters',     optional
     seeUrl: 'https://...',  // a page to look at before choosing, optional
     options: [{ label, detail, recommended }],   2 to 4 of them
     other: false            // hide Something else, rare
   }
   ============================================================ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null;
}

function isDecision(item) {
  return !!item && item.status === 'needs' && item.ask === 'decide' && Array.isArray(item.options) && item.options.length > 0;
}

function decisionControlsHtml(item) {
  const id = esc(item.id);
  const see = safeUrl(item.seeUrl);
  const opts = item.options
    .slice(0, 6)
    .map((o) => {
      const label = String((o && o.label) || '').trim();
      if (!label) return '';
      return `<button type="button" class="dc-opt${o.recommended ? ' dc-pick' : ''}" data-dc-choose="${id}" data-dc-choice="${esc(label)}">
          <span class="dc-opt-label">${esc(label)}</span>
          ${o.detail ? `<span class="dc-opt-detail">${esc(o.detail)}</span>` : ''}
          ${o.recommended ? '<span class="dc-pick-chip">Our pick</span>' : ''}
        </button>`;
    })
    .join('');
  const other = item.other === false
    ? ''
    : `<button type="button" class="dc-other-btn" data-dc-other="${id}">${esc(item.otherLabel || 'Something else')}</button>
       <div class="dc-other" hidden>
         <label class="dc-label" for="dc-other-${id}">${esc(item.otherPrompt || 'Tell us in your own words')}</label>
         <textarea id="dc-other-${id}" maxlength="${item.otherLabel ? 4000 : 1000}" placeholder="${esc(item.otherPlaceholder || 'A few words is enough')}"${item.otherLabel ? ' rows="9"' : ''}></textarea>
         <button type="button" class="dc-send" data-dc-send-other="${id}">Send</button>
       </div>`;
  return `<div class="dc" data-dc="${id}">
      ${item.why ? `<p class="dc-why">${esc(item.why)}</p>` : ''}
      ${see ? `<a class="dc-see" href="${esc(see)}" target="_blank" rel="noopener">Look at it first &#8599;</a>` : ''}
      <div class="dc-notes">
        <button type="button" class="dc-notes-btn" data-dc-notes="${id}" aria-expanded="false" aria-controls="dc-note-${id}">Notes</button>
        <div class="dc-notes-box" hidden>
          <label class="dc-label" for="dc-note-${id}">Your notes on this one</label>
          <textarea id="dc-note-${id}" class="dc-note" maxlength="2000" rows="4" placeholder="Anything you want us to know. It goes with your answer."></textarea>
        </div>
      </div>
      <div class="dc-opts" role="group" aria-label="Choose one">${opts}</div>
      ${other}
      <p class="dc-err" role="alert" hidden></p>
    </div>`;
}

/* A plain question, answered in place: one box and one button. */
function quickAnswerHtml(item) {
  const id = esc(item.id);
  return `<div class="dc" data-dc="${id}">
      <label class="dc-label" for="dc-ans-${id}">Your answer</label>
      <textarea id="dc-ans-${id}" maxlength="4000" placeholder="Type here. Short is fine."></textarea>
      <button type="button" class="dc-send" data-dc-send-answer="${id}">Send my answer</button>
      <p class="dc-err" role="alert" hidden></p>
    </div>`;
}

const DECISION_CSS = `
  .dc { display: grid; gap: 0.6rem; margin-top: 0.75rem; }
  .dc-why { margin: 0; color: var(--ink-soft); font-size: 0.95rem; line-height: 1.5; }
  .dc-see { justify-self: start; font-family: var(--display); font-weight: 700; font-size: 0.92rem; color: var(--blue); text-decoration: underline; text-underline-offset: 3px; min-height: 44px; display: inline-flex; align-items: center; }
  .dc-opts { display: grid; gap: 0.5rem; }
  .dc-opt {
    position: relative; display: grid; gap: 0.2rem; text-align: left; width: 100%;
    min-height: 52px; padding: 0.8rem 1rem; cursor: pointer;
    background: var(--white); color: var(--oxford);
    border: var(--rule); border-radius: var(--radius-btn); box-shadow: var(--shadow-hard-sm);
    font-family: var(--sans);
    transition: transform 0.2s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .dc-opt:hover { background: var(--panel); transform: translateY(-2px); box-shadow: var(--shadow-hard); }
  .dc-opt:active { transform: translateY(1px); box-shadow: none; }
  .dc-opt[disabled] { opacity: 0.55; cursor: progress; transform: none; }
  .dc-opt-label { font-family: var(--display); font-weight: 700; font-size: 1rem; line-height: 1.3; padding-right: 5.5rem; }
  .dc-opt-detail { font-size: 0.88rem; color: var(--ink-soft); line-height: 1.45; }
  .dc-pick { border-color: var(--blue); }
  .dc-pick-chip {
    position: absolute; top: 0.75rem; right: 0.8rem;
    font-family: var(--mono); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    background: var(--blue); color: var(--white); border-radius: var(--radius-pill); padding: 0.2rem 0.45rem;
  }
  .dc-other-btn {
    justify-self: start; min-height: 44px; padding: 0.4rem 0.2rem; background: none; border: 0; cursor: pointer;
    font-family: var(--display); font-weight: 700; font-size: 0.92rem; color: var(--oxford);
    text-decoration: underline; text-underline-offset: 3px;
  }
  .dc-other { display: grid; gap: 0.5rem; }
  .dc-notes { display: grid; gap: 0.5rem; }
  .dc-notes-btn { justify-self: start; font-family: var(--display); font-weight: 700; font-size: 0.85rem; min-height: 40px; padding: 0.35rem 1rem; border-radius: var(--radius-btn); border: var(--rule); background: var(--white); color: var(--oxford); cursor: pointer; box-shadow: var(--shadow-hard-sm); }
  .dc-notes-btn[aria-expanded="true"] { background: var(--lavender); }
  .dc-notes-btn:focus-visible { outline: 3px solid var(--oxford); outline-offset: 2px; }
  .dc-notes-box { display: grid; gap: 0.4rem; }
  .dc-notes-box textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 0.95rem; border: var(--rule); border-radius: var(--radius-sm); padding: 0.6rem 0.7rem; background: var(--paper); color: var(--ink); resize: vertical; }
  .dc-note-shown { margin: 0.3rem 0 0; font-size: 0.9rem; color: var(--ink-soft); }
  .dc-other[hidden] { display: none; }
  .dc-label { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--oxford); }
  .dc textarea {
    width: 100%; min-height: 5.5rem; padding: 0.7rem 0.8rem; font: inherit; font-size: 1rem; color: var(--ink);
    background: var(--white); border: var(--rule); border-radius: var(--radius-sm); resize: vertical;
  }
  .dc-send {
    justify-self: start; min-height: 48px; padding: 0.55rem 1.3rem; cursor: pointer;
    font-family: var(--display); font-weight: 700; font-size: 0.95rem;
    background: var(--oxford); color: var(--white); border: var(--rule); border-radius: var(--radius-btn);
  }
  .dc-send[disabled] { opacity: 0.55; cursor: progress; }
  .dc-err { margin: 0; color: #a3271b; font-size: 0.9rem; }
  .dc-err[hidden] { display: none; }
  .dc-done {
    display: flex; gap: 0.6rem; align-items: flex-start; margin-top: 0.75rem;
    padding: 0.8rem 1rem; background: var(--green-bg); border: 1.5px solid var(--green); border-radius: var(--radius-btn);
    color: var(--green); font-weight: 600; line-height: 1.45;
  }
  .dc-done .dc-tick { font-size: 1.15rem; line-height: 1.2; }
  .dc-done strong { color: var(--oxford); }
  .need-row.is-done .need-title { text-decoration: line-through; text-decoration-thickness: 2px; color: var(--ink-faint); }
`;

/* Browser side. Expects BOOT-like values passed in, and posts exactly
   what the request board posts: the save to the portal function first,
   then the notification to the client-request form. A failed
   notification never undoes the save, the choice is already on the
   client's record. */
function decisionScript(slug, clientName) {
  return `
(function () {
  var SLUG = ${JSON.stringify(String(slug))};
  var CLIENT = ${JSON.stringify(String(clientName || ''))};
  var PORTAL = '/.netlify/functions/portal?slug=' + encodeURIComponent(SLUG);
  var BOARD = 'https://clients.weareme.co/portal/' + encodeURIComponent(SLUG) + '/requests';
  function save(body) {
    return fetch(PORTAL, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || !j.ok) throw new Error((j && j.error) || 'That did not save. Please try again in a moment.');
          return j;
        });
      });
  }
  function tell(fields) {
    var fd = new FormData();
    fd.append('form-name', 'client-request');
    fd.append('client', CLIENT);
    fd.append('slug', SLUG);
    fd.append('board', BOARD);
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k] == null ? '' : fields[k]); });
    return fetch('/forms/client-request.html', { method: 'POST', body: fd }).catch(function () {});
  }
  function boxFor(id) { return document.querySelector('[data-dc="' + CSS.escape(id) + '"]'); }
  function titleFor(box) {
    var row = box.closest('[data-dc-title]');
    return row ? row.getAttribute('data-dc-title') : '';
  }
  function lock(box, on) { box.querySelectorAll('button, textarea').forEach(function (el) { el.disabled = on; }); }
  function fail(box, msg) { var e = box.querySelector('.dc-err'); e.textContent = msg; e.hidden = false; lock(box, false); }
  function finish(box, html) {
    var done = document.createElement('div');
    done.className = 'dc-done';
    done.setAttribute('role', 'status');
    done.innerHTML = '<span class="dc-tick" aria-hidden="true">&#10003;</span><span>' + html + '</span>';
    box.replaceWith(done);
    var row = done.closest('.need-row');
    if (row) {
      row.classList.add('is-done');
      var btn = row.querySelector('.need-btn'); if (btn) btn.remove();
    }
  }
  function text(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function noteOf(box) { var t = box && box.querySelector('.dc-note'); return t ? t.value.trim() : ''; }
  function send(id, kind, choice, note, okHtml) {
    var box = boxFor(id); if (!box) return;
    box.querySelector('.dc-err').hidden = true;
    lock(box, true);
    save({ action: 'request-answer', id: id, kind: kind, text: choice, note: note || '' })
      .then(function () {
        tell({ kind: kind === 'decide' ? 'decision' : 'answer', requestId: id, request: titleFor(box), note: note ? choice + '. ' + note : choice });
        finish(box, okHtml);
      })
      .catch(function (ex) { fail(box, ex.message); });
  }
  document.addEventListener('click', function (e) {
    var nb = e.target.closest('[data-dc-notes]');
    if (nb) {
      var nbox = nb.parentNode.querySelector('.dc-notes-box');
      var open = nbox.hidden;
      nbox.hidden = !open; nb.setAttribute('aria-expanded', String(open));
      if (open) nbox.querySelector('textarea').focus();
      return;
    }
    var opt = e.target.closest('[data-dc-choose]');
    if (opt) {
      var c = opt.getAttribute('data-dc-choice');
      var nt = noteOf(opt.closest('.dc'));
      return send(opt.getAttribute('data-dc-choose'), 'decide', c, nt, 'Decided: <strong>' + text(c) + '</strong>.' + (nt ? ' Your note: ' + text(nt) + '.' : '') + ' Thank you, that is checked off.');
    }
    var oth = e.target.closest('[data-dc-other]');
    if (oth) {
      var panel = oth.parentNode.querySelector('.dc-other');
      panel.hidden = false; oth.hidden = true; panel.querySelector('textarea').focus();
      return;
    }
    var so = e.target.closest('[data-dc-send-other]');
    if (so) {
      var b1 = so.closest('.dc'); var v1 = b1.querySelector('.dc-other textarea').value.trim();
      if (!v1) return fail(b1, 'Type a few words first.');
      var n1 = noteOf(b1);
      return send(so.getAttribute('data-dc-send-other'), 'decide', 'Something else', n1 ? v1 + ' Notes: ' + n1 : v1, 'Got it: <strong>' + text(v1) + '</strong>. Thank you, that is checked off.');
    }
    var sa = e.target.closest('[data-dc-send-answer]');
    if (sa) {
      var b2 = sa.closest('.dc'); var v2 = b2.querySelector('textarea').value.trim();
      if (!v2) return fail(b2, 'Type your answer first.');
      return send(sa.getAttribute('data-dc-send-answer'), 'answer', v2, '', 'Answered. Thank you, that is checked off.');
    }
  });
})();`;
}

module.exports = { isDecision, decisionControlsHtml, quickAnswerHtml, DECISION_CSS, decisionScript };
