/* ============================================================
   Me&Co. - first-visit welcome
   ------------------------------------------------------------
   A short two-screen welcome that plays the first time a signed-in
   client opens their dashboard, then lifts away to reveal it.

   It is shared code, so it reaches every client portal at once with no
   per-client data. It carries its own small <style> block so the
   dashboard's stylesheet stays untouched; every colour, font, line,
   shadow and easing curve below comes from theme.js tokens, nothing
   new is invented here.

   Once per client per browser: a localStorage key per slug, always
   wrapped in try/catch so a blocked or full store can never break the
   page. If storage is unavailable the welcome simply plays.
   ============================================================ */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* "Aipery Usenbaev" -> Aipery. "Melody, Me&Co" -> Melody.
   An optional client.welcomeName wins when a record carries one.
   Returns '' when there is nothing usable, and the welcome then drops
   the name rather than guessing. */
function firstNameOf(client) {
  const set = String((client && client.welcomeName) || '').trim();
  if (set && /\p{L}/u.test(set) && set.length <= 40) return set;
  const raw = String((client && client.name) || '').trim();
  const word = raw.split(/[\s,]+/)[0] || '';
  const clean = word.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
  if (!/\p{L}/u.test(clean) || clean.length > 30) return '';
  return clean;
}

const WELCOME_CSS = `
  .welcome { position: fixed; inset: 0; z-index: 200; background: var(--oxford); color: var(--paper);
    display: flex; align-items: center; justify-content: center; padding: 24px 16px;
    overflow-y: auto; border-bottom: var(--rule-strong); box-shadow: 0 8px 0 0 var(--lime);
    transition: transform 0.8s var(--ease-out); will-change: transform; }
  .welcome[hidden] { display: none; }
  .welcome.is-leaving { transform: translateY(-104%); pointer-events: none; }
  .welcome-skip { position: absolute; top: 16px; right: 16px; z-index: 2; font-family: var(--mono);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; cursor: pointer;
    color: var(--paper); background: transparent; border: 1.5px solid var(--paper); border-radius: var(--radius-btn);
    padding: 10px 16px; min-height: 44px; transition: transform 0.35s var(--ease-spring), background 0.25s var(--ease-out), color 0.25s var(--ease-out); }
  .welcome-skip:hover { background: var(--paper); color: var(--oxford); transform: translateY(-2px); }
  .welcome-skip:focus-visible, .welcome-go:focus-visible, .welcome-next:focus-visible { outline: 3px solid var(--lime); outline-offset: 3px; }
  .welcome-mark.mark { position: absolute; top: 26px; left: 16px; color: var(--paper); }
  .welcome-stage { width: 100%; max-width: 640px; margin: auto; padding-top: 56px; }
  .welcome-screen[hidden] { display: none; }
  .welcome-hello { font-family: var(--display); font-weight: 800; color: var(--paper);
    font-size: clamp(2rem, 8.5vw, 4rem); line-height: 1.05; letter-spacing: -0.02em; margin: 0; }
  .welcome-hello em { font-style: normal; color: var(--lime); }
  .welcome-card { background: var(--paper); color: var(--ink); border: var(--rule); border-radius: var(--radius);
    box-shadow: var(--shadow-hard-lg); padding: clamp(24px, 6vw, 44px); }
  .welcome-card .microlabel { display: block; margin-bottom: 14px; }
  .welcome-excited { margin: 0.5rem 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(1.1rem, 3.6vw, 1.45rem); line-height: 1.25; color: var(--oxford); }
  .welcome-greet { font-family: var(--display); font-weight: 800; color: var(--oxford);
    font-size: clamp(1.9rem, 7.5vw, 3rem); line-height: 1.12; letter-spacing: -0.02em; margin: 0 0 14px; }
  .welcome-name { background: var(--lime); border-radius: 8px; padding: 0 0.18em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  .welcome-sub { margin: 0 0 26px; font-size: 1.05rem; color: var(--ink-soft); max-width: 46ch; }
  .welcome-go, .welcome-next { font-family: var(--display); font-weight: 700; font-size: 1.05rem; cursor: pointer;
    color: var(--oxford); background: var(--lime); border: var(--rule); border-radius: var(--radius-btn);
    padding: 14px 28px; min-height: 48px; box-shadow: var(--shadow-hard);
    transition: transform 0.35s var(--ease-spring), box-shadow 0.25s var(--ease-out); }
  .welcome-go:hover, .welcome-next:hover { transform: translateY(-3px); box-shadow: 0 6px 0 0 var(--oxford); }
  .welcome-go:active, .welcome-next:active { transform: translateY(2px); box-shadow: 0 1px 0 0 var(--oxford); }
  .welcome-next { background: transparent; color: var(--paper); border-color: var(--paper); box-shadow: none; margin-top: 28px; }
  .welcome-next[hidden] { display: none; }
  .welcome-next:hover { background: var(--paper); color: var(--oxford); box-shadow: none; }

  /* Entrance: lines land on the site's own fadeUp (theme.js), the card
     springs in. Nothing animates until a screen is shown. */
  .welcome-screen.is-in .welcome-hello { animation: fadeUp 0.8s var(--ease-out) backwards; }
  .welcome-screen.is-in .welcome-card { animation: welcomePop 0.75s var(--ease-spring) backwards; }
  .welcome-screen.is-in .welcome-card > * { animation: fadeUp 0.6s var(--ease-out) backwards; }
  .welcome-screen.is-in .welcome-card > *:nth-child(1) { animation-delay: 0.12s; }
  .welcome-screen.is-in .welcome-card > *:nth-child(2) { animation-delay: 0.22s; }
  .welcome-screen.is-in .welcome-card > *:nth-child(3) { animation-delay: 0.32s; }
  .welcome-screen.is-in .welcome-card > *:nth-child(4) { animation-delay: 0.42s; }
  @keyframes welcomePop { from { opacity: 0; transform: translateY(28px) scale(0.96) rotate(-1deg); } to { opacity: 1; transform: none; } }
  body.welcome-open { overflow: hidden; }

  .welcome-again { margin: 0 0 40px; text-align: center; font-size: 0.85rem; }
  .welcome-again button { font: inherit; background: none; border: 0; padding: 8px; cursor: pointer;
    color: var(--ink-faint); text-decoration: underline; text-underline-offset: 3px; }
  .welcome-again button:hover { color: var(--blue-ink); }

  @media (max-width: 480px) {
    .welcome-stage { padding-top: 64px; }
    .welcome-go { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .welcome, .welcome.is-leaving { transition: none; }
    .welcome-screen.is-in .welcome-hello, .welcome-screen.is-in .welcome-card,
    .welcome-screen.is-in .welcome-card > * { animation: none; }
  }
  @media print { .welcome, .welcome-again { display: none !important; } }
`;

function welcomeHtml(client) {
  const first = firstNameOf(client);
  const greet = first
    ? `Welcome, <span class="welcome-name">${escapeHtml(first)}</span>.`
    : 'Welcome.';
  return `
  <div class="welcome" id="welcome" role="dialog" aria-modal="true" aria-label="Welcome" hidden>
    <div class="mark welcome-mark"><span class="dot"></span>Me&Co.</div>
    <button type="button" class="welcome-skip" id="welcome-skip">Skip</button>
    <div class="welcome-stage">
      <div class="welcome-screen" id="welcome-s1" hidden>
        <h1 class="welcome-hello">Welcome to the <em>Me&Co.</em> Client Portal</h1>
        <button type="button" class="welcome-next" id="welcome-next" hidden>Next</button>
      </div>
      <div class="welcome-screen" id="welcome-s2" hidden>
        <div class="welcome-card">
          <span class="microlabel">Me&Co.</span>
          <h2 class="welcome-greet">${greet}</h2>
          <p class="welcome-excited">We're so excited you're here.</p>
          <p class="welcome-sub">Everything for your project lives here, one step at a time.</p>
          <button type="button" class="welcome-go" id="welcome-go">Let's go</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* Runs right after the overlay markup, before first paint, so a returning
   client never sees a flash of the welcome and a first-timer never sees the
   dashboard first. */
function welcomeScript(client) {
  const key = 'mora-welcome-seen:' + String((client && client.slug) || '');
  return `<script>
  (function () {
    var KEY = ${JSON.stringify(key).replace(/</g, '\\u003c')};
    var root = document.getElementById('welcome');
    if (!root) return;
    var s1 = document.getElementById('welcome-s1');
    var s2 = document.getElementById('welcome-s2');
    var next = document.getElementById('welcome-next');
    var timer = null, leaving = false;
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    function seen() { try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; } }
    function mark() { try { window.localStorage.setItem(KEY, '1'); } catch (e) {} }
    function unmark() { try { window.localStorage.removeItem(KEY); } catch (e) {} }

    function show(screen) {
      s1.hidden = true; s2.hidden = true; s1.classList.remove('is-in'); s2.classList.remove('is-in');
      screen.hidden = false;
      void screen.offsetWidth;
      screen.classList.add('is-in');
    }
    function toSecond() {
      if (timer) { clearTimeout(timer); timer = null; }
      show(s2);
      document.getElementById('welcome-go').focus();
    }
    function finish() {
      if (leaving) return;
      leaving = true;
      if (timer) { clearTimeout(timer); timer = null; }
      mark();
      document.body.classList.remove('welcome-open');
      function done() { root.hidden = true; root.classList.remove('is-leaving'); leaving = false; window.scrollTo(0, 0); }
      if (reduced) { done(); return; }
      root.classList.add('is-leaving');
      setTimeout(done, 850);
    }
    function play() {
      leaving = false;
      root.hidden = false;
      root.classList.remove('is-leaving');
      document.body.classList.add('welcome-open');
      show(s1);
      if (reduced) {
        next.hidden = false;
        next.focus();
      } else {
        next.hidden = true;
        document.getElementById('welcome-skip').focus();
        timer = setTimeout(toSecond, 2800);
      }
    }

    document.getElementById('welcome-skip').addEventListener('click', finish);
    document.getElementById('welcome-go').addEventListener('click', finish);
    next.addEventListener('click', toSecond);
    s1.addEventListener('click', function (e) { if (e.target !== next && !reduced) toSecond(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !root.hidden) finish(); });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('#welcome-again')) { unmark(); window.scrollTo(0, 0); play(); }
    });

    // The admin view carries its own bar (.ab) and skips the welcome.
    if (!seen() && !document.querySelector('.ab')) play();
  })();
  </script>`;
}

const WELCOME_AGAIN_HTML = `<p class="welcome-again"><button type="button" id="welcome-again">Show the welcome again</button></p>`;

module.exports = { WELCOME_CSS, welcomeHtml, welcomeScript, firstNameOf, WELCOME_AGAIN_HTML };
