/* ============================================================
   Me&Co. — portal dashboard renderer
   ------------------------------------------------------------
   Grouped by project, accordion sections, each card its own
   accordion inside its project.

   The page holds to two things.

   1. It looks like Me&Co.. The invoices and receipts in
      public/ set the studio's visual language (Syne + Prompt, paper
      ground, soft-shadowed white document, hairline rules, lime dot
      wordmark), and the portal shares one theme file with those
      documents, see theme.js. One accent colour at a time.

   2. It answers the only three questions a client has: what is
      happening, what do you need from me, what do I do next.
      Collapsed accordions answer none of them, so the page opens
      with the things actually waiting on the client, computed from
      real card state, and every project carries its own latest real
      activity line.

   This file is presentation only. It changes no client's content,
   figures, dates, or card structure. The one thing it reorders is
   also presentation: the activity log is sorted newest first at
   render time, because the stored array is not guaranteed to be in
   date order.
   ============================================================ */

const { itemRowHtml, cardMode } = require('./card-detail.js');
const { ITEM_STYLES, EMBED_OVERLAY_HTML, EMBED_OVERLAY_SCRIPT } = require('./item-styles.js');
const { FONT_LINK, TOKENS, BASE } = require('./theme.js');
const { renderRequestsSection, isVisible: requestsVisible } = require('./requests-board.js');
const { renderFilesSection } = require('./files-page.js');
const { WELCOME_CSS, welcomeHtml, welcomeScript, WELCOME_AGAIN_HTML } = require('./welcome.js');
const { REVIEW_CSS, REVIEW_SCRIPT, reviewFormHtml } = require('./review-form.js');
const { isDecision, DECISION_CSS, decisionScript } = require('./decision-card.js');
const { needsStepperHtml, STEPPER_CSS, stepperScript } = require('./needs-stepper.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Plain language, because Antonio runs his business off a phone and
// should never have to work out what a label means.
//
// Keep every label to one or two words. The pills are mono uppercase,
// and at that weight a three-word label wraps on a 360px screen, which
// reads as broken rather than as scheduled. Tone is carried by the
// pill's colour instead, lavender for in flight and a quiet outline for
// not started.
const STATUS_LABEL = {
  complete: 'Complete',
  in_progress: 'In progress',
  not_started: 'Not started',
  locked: 'Locked',
};

function groupByProject(cards) {
  const order = [];
  const groups = {};
  (cards || []).forEach((card) => {
    const key = card.project || 'Other';
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(card);
  });
  return order.map((key) => ({ project: key, cards: groups[key] }));
}

// A running notes log has no finish line, so "complete" and a 0/1 count
// are meaningless on it. card.noStatus opts a card out of both the pill
// badge and the project-level count, generic so any card of that shape
// (a log, not a deliverable) can use the same flag.
function projectProgress(cards) {
  const counted = cards.filter((c) => !c.noStatus);
  if (counted.length === 0) return null;
  const total = counted.length;
  const done = counted.filter((c) => c.status === 'complete').length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

/* ------------------------------------------------------------------
   "What we need from you"

   There is no needsClient field in the real client data, so this is
   derived, and derived narrowly on purpose. A false "we need something
   from you" is worse than a missed one: it teaches the client to stop
   trusting the panel, which is the only part of this page that has to
   be trusted. The rule only fires where the card's own meaning makes it
   unambiguous, and any card can override it explicitly from the admin
   editor with needsClient true or false.

   It fires on the cards that genuinely wait on the client: a contract
   awaiting their review, a payment still outstanding, an onboarding
   question set or access request still open. It deliberately does not
   fire on Deliverables, whose unchecked checklists are Mora's own work,
   not the client's.

   Check any change to this rule against the real client files before
   shipping it, because a false "we need something from you" costs more
   than a missed one.
   ------------------------------------------------------------------ */
function clientNeed(card) {
  if (!card || card.locked) return false;
  if (card.needsClient === false) return false;
  if (card.status === 'complete') return false;
  if (card.needsClient === true) return true;
  if (card.form === true) return true;
  const id = String(card.id || '');
  if (/onboarding-questions/.test(id)) return true;
  if (/contract/.test(id) && card.status === 'in_progress') return true;
  if (/(invoice|payment)/.test(id) && card.status === 'in_progress') return true;
  return false;
}

// The verb on the button says what the click actually does, so nobody
// has to guess what is behind it. Derived from the stage, not authored.
function needAction(card) {
  const id = String(card.id || '');
  if (/onboarding-questions/.test(id)) return 'Answer the questions';
  if (/contract/.test(id) && card.form === true) return 'Send us your details';
  if (/contract/.test(id)) return 'Review the agreement';
  if (/(invoice|payment)/.test(id)) return 'See what is owed';
  return 'Open this';
}

// The note under each row is the card's own description, verbatim. Those
// descriptions are already written in exactly the right voice ("Two
// things we need from you before the CRM build can move.") and using them
// means this panel invents no wording of its own about a client's project.
/* One card at a time, ending in one Submit. See needs-stepper.js.
   One-tap decisions come first, then questions, then drafts to approve,
   and last the stages that open a page of their own (an onboarding form),
   so the card always opens on something answerable right there. */
function needsSteps(cards, slug, requestsRec) {
  const steps = [];
  const cardSteps = (cards || []).filter(clientNeed).map((card) => {
    const id = String(card.id || '');
    const isForm = cardMode(card.id, card) === 'onboarding';
    return {
      kind: 'card',
      id: 'card-' + id,
      cardId: id,
      title: card.label,
      where: card.project || '',
      noteHtml: card.description || '',
      action: needAction(card),
      href: isForm ? '/onboarding-form/' + encodeURIComponent(slug) + '/' + encodeURIComponent(id) : null,
    };
  });
  const rec = requestsRec && requestsVisible(requestsRec) ? requestsRec : null;
  const allNeeds = rec && Array.isArray(rec.items) ? rec.items.filter((i) => i.status === 'needs') : [];
  // An email review board opens as one Start step: the emails need room to
  // be read, so they are answered one by one on the board, never as bare
  // choices here.
  const emailRows = allNeeds.filter((i) => i.email || i.explain);
  if (emailRows.length) {
    const left = emailRows.length;
    steps.push({
      kind: 'card',
      id: 'email-review',
      title: 'Your email review',
      where: 'Start here',
      noteHtml: '<p>These are the emails your customers get, in order. You are approving the words before any of them go out.</p><p>' + left + ' email' + (left === 1 ? '' : 's') + ' waiting on you, about 15 minutes. Each one opens as the email itself, with every option side by side. Choose one, cut it, or write your own. Your choices save as you go.</p>',
      action: 'Start',
      href: '/portal/' + encodeURIComponent(slug) + '/requests?one=0',
    });
  }
  const items = allNeeds.filter((i) => !(i.email || i.explain));
  const order = (i) => (isDecision(i) ? 0 : i.ask === 'answer' ? 1 : 2);
  items.slice().sort((a, b) => order(a) - order(b)).forEach((i) => {
    const kind = isDecision(i) ? 'decide' : i.ask === 'answer' ? 'answer' : i.ask === 'approve' && i.seeUrl ? 'approve' : 'answer';
    steps.push({
      kind,
      id: i.id,
      title: i.title,
      where: (kind === 'decide' ? 'Decide' : kind === 'approve' ? 'Take a look' : 'Question for you') + ' \u00b7 ' + (i.page || 'Whole site'),
      why: i.why || (kind !== 'decide' ? i.note : '') || '',
      seeUrl: i.seeUrl || null,
      options: i.options,
      other: i.other,
    });
  });
  return steps.concat(cardSteps);
}

function needsPanelHtml(cards, slug, requestsRec) {
  const steps = needsSteps(cards, slug, requestsRec);
  const items = requestsRec && requestsVisible(requestsRec) && Array.isArray(requestsRec.items) ? requestsRec.items : [];
  const toCheck = items.filter((i) => i.status === 'done' && !(i.confirm && i.confirm.state) && !(i.review && i.review.state)).length;
  const checkRow = toCheck
    ? `<p class="needs-foot"><a class="need-link" href="/portal/${encodeURIComponent(slug)}/requests-review">Check ${toCheck} finished request${toCheck === 1 ? '' : 's'}</a> when you have a minute.</p>`
    : '';

  if (!steps.length) {
    return `
    <section class="needs needs-clear" aria-labelledby="needs-heading">
      <p class="microlabel">Your next step</p>
      <h2 id="needs-heading">Nothing is waiting on you right now</h2>
      <p class="needs-sub">You are caught up. Whenever we do need something, it appears right here at the top of this page before anywhere else.</p>
      ${checkRow}
    </section>`;
  }
  return needsStepperHtml(steps).replace('</section>', checkRow + '</section>');
}

/* ------------------------------------------------------------------ */

// Newest first. The stored order is insertion order, not date order, and
// caraballo.json genuinely renders out of sequence without this. Display
// only, the file is untouched.
function sortedActivity(activity) {
  return (activity || [])
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const d = String(y.a.date || '').localeCompare(String(x.a.date || ''));
      return d !== 0 ? d : x.i - y.i;
    })
    .map((x) => x.a);
}

// Each project gets its own most recent real update, taken from the
// activity log by way of the cardId already stored on every entry. This
// is the "what is happening with my project" answer, sitting inside the
// project instead of at the bottom of a very long page.
function latestPerProject(cards, activity) {
  const cardProject = {};
  (cards || []).forEach((c) => {
    cardProject[c.id] = c.project || 'Other';
  });
  const latest = {};
  sortedActivity(activity).forEach((entry) => {
    const project = cardProject[entry.cardId];
    if (!project || latest[project]) return;
    latest[project] = entry;
  });
  return latest;
}

// The prerequisite chain: Strategy Session after payment, Onboarding
// after that, Client Check-in has no gate, Offboarding only once a
// project is actually winding down. Computed from real card state, not
// a separate tracked flag, since no dedicated "strategy session
// happened" signal exists. That gap is named here rather than faked.
function computeMeetingLocks(cards) {
  const anyPaid = (cards || []).some((c) => /invoice/.test(c.id) && c.status === 'complete');
  const anyWindingDown = (cards || []).some((c) => /offboarding/.test(c.id) && c.status !== 'not_started');
  return {
    strategy: { locked: !anyPaid, reason: 'Opens once your first payment is in.' },
    // Same gate as Strategy Session for now. There is no separate
    // "strategy happened" flag yet, which is a real gap worth closing,
    // but that note belongs here in the code and never in the reason
    // string, which a client reads.
    onboarding: { locked: !anyPaid, reason: 'Opens once your first payment is in.' },
    checkin: { locked: false, reason: null },
    adhoc: { locked: false, reason: null },
    offboarding: { locked: !anyWindingDown, reason: 'Opens when your project is ready to wrap up.' },
  };
}

// The studio's real cal.com links. Never a placeholder.
const MEETING_LINKS = {
  onboarding: 'https://cal.com/morastudios/onboarding',
  offboarding: 'https://cal.com/morastudios/offboarding',
  checkin: 'https://cal.com/morastudios/client-check-in',
  strategy: 'https://cal.com/morastudios/strategy-session',
  adhoc: 'https://cal.com/morastudios/adhoc',
};

function meetingButtonHtml(key, label, lock) {
  const disabled = lock.locked ? 'disabled' : '';
  const lockNote = lock.locked ? `<span class="meeting-lock-note">${escapeHtml(lock.reason)}</span>` : '';
  return `
  <button type="button" class="meeting-type" data-type="${key}" data-href="${escapeHtml(MEETING_LINKS[key] || '')}" ${disabled}>
    <span class="meeting-type-name">${escapeHtml(label)}${lock.locked ? ' <span class="lock-icon" aria-hidden="true">&#9679;</span>' : ''}</span>
    ${lockNote}
  </button>`;
}

// Each card is its own accordion nested inside the project's accordion,
// collapsed by default. Expanding shows the card's real content inline
// (same item rendering as the full card-detail page, reused directly,
// not duplicated) instead of leaving the dashboard. Every section
// inside a project is an accordion, so the page is not overwhelming.
function cardAccordionHtml(card, client, nextCard) {
  const slug = client.slug;
  const locked = !!card.locked;
  const needs = clientNeed(card);
  const statusKey = locked ? 'locked' : card.status || 'not_started';
  const statusLabel = STATUS_LABEL[statusKey] || statusKey;
  const mode = cardMode(card.id, card);
  const cardItems = card.items || [];

  // A locked card always shows its reason. The card's own description
  // carries it ("Unlocks once Project 2 is paid in full."), and it is
  // emitted here rather than left unused, because a dead end with no
  // explanation is exactly what makes someone stop trusting a page.
  if (locked) {
    return `
  <div class="card-acc status-locked locked" data-card-id="${escapeHtml(card.id)}">
    <div class="card-acc-head is-locked">
      <span class="card-acc-name">${escapeHtml(card.label)}</span>
      <span class="pill pill-locked">${escapeHtml(statusLabel)}</span>
    </div>
    <p class="lock-reason">${card.description ? card.description : 'This opens up later in the project.'}</p>
  </div>`;
  }

  // Only show "Nothing added here yet" when there is truly nothing to
  // say, not when a real description already explains the card (Project
  // 1's Proposal/Contract/Invoice live in Dubsado, not in this portal,
  // and the description already says so). Showing both reads as a
  // contradiction: real information right above a line claiming there
  // is nothing here.
  const items = cardItems.map((item) => itemRowHtml(item, mode)).join('')
    || (card.description ? '' : `<p class="empty">Nothing added here yet.</p>`);

  // Only worth a separate full-page link when that page actually offers
  // something the inline accordion doesn't: Print / Save as PDF and
  // Download DOCX, which only show up when a card has a real text item.
  // Otherwise it duplicates each item's own Open button for no reason,
  // and it never shows at all on a card with nothing real added yet.
  // One Open, never two.
  // Only a real written document is worth printing, not a status line.
  const hasTextItem = cardItems.some((i) => i.type === 'text' && (i.content || i.notes));
  const fullPageHref = '/portal/' + encodeURIComponent(slug) + '/' + encodeURIComponent(card.id);
  // The actual fillable form lives on its own dedicated page, not
  // crammed into this accordion, because a page of its own is less
  // overwhelming. See onboarding-form.js for the real Netlify Form, the
  // review-before-submit step, and the client-scoped naming SOP.
  // It lives at /onboarding-form/<slug>/<cardId>, a distinct top-level
  // path rather than a third /portal/... segment: a nested 3-segment
  // redirect is unreliable against Netlify's own matcher for the
  // shorter 2-segment /portal/:slug/:cardId rule. Keep it top-level.
  const onboardingFormHref = '/onboarding-form/' + encodeURIComponent(slug) + '/' + encodeURIComponent(card.id);
  const onboardingCta = mode === 'onboarding'
    ? `<a class="btn btn-primary btn-block" href="${onboardingFormHref}">${escapeHtml(card.formCta || 'Answer these questions')}</a>`
    : '';
  // Lets a client move straight from one stage to the next without
  // manually collapsing and finding the next card themselves. From
  // discovery, they should be able to go next.
  // Only offered when there is a real next card in the same project and
  // it isn't locked, opening a locked next stage would just be a dead
  // end dressed up as a button.
  const nextBtn = nextCard && !nextCard.locked
    ? `<button type="button" class="btn btn-quiet btn-block" data-next-card="${escapeHtml(nextCard.id)}">Next: ${escapeHtml(nextCard.label)} &rarr;</button>`
    : '';

  const pill = card.noStatus
    ? ''
    : needs
      ? '<span class="pill pill-needs">Needs you</span>'
      : `<span class="pill pill-${statusKey}">${escapeHtml(statusLabel)}</span>`;

  return `
  <div class="card-acc status-${statusKey}${needs ? ' needs-you' : ''}" data-card-id="${escapeHtml(card.id)}">
    <button class="card-acc-head" type="button" aria-expanded="false">
      <span class="card-acc-name">${escapeHtml(card.label)}</span>
      ${pill}
      <span class="chev" aria-hidden="true">&#9662;</span>
    </button>
    <div class="card-acc-body" hidden>
      ${card.description ? `<div class="row-desc">${card.description}</div>` : ''}
      ${items}
      ${onboardingCta}
      ${hasTextItem && mode !== 'onboarding' ? `<a class="btn btn-quiet btn-block" href="${fullPageHref}">Print or download this</a>` : ''}
      ${nextBtn}
    </div>
  </div>`;
}

function activityHtml(activity) {
  const rows = sortedActivity(activity);
  if (!rows.length) return `<p class="activity-empty">Nothing logged yet.</p>`;
  return rows
    .map((a) => `<div class="activity-row"><span class="activity-date">${escapeHtml(a.date)}</span><span class="activity-text">${escapeHtml(a.text)}</span></div>`)
    .join('');
}

function renderDashboard(client, state, requestsRec, filesRec) {
  const cards = state.cards || [];
  const groups = groupByProject(cards);
  const latest = latestPerProject(cards, state.activity);

  // A project opens by default when something inside it is waiting on
  // the client. That is the only thing worth opening automatically. If
  // nothing is waiting anywhere, the first project opens so the page is
  // never a wall of closed rows.
  const openFlags = groups.map((g) => g.cards.some(clientNeed));
  if (!openFlags.some(Boolean) && openFlags.length) openFlags[0] = true;

  const sections = groups
    .map((group, i) => {
      const open = openFlags[i];
      // Open work first; finished cards fold into one Completed accordion.
      const isDone = (c) => c.status === 'complete' && !clientNeed(c);
      const cardHtml = (c) => cardAccordionHtml(c, client, group.cards[group.cards.indexOf(c) + 1]);
      const openCards = group.cards.filter((c) => !isDone(c));
      const doneCards = group.cards.filter(isDone);
      const inner = openCards.map(cardHtml).join('') + (doneCards.length
        ? `<details class="done-acc"><summary><span>Completed</span><span class="done-n">${doneCards.length}</span><span class="chev" aria-hidden="true">&#9662;</span></summary><div class="done-acc-body">${doneCards.map(cardHtml).join('')}</div></details>`
        : '');
      const progress = projectProgress(group.cards);
      const needCount = group.cards.filter(clientNeed).length;
      const update = latest[group.project];
      return `
      <section class="project${needCount ? ' project-needs' : ''}" data-index="${i}">
        <button class="project-head" type="button" aria-expanded="${open ? 'true' : 'false'}">
          <span class="project-head-main">
            <span class="project-name">${escapeHtml(group.project)}</span>
            ${progress ? `<span class="project-summary">${progress.done} / ${progress.total} complete${needCount ? ' &middot; ' + needCount + ' waiting on you' : ''}</span>` : ''}
          </span>
          ${progress ? `<span class="meter" aria-hidden="true"><span class="meter-fill" style="width:${progress.pct}%"></span></span>` : ''}
          <span class="chev" aria-hidden="true">&#9662;</span>
        </button>
        <div class="project-body"${open ? '' : ' hidden'}>
          ${update ? `<p class="project-latest"><span class="microlabel">Latest update</span><span class="project-latest-date">${escapeHtml(update.date)}</span>${escapeHtml(update.text)}</p>` : ''}
          ${inner}
        </div>
      </section>`;
    })
    .join('');

  const locks = computeMeetingLocks(cards);
  const meetingButtons = [
    meetingButtonHtml('onboarding', 'Onboarding', locks.onboarding),
    meetingButtonHtml('offboarding', 'Offboarding', locks.offboarding),
    meetingButtonHtml('checkin', 'Client Check-in', locks.checkin),
    meetingButtonHtml('strategy', 'Strategy Session', locks.strategy),
    meetingButtonHtml('adhoc', 'Something else', locks.adhoc),
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${escapeHtml(client.name)} &middot; Me&Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}

  header {
    background: var(--white);
    /* The site's header sits on a hard 2px oxford edge, not a hairline.
       It is the first line the eye lands on and it sets the weight for
       everything under it. */
    border-bottom: var(--rule-strong);
    padding: clamp(1.1rem, 4vw, 1.8rem) clamp(1.1rem, 5vw, 2.2rem) clamp(1.2rem, 4vw, 1.8rem);
  }
  .header-inner { max-width: 54rem; margin: 0 auto; }
  /* The kicker row. A lime-dot wordmark here would read as a letterhead,
     which is right on an invoice and wrong at the top of an app, because
     it never says what the page is. The mono uppercase kicker is the
     site's own label voice and it names the thing. */
  .header-top { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap; }
  .portal-kicker {
    font-family: var(--mono); font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--oxford);
    margin: 0; min-width: 0;
  }
  .header-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 0.9rem; }
  h1 { font-weight: 800; font-size: clamp(1.45rem, 5.5vw, 2rem); margin: 0; line-height: 1.15; letter-spacing: -0.015em; }
  .lede { color: var(--ink-soft); font-size: 0.95rem; margin: 0.5rem 0 0; max-width: 34rem; }

  main { max-width: 54rem; margin: 0 auto; padding: clamp(1.2rem, 4vw, 2rem) clamp(1.1rem, 5vw, 2.2rem) 4.5rem; }

  /* Buttons, one set, used everywhere instead of six near-identical rules. */
  /* The site's button is a sticker: a hard 2px oxford outline, an offset
     oxford shadow holding it off the page, and a spring press that
     collapses the shadow as it goes down. The portal's version was
     "1px solid transparent" with no outline and no shadow at all, which
     is why the buttons read as someone else's UI kit. */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    font-family: var(--display); font-weight: 700; font-size: 0.95rem; line-height: 1.2;
    min-height: 48px; padding: 0.7rem 1.3rem; border-radius: var(--radius-btn);
    border: var(--rule-strong); cursor: pointer; text-decoration: none; text-align: center;
    box-shadow: var(--shadow-hard-sm);
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-hard-lg); }
  .btn:active { transform: translateY(2px); box-shadow: 0 0 0 0 var(--oxford); }
  .btn-primary { background: var(--oxford); color: var(--white); }
  .btn-primary:hover { background: #061529; }
  /* Straight off the live site's .btn-primary: blue on blue, no dark
     outline, and the hover is a blue glow rather than the sticker's
     offset shadow. This is the one button on the page that is an accent
     rather than a sticker, so it does not carry the oxford rule. */
  .btn-blue {
    background: var(--blue); color: var(--white); border-color: var(--blue);
    box-shadow: none;
  }
  .btn-blue:hover { background: var(--blue); box-shadow: 0 12px 36px rgba(30, 69, 251, 0.35); }
  .btn-blue:active { box-shadow: none; }
  .btn-lime { background: var(--lime); color: var(--oxford); }
  .btn-lime:hover { background: #bde317; }
  .btn-quiet { background: var(--white); color: var(--oxford); }
  .btn-quiet:hover { background: var(--panel); }
  .btn-block { display: flex; width: 100%; margin-top: 0.9rem; }

  /* ---- What we need from you ---------------------------------- */
  /* Panels sit on the hard offset shadow, the studio signature, rather
     than the soft blur they had. A Mora element looks stuck on the page,
     not floating above it. */
  .needs {
    background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard);
    padding: clamp(1.2rem, 5vw, 1.9rem); margin-bottom: clamp(1.2rem, 4vw, 1.8rem);
  }
  .needs h2 { font-size: clamp(1.2rem, 4.5vw, 1.5rem); font-weight: 800; margin: 0.35rem 0 0; letter-spacing: -0.01em; }
  .needs-sub { color: var(--ink-soft); font-size: 0.95rem; margin: 0.45rem 0 0; }
  .needs-foot { font-size: 0.85rem; color: var(--ink-faint); margin: 1.1rem 0 0; }
  .needs-clear h2 { color: var(--green); }

  .need-list { list-style: none; margin: 1.2rem 0 0; padding: 0; }
  .need-row {
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: 1rem 0; border-top: var(--rule-soft);
  }
  .need-text { flex: 1 1 16rem; min-width: 0; }
  .need-where { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lime-ink); margin: 0 0 0.15rem; }
  .need-title { font-size: 1.08rem; font-weight: 700; margin: 0; }
  .need-note { color: var(--ink-soft); font-size: 0.92rem; margin-top: 0.25rem; }
  .need-note p { margin: 0; }
  .need-link { color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 0.18em; }
  .done-acc { margin-top: 0.8rem; border-radius: var(--radius-sm); background: var(--panel); }
  .done-acc > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; min-height: 48px; padding: 0.4rem 1rem; font-family: var(--display); font-weight: 700; color: var(--oxford); }
  .done-acc > summary::-webkit-details-marker { display: none; }
  .done-acc .done-n { font-family: var(--mono); font-size: 0.78rem; background: var(--green-bg); color: var(--green); border-radius: 6px; padding: 0.15rem 0.5rem; }
  .done-acc .chev { margin-left: auto; transition: transform 0.2s; }
  .done-acc[open] .chev { transform: rotate(180deg); }
  .done-acc-body { padding: 0 0.6rem 0.6rem; display: grid; gap: 0.6rem; }
  .need-btn {
    flex: 0 0 auto; font-family: var(--display); font-weight: 700; font-size: 0.92rem;
    min-height: 48px; padding: 0.7rem 1.3rem; border-radius: var(--radius-btn); border: none;
    background: var(--lime); color: var(--oxford); cursor: pointer; box-shadow: var(--shadow-hard);
    display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .need-btn:hover { background: #bde317; transform: translateY(-2px); box-shadow: var(--shadow-hard-lg); }
  .need-btn:active { transform: translateY(2px); box-shadow: 0 0 0 0 var(--oxford); }

  /* ---- Projects ------------------------------------------------ */
  .project {
    background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard);
    margin-bottom: clamp(0.8rem, 3vw, 1.1rem); overflow: hidden;
  }
  .project-head {
    width: 100%; display: grid; grid-template-columns: 1fr auto; align-items: center;
    gap: 0.3rem 1rem; text-align: left; background: var(--white); border: none;
    padding: clamp(1rem, 4vw, 1.2rem) clamp(1rem, 4vw, 1.5rem); cursor: pointer;
  }
  .project-head:hover { background: var(--paper); }
  .project-head-main { min-width: 0; }
  .project-name { display: block; font-family: var(--display); font-size: clamp(1.02rem, 3.6vw, 1.15rem); font-weight: 700; color: var(--oxford); letter-spacing: -0.01em; }
  /* The count is data, so it is set in mono and in the accent blue, the
     way the site sets its own figures. */
  .project-summary { display: block; font-family: var(--mono); font-size: 0.76rem; letter-spacing: 0.04em; color: var(--blue); font-weight: 700; margin-top: 0.25rem; }
  .project-needs .project-summary { color: var(--blue); font-weight: 700; }
  .meter { grid-column: 1 / -1; height: 5px; border-radius: 999px; background: var(--panel); overflow: hidden; margin-top: 0.55rem; }
  .meter-fill { display: block; height: 100%; background: var(--oxford); border-radius: 999px; }
  .project-needs .meter-fill { background: var(--lime-ink); }
  .chev { transition: transform 0.3s var(--ease-spring); color: var(--ink-faint); font-size: 0.9rem; align-self: center; }
  .project-head[aria-expanded="true"] .chev { transform: rotate(180deg); }
  /* White panel, beige rows. This was the other way round (cream panel,
     white rows), which made each card row lighter than the surface it
     sat on and flattened the whole list: the rows read as gaps rather
     than as objects. On the live portal the rows are the darker element
     and the panel behind them is white, so the stack has depth. */
  .project-body { border-top: var(--rule-soft); padding: clamp(0.9rem, 4vw, 1.2rem) clamp(0.9rem, 4vw, 1.5rem) clamp(1.1rem, 4vw, 1.5rem); background: var(--white); }
  .project-body[hidden] { display: none; }

  .project-latest {
    background: var(--white); border: var(--rule-soft); border-radius: var(--radius-sm);
    padding: 0.8rem 1rem; margin: 0 0 1rem; font-size: 0.9rem; color: var(--ink-soft);
  }
  .project-latest .microlabel { display: block; }
  .project-latest-date { font-family: var(--mono); font-size: 0.74rem; color: var(--ink-faint); display: block; margin: 0.15rem 0 0.2rem; }

  /* ---- Cards --------------------------------------------------- */
  .card-acc {
    background: var(--panel); border: var(--rule); border-radius: var(--radius-sm);
    margin-bottom: 0.6rem; overflow: hidden; scroll-margin-top: 0.8rem;
    transition: transform 0.3s var(--ease-spring), box-shadow 0.25s var(--ease-out);
  }
  .card-acc:last-child { margin-bottom: 0; }
  /* A gentler lift than the website's -6px-and-tilt: these are rows in a
     tight stack, not standalone marketing cards, and a tilt on each one
     makes the column look broken rather than playful. Same spring curve,
     shorter travel. */
  .card-acc:hover { transform: translateY(-2px); box-shadow: var(--shadow-hard); }
  .card-acc.needs-you { border-color: var(--oxford); box-shadow: var(--shadow-hard); }
  /* Locked cards are deliberately inert: nothing to click, so nothing
     moves under the cursor. */
  /* Locked drops a further step to panel-2. It used to be panel against
     white rows, which read as "dimmer"; now that every row is panel it
     needs its own darker step to still read as unavailable. */
  .card-acc.status-locked { background: var(--panel-2); border-style: dashed; }
  .card-acc.status-locked:hover { transform: none; box-shadow: none; }
  .card-acc.flash { animation: flash 1.4s ease; }
  @keyframes flash { 0%, 100% { box-shadow: var(--shadow-sm); } 25% { box-shadow: 0 0 0 3px var(--oxford); } }

  .card-acc-head {
    width: 100%; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; text-align: left;
    background: none; border: none; padding: 0.85rem 1rem; min-height: 52px; cursor: pointer;
    font-family: inherit;
  }
  .card-acc-head:hover { background: var(--paper); }
  .card-acc-head.is-locked { cursor: default; }
  /* Mono uppercase, the site's label voice. Title-case Syne here made
     the card names read as headings competing with the project name
     above them; as monospaced labels they read as a list of steps. */
  .card-acc-name {
    flex: 1 1 auto; min-width: 0; font-family: var(--mono); font-weight: 700;
    font-size: 0.9rem; color: var(--oxford); letter-spacing: 0.04em; text-transform: uppercase;
  }
  .status-complete .card-acc-name { color: var(--ink-soft); font-weight: 600; }
  .status-locked .card-acc-name { color: var(--ink-faint); }
  .card-acc-head .chev { color: var(--ink-faint); }
  .card-acc-head[aria-expanded="true"] .chev { transform: rotate(180deg); }
  .card-acc-body { border-top: var(--rule-soft); padding: 1rem; background: var(--white); }
  .card-acc-body[hidden] { display: none; }
  .lock-reason { margin: 0; padding: 0 1rem 0.9rem; font-size: 0.88rem; color: var(--ink-faint); }
  .lock-reason p { margin: 0; }

  .row-desc { font-size: 0.94rem; color: var(--ink-soft); margin: 0 0 0.2rem; }
  .row-desc p { margin: 0 0 0.5rem; }

  /* ---- Status pills -------------------------------------------- */
  .pill {
    flex: 0 0 auto; font-family: var(--mono); font-size: 0.68rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.28rem 0.7rem; border-radius: var(--radius-pill); white-space: nowrap;
  }
  /* Lime for done, lavender for in flight. Both are real studio colours
     (the live stylesheet references --lavender 8 times); the muted green
     and grey they replace were not in the palette at all. */
  .pill-complete { background: var(--lime); color: var(--oxford); }
  .pill-in_progress { background: var(--lavender); color: var(--oxford); }
  .pill-not_started { background: var(--white); color: var(--ink-faint); box-shadow: inset 0 0 0 1px var(--panel-2); }
  .pill-locked { background: transparent; color: var(--ink-faint); box-shadow: inset 0 0 0 1px var(--panel-2); }
  /* "Needs you" moves to blue now that lime marks Complete. Two lime
     pills on one row would have made the loudest colour on the page mean
     both "done, ignore this" and "act on this", which is the one thing a
     status colour cannot do. Blue is the site's accent and reads as the
     live, actionable item. */
  .pill-needs { background: var(--blue); color: var(--white); font-weight: 700; border: 2px solid var(--blue); }

  ${ITEM_STYLES}

  /* ---- Meeting modal ------------------------------------------- */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(34,49,94, 0.55); display: flex;
    align-items: center; justify-content: center; padding: 1rem; z-index: 50; overflow-y: auto;
  }
  .modal-overlay[hidden] { display: none; }
  .modal {
    background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow);
    padding: clamp(1.3rem, 5vw, 1.9rem); width: 100%; max-width: 27rem; margin: auto;
  }
  .modal h2 { margin: 0.3rem 0 0.3rem; font-size: 1.25rem; font-weight: 800; }
  .modal-sub { font-size: 0.9rem; color: var(--ink-soft); margin: 0 0 1.1rem; }
  .meeting-type {
    width: 100%; text-align: left; display: flex; flex-direction: column; gap: 0.15rem;
    padding: 0.85rem 1rem; margin-bottom: 0.55rem; min-height: 52px;
    border: var(--rule-soft); border-radius: var(--radius-sm);
    background: var(--white); cursor: pointer; font-family: var(--sans);
  }
  .meeting-type-name { font-family: var(--display); font-size: 1rem; font-weight: 700; color: var(--oxford); }
  .meeting-type:hover:not([disabled]) { border-color: var(--oxford); background: var(--paper); }
  .meeting-type[disabled] { background: var(--panel); cursor: not-allowed; }
  .meeting-type[disabled] .meeting-type-name { color: var(--ink-faint); }
  .meeting-lock-note { font-size: 0.82rem; color: var(--ink-faint); }
  .modal-close { margin-top: 0.5rem; width: 100%; }

  /* ---- Leave a review -------------------------------------------
     A quiet button in the header's top right, beside + New Meeting.
     The form itself is shared with the public /review page. */
  .header-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
${REVIEW_CSS}
${DECISION_CSS}
${STEPPER_CSS}
  .need-inline .need-text { flex-basis: 100%; }
  .need-title { line-height: 1.35; }
  /* ---- Activity ------------------------------------------------ */
  .activity { margin-top: clamp(1.6rem, 5vw, 2.4rem); background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard); padding: clamp(1.1rem, 4vw, 1.6rem); }
  .activity h2 { font-size: 1.15rem; font-weight: 800; margin: 0.3rem 0 0.9rem; }
  .activity-row { display: flex; gap: 1rem; padding: 0.7rem 0; border-top: var(--rule-soft); font-size: 0.92rem; color: var(--ink-soft); }
  .activity-row:first-of-type { border-top: none; }
  .activity-date { font-family: var(--mono); color: var(--ink-faint); flex: 0 0 5.5rem; font-size: 0.76rem; padding-top: 0.15rem; }
  .activity-empty { color: var(--ink-faint); font-size: 0.92rem; }

  .foot { margin-top: 1.6rem; font-size: 0.86rem; color: var(--ink-faint); text-align: center; }
  .foot a { color: var(--blue-ink); }

  /* ---- Narrow screens ------------------------------------------
     Antonio runs his business from a phone, so this is the layout
     that matters, not the desktop one. Everything below is about a
     360px viewport: no side scroll, nothing cropped, every target
     still at least 48px, and no line of text under 14px. */
  @media (max-width: 34rem) {
    .header-row { align-items: stretch; }
    /* The kicker and the meeting button share the top row on a phone,
       the way the live portal does. At 0.72rem the kicker is about
       235px and the button about 135px, which overflows a 360px
       viewport and drops the button onto its own line; shrinking the
       label to 0.64rem buys the ~40px that keeps them paired. The
       button never goes full width here, so it stays visually a
       control rather than a banner. */
    .portal-kicker { font-size: 0.64rem; letter-spacing: 0.07em; }
    .header-top .btn { padding: 0.6rem 1rem; font-size: 0.9rem; }
    .need-row { flex-direction: column; align-items: stretch; gap: 0.7rem; }
    .need-btn { width: 100%; }
    .activity-row { flex-direction: column; gap: 0.1rem; }
    .activity-date { flex: none; }
    .card-acc-head { gap: 0.4rem 0.5rem; }
    /* Was flex: 1 1 100%, which forced the status pill onto a second
       line on every card. That was the right call when names were
       title-case Syne at 1rem; as mono uppercase at 0.9rem the longest
       real name ("Onboarding questions") plus its pill and chevron fit
       a 360px row with room to spare, so name and status sit together
       the way they do on the live portal. The 8rem basis still lets a
       genuinely long name wrap rather than squash the pill. */
    .card-acc-name { flex: 1 1 8rem; }
  }

  @media print {
    header, .activity, .chev, .modal-overlay, .need-btn, .btn, .meter { display: none !important; }
    .project-body[hidden] { display: block !important; }
    .card-acc-body[hidden] { display: block !important; }
    body { background: var(--white); }
    .project, .needs { box-shadow: none; border: var(--rule-soft); }
  }
</style>
<style>${WELCOME_CSS}</style>
</head>
<body>
  ${welcomeHtml(client)}
  ${welcomeScript(client)}
  <header>
    <div class="header-inner stagger">
      <div class="header-top">
        <p class="portal-kicker">Me&Co. &middot; Client Portal</p>
        <div class="header-actions">
          <button type="button" class="btn btn-quiet" id="open-review-modal">Leave a review</button>
          <button type="button" class="btn btn-blue" id="open-meeting-modal">+ New Meeting</button>
        </div>
      </div>
      <div class="header-row">
        <div>
          <h1>${escapeHtml(client.name)}</h1>
          <p class="lede">Everything for your projects lives here. If we ever need something from you, it shows up at the top of this page first.</p>
        </div>
      </div>
    </div>
  </header>
  <div class="modal-overlay" id="meeting-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="meeting-modal-title">
      <p class="microlabel">Me&Co.</p>
      <h2 id="meeting-modal-title">Book a meeting</h2>
      <p class="modal-sub">Pick whichever fits. If one is not available yet, it says why.</p>
      ${meetingButtons}
      <button type="button" class="btn btn-quiet modal-close" id="close-meeting-modal">Close</button>
    </div>
  </div>
  <div class="modal-overlay" id="review-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <p class="microlabel">Me&Co.</p>
      <h2 id="review-modal-title">Leave a review</h2>
      <p class="modal-sub">A few sentences in your own words. Takes two minutes.</p>
      ${reviewFormHtml({
        source: 'portal', client: client.name, slug: client.slug,
        submitClass: 'btn btn-primary btn-block',
        thanksHtml: '<p>Thank you, this means a lot. We have your review.</p><p>Want to add anything else later? The button is right here whenever you want it.</p>',
      })}
      <button type="button" class="btn btn-quiet modal-close" id="close-review-modal">Close</button>
    </div>
  </div>
  <main class="stagger">
    ${needsPanelHtml(cards, client.slug, requestsRec)}
    ${sections}
    ${requestsRec ? renderRequestsSection(client, requestsRec, groups.length) : ''}
    ${filesRec ? renderFilesSection(client, filesRec, groups.length + 1) : ''}
    <div class="activity">
      <p class="microlabel">History</p>
      <h2>What has happened so far</h2>
      ${activityHtml(state.activity)}
    </div>
    <p class="foot">Stuck on anything at all? Email <a href="mailto:melody@weareme.co">melody@weareme.co</a>.</p>
    ${WELCOME_AGAIN_HTML}
  </main>
  ${EMBED_OVERLAY_HTML}
  <script>
    (function () {
      document.querySelectorAll('.project-head').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var expanded = btn.getAttribute('aria-expanded') === 'true';
          var body = btn.nextElementSibling;
          btn.setAttribute('aria-expanded', String(!expanded));
          if (expanded) { body.setAttribute('hidden', ''); } else { body.removeAttribute('hidden'); }
        });
      });
      function toggleCard(btn, forceOpen) {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        if (forceOpen && expanded) return;
        var body = btn.nextElementSibling;
        var open = forceOpen ? true : !expanded;
        btn.setAttribute('aria-expanded', String(open));
        if (open) { body.removeAttribute('hidden'); } else { body.setAttribute('hidden', ''); }
      }
      document.querySelectorAll('.card-acc-head[aria-expanded]').forEach(function (btn) {
        btn.addEventListener('click', function () { toggleCard(btn); });
      });

      // Opens a card from anywhere on the page: expands its project if
      // that project is closed, expands the card, scrolls to it, then
      // flashes it so it is obvious where you landed. Used by both the
      // "what we need from you" panel at the top and the Next button at
      // the bottom of each card.
      function openCard(cardId) {
        var acc = document.querySelector('.card-acc[data-card-id="' + cardId + '"]');
        if (!acc) return;
        var section = acc.closest('.project');
        var projectHead = section && section.querySelector('.project-head');
        if (projectHead && projectHead.getAttribute('aria-expanded') !== 'true') projectHead.click();
        var head = acc.querySelector('.card-acc-head[aria-expanded]');
        if (head) toggleCard(head, true);
        acc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        acc.classList.add('flash');
        setTimeout(function () { acc.classList.remove('flash'); }, 1500);
      }

      document.querySelectorAll('[data-jump-card]').forEach(function (btn) {
        btn.addEventListener('click', function () { openCard(btn.dataset.jumpCard); });
      });

      // Open a card straight from the URL, e.g. /portal/cbc#project1-invoice
      //
      // Every client-facing email links back to the exact thing it is
      // about, so an email about an invoice opens that invoice card
      // rather than dropping someone at the top of a page with eight
      // cards on it and leaving them to hunt.
      //
      // Unknown or missing hash does nothing at all, so an old link, or a
      // card that has since been renamed, still lands somewhere sensible
      // rather than erroring.
      function openFromHash() {
        var id = (location.hash || '').replace(/^#/, '');
        if (id) openCard(decodeURIComponent(id));
      }
      openFromHash();
      // Also handle a link clicked while already on the page, which does
      // not reload and so would otherwise sit there doing nothing.
      window.addEventListener('hashchange', openFromHash);
      // Collapses the current card, opens and scrolls to the next one in
      // the same project, so a client can go straight from one stage to
      // the next.
      document.querySelectorAll('[data-next-card]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var currentAcc = btn.closest('.card-acc');
          var currentHead = currentAcc && currentAcc.querySelector('.card-acc-head[aria-expanded]');
          if (currentHead) toggleCard(currentHead);
          openCard(btn.dataset.nextCard);
        });
      });

      ${EMBED_OVERLAY_SCRIPT}

      var modal = document.getElementById('meeting-modal');
      document.getElementById('open-meeting-modal').addEventListener('click', function () { modal.removeAttribute('hidden'); });
      document.getElementById('close-meeting-modal').addEventListener('click', function () { modal.setAttribute('hidden', ''); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.setAttribute('hidden', ''); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.setAttribute('hidden', ''); });
      document.querySelectorAll('.meeting-type').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.hasAttribute('disabled')) return;
          var href = btn.dataset.href;
          if (href) { window.open(href, '_blank', 'noopener'); }
        });
      });

      // Leave a review: the shared form script handles sending; this only opens and closes the modal.
      var reviewModal = document.getElementById('review-modal');
      var openReviewBtn = document.getElementById('open-review-modal');
      var closeReviewBtn = document.getElementById('close-review-modal');
      if (openReviewBtn) {
        openReviewBtn.addEventListener('click', function () {
          if (!document.getElementById('review-thanks').hidden) window.resetReviewForm();
          reviewModal.removeAttribute('hidden');
        });
      }
      if (closeReviewBtn) closeReviewBtn.addEventListener('click', function () { reviewModal.setAttribute('hidden', ''); });
      reviewModal.addEventListener('click', function (e) { if (e.target === reviewModal) reviewModal.setAttribute('hidden', ''); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !reviewModal.hasAttribute('hidden')) reviewModal.setAttribute('hidden', '');
      });
    })();
  </script>
  <script>${REVIEW_SCRIPT}</script>
  <script>${decisionScript(client.slug, client.name)}</script>
  <script>${stepperScript(client.slug, client.name)}</script>
</body>
</html>`;
}

module.exports = { renderDashboard, clientNeed };
