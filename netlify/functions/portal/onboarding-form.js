/* ============================================================
   Me&Co. — dedicated onboarding form page
   ------------------------------------------------------------
   Its own page, not crammed into the dashboard accordion, because a
   page of its own is less overwhelming to fill in.
   A real Netlify Form (see dashboard.js's own
   comment on the same pattern for the shadow-file mechanics), with
   a review step before the real submit: fill in, review what you
   wrote, then send. No answers get silently submitted.

   The form name is client-scoped, "onboarding-questions-<slug>",
   same SOP as any custom form Bob builds for any stage that needs
   structured input from a client, not just Onboarding. Every such
   form needs a matching hidden shadow form added to
   public/forms/onboarding-questions.html (or its own shadow file)
   so Netlify's build-time scanner registers it, or a real submission
   fails silently instead of failing loudly.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('./theme.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOnboardingForm(client, card, savedAnswers) {
  const saved = savedAnswers || {};
  // Scoped to the card, not just the client. A client-only name collides
  // the moment a second onboarding-style card exists on the same account
  // (a real Project 3, say), silently dropping fields Netlify never saw
  // registered under that name, the same failure shape as a card-id
  // collision one layer up. Render the real page and check the form
  // name before shipping a new card.
  const formName = card.id + '-' + client.slug;
  const items = (card.items || []).filter((i) => i.type === 'text');
  const fields = items
    .map(
      (i) => `
    <label class="field">
      <span class="field-title">${escapeHtml(i.title)}</span>
      ${i.checklist && i.checklist.length ? `<ul class="field-questions">${i.checklist.map((c) => `<li>${escapeHtml(c.text)}</li>`).join('')}</ul>` : ''}
      <textarea name="${escapeHtml(i.id)}" rows="4" data-field-title="${escapeHtml(i.title)}">${escapeHtml(saved[i.id] || '')}</textarea>
    </label>`
    )
    .join('');

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

  header { background: var(--white); border-bottom: var(--rule-strong); padding: clamp(1.1rem, 4vw, 1.8rem) clamp(1.1rem, 5vw, 2.2rem) clamp(1.2rem, 4vw, 1.6rem); }
  .header-inner { max-width: 40rem; margin: 0 auto; }
  .back {
    display: inline-flex; align-items: center; gap: 0.35rem; min-height: 44px;
    font-family: var(--display); font-size: 0.95rem; font-weight: 700; color: var(--oxford); text-decoration: none;
  }
  .back:hover { text-decoration: underline; }
  h1 { font-weight: 800; font-size: clamp(1.45rem, 5.5vw, 1.95rem); margin: 0.4rem 0 0; letter-spacing: -0.015em; }
  p.lead { color: var(--ink-soft); margin: 0.6rem 0 0; font-size: 0.94rem; max-width: 40rem; }
  main { max-width: 40rem; margin: 0 auto; padding: clamp(1.2rem, 4vw, 2rem) clamp(1.1rem, 5vw, 2.2rem) 4rem; }
  .sheet {
    background: var(--white); border: var(--rule); border-radius: var(--radius);
    box-shadow: var(--shadow-hard); padding: clamp(1.1rem, 5vw, 1.9rem);
    animation: fadeUp 0.6s var(--ease-out) backwards;
  }

  .field { display: block; margin-bottom: 1.6rem; }
  .field-title { display: block; font-family: var(--display); font-weight: 700; font-size: 1rem; color: var(--oxford); margin-bottom: 0.4rem; }
  .field-questions { margin: 0 0 0.6rem; padding-left: 1.2rem; color: var(--ink-soft); font-size: 0.86rem; }
  .field-questions li { margin-top: 0.3rem; }
  textarea {
    width: 100%; font-family: var(--sans); font-size: 16px; color: var(--ink);
    background: var(--paper); border: var(--rule-soft); border-radius: var(--radius-sm);
    padding: 0.8rem 0.9rem; resize: vertical; outline: none;
  }
  textarea:focus { border-color: var(--oxford); background: var(--white); }
  .primary-btn {
    font-family: var(--display); font-weight: 700; font-size: 0.95rem; color: var(--white);
    background: var(--oxford); border: var(--rule-strong); border-radius: var(--radius-btn);
    min-height: 48px; padding: 0.75rem 1.5rem; cursor: pointer; box-shadow: var(--shadow-hard);
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .primary-btn:hover { background: #061529; transform: translateY(-2px); box-shadow: var(--shadow-hard-lg); }
  .primary-btn:active { transform: translateY(2px); box-shadow: 0 0 0 0 var(--oxford); }
  .secondary-btn {
    font-family: var(--display); font-weight: 700; font-size: 0.95rem; color: var(--oxford);
    background: var(--white); border: var(--rule); border-radius: var(--radius-btn);
    min-height: 48px; padding: 0.7rem 1.4rem; cursor: pointer; box-shadow: var(--shadow-hard-sm);
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .secondary-btn:hover { background: var(--panel); transform: translateY(-2px); box-shadow: var(--shadow-hard); }
  .secondary-btn:active { transform: translateY(2px); box-shadow: 0 0 0 0 var(--oxford); }
  .save-error {
    background: #FBEDE7; border: 1.5px solid #E8B7A2; color: #8f3517;
    border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 14px; font-size: 0.92rem;
  }
  .save-error[hidden] { display: none; }
  .btn-row { display: flex; gap: 0.8rem; margin-top: 1rem; flex-wrap: wrap; }

  #review[hidden], #fill[hidden] { display: none; }
  .review-item { margin-bottom: 1.4rem; padding-bottom: 1.4rem; border-bottom: var(--rule-soft); }
  .review-item:last-of-type { border-bottom: none; }
  .review-item h3 { font-family: var(--display); font-size: 0.95rem; color: var(--oxford); margin: 0 0 0.4rem; }
  .review-item p { margin: 0; font-size: 0.92rem; color: var(--ink); white-space: pre-wrap; }
  .review-item p.blank { color: var(--ink-faint); font-style: italic; }
  .review-note {
    background: var(--paper); border: var(--rule-soft); border-radius: var(--radius-sm);
    padding: 0.9rem 1.1rem; margin-bottom: 1.6rem; font-size: 0.9rem; color: var(--ink-soft);
  }
</style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="mark"><span class="dot"></span>Me&Co.</div>
      <a class="back" href="/portal/${escapeHtml(client.slug)}">&larr; Back to your portal</a>
      <h1>${escapeHtml(card.label)}</h1>
      <p class="lead">${escapeHtml(card.formLead || "A few questions so what gets built matches exactly what you need. Fill in what you can, and you'll get a chance to look everything over before it sends.")}</p>
    </div>
  </header>
  <main>
   <div class="sheet">
    <form name="${escapeHtml(formName)}" method="POST" data-netlify="true" action="/forms/thanks.html?slug=${encodeURIComponent(client.slug)}" id="onboarding-form">
      <input type="hidden" name="form-name" value="${escapeHtml(formName)}" />
      <input type="hidden" name="client" value="${escapeHtml(client.name || '')}" />
      <input type="hidden" name="cardId" value="${escapeHtml(card.id)}" />
      <div id="fill">
        ${fields}
        <div class="btn-row">
          <button type="button" class="primary-btn" id="to-review">Review my answers</button>
        </div>
      </div>
      <div id="review" hidden>
        <div class="review-note">Take a look before this sends. Go back to change anything, nothing is sent until you confirm below.</div>
        <div id="review-list"></div>
        <div class="save-error" id="save-error" role="alert" hidden></div>
        <div class="btn-row">
          <button type="button" class="secondary-btn" id="back-to-edit">&larr; Edit answers</button>
          <button type="submit" class="primary-btn">Confirm and send</button>
        </div>
      </div>
    </form>
   </div>
  </main>
  <script>
    (function () {
      var form = document.getElementById('onboarding-form');
      var fillView = document.getElementById('fill');
      var reviewView = document.getElementById('review');
      var reviewList = document.getElementById('review-list');
      document.getElementById('to-review').addEventListener('click', function () {
        var rows = [];
        form.querySelectorAll('textarea').forEach(function (ta) {
          var title = ta.dataset.fieldTitle;
          var value = ta.value.trim();
          rows.push(
            '<div class="review-item"><h3>' + title + '</h3><p' + (value ? '' : ' class="blank"') + '>' +
            (value ? value.replace(/</g, '&lt;') : 'Left blank') + '</p></div>'
          );
        });
        reviewList.innerHTML = rows.join('');
        fillView.setAttribute('hidden', '');
        reviewView.removeAttribute('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      document.getElementById('back-to-edit').addEventListener('click', function () {
        reviewView.setAttribute('hidden', '');
        fillView.removeAttribute('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // The answers are saved into the client's own portal first, then the
      // form posts to Netlify so the notification email still fires.
      // Netlify must never be the only destination: a client who answers
      // every question and then finds their card still reading "not
      // started", with no way to see or change what they wrote, has been
      // told we lost their work.
      var slug = ${JSON.stringify(client.slug)};
      var cardId = ${JSON.stringify(card.id)};
      function collect() {
        var out = {};
        form.querySelectorAll('textarea').forEach(function (ta) {
          if (ta.name) out[ta.name] = ta.value;
        });
        return out;
      }
      // fetch only rejects on a network error, so a 401 or a 500 used to
      // resolve normally and the catch never fired. A client could type
      // for an hour against a dead session, see nothing, press send, and
      // be shown a thank you page while their answers went nowhere.
      function save(submitted) {
        return fetch('/.netlify/functions/portal?slug=' + encodeURIComponent(slug), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: 'save-onboarding', cardId: cardId, answers: collect(), submit: !!submitted }),
        }).then(function (res) {
          if (!res.ok) {
            return res.json().catch(function () { return {}; }).then(function (body) {
              var err = new Error((body && body.error) || 'That did not save.');
              err.status = res.status;
              throw err;
            });
          }
          return res.json();
        });
      }

      function showError(message) {
        var box = document.getElementById('save-error');
        if (!box) return;
        box.textContent = message;
        box.removeAttribute('hidden');
      }
      function clearError() {
        var box = document.getElementById('save-error');
        if (box) box.setAttribute('hidden', '');
      }

      // Autosave when a field loses focus, so a closed tab does not cost
      // someone an hour of typing. Failures here are deliberately silent:
      // the real save happens on submit, and a scary message about a
      // background autosave would be worse than the thing it reports.
      // Autosave stays quiet about transient failures, since the real save
      // happens on submit, but an expired session is worth saying out loud
      // straight away rather than letting someone keep typing into a void.
      form.querySelectorAll('textarea').forEach(function (ta) {
        ta.addEventListener('blur', function () {
          save(false).then(clearError).catch(function (err) {
            if (err && err.status === 401) {
              showError('Your session has expired, so nothing is being saved. Open your portal link again in a new tab, then come back and press send.');
            }
          });
        });
      });

      // On submit the save must actually succeed before the client is sent
      // to a thank you page. Previously a failed save fell straight through
      // to form.submit() and the page said everything went fine.
      var submitted = false;
      form.addEventListener('submit', function (e) {
        if (submitted) return;
        e.preventDefault();
        clearError();
        var btn = form.querySelector('button[type="submit"]');
        var label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        save(true)
          .then(function () { submitted = true; form.submit(); })
          .catch(function (err) {
            if (btn) { btn.disabled = false; btn.textContent = label; }
            showError(
              (err && err.status === 401)
                ? 'Your session has expired, so this did not send. Open your portal link again, then press send.'
                : 'This did not send, and nothing has been lost. Please try again in a moment, or reply to any email from us and we will take it from there.'
            );
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          });
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderOnboardingForm };
