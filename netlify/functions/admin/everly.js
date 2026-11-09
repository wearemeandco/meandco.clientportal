/* Melody's Everly tab: a log of every run by Everly and Ida, newest first and
   grouped by day. Each entry shows who ran, when (Central time), what woke
   the run, what it did with its links, and what is waiting on Melody. The top
   line says when Everly last ran, and warns when she has not run in a day. */
const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');

const ZONE = 'America/Chicago';
const WARN_AFTER_MS = 26 * 60 * 60 * 1000;
const NAMES = { everly: 'Everly', ida: 'Ida' };
const STATUS_WORDS = { done: 'Done', waiting: 'Waiting on you', blocked: 'Blocked' };

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONE });
const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: ZONE, weekday: 'long', month: 'long', day: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' });
const stampLabel = (iso) => dayLabel(iso) + ' at ' + timeLabel(iso);

function ago(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hours = Math.round(mins / 60);
  if (hours < 48) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  return Math.round(hours / 24) + ' days ago';
}

function linkLabel(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '').slice(0, 28) : '');
  } catch (e) {
    return 'Open';
  }
}

function entryHtml(e) {
  const did = (e.did || []).length ? `<ul class="ev-did">${e.did.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '';
  const links = (e.links || []).filter((l) => /^https:\/\//.test(l));
  const pills = links.length ? `<p class="ev-links">${links.map((l) => `<a class="ev-pill" href="${esc(l)}" target="_blank" rel="noopener noreferrer">${esc(linkLabel(l))}</a>`).join('')}</p>` : '';
  const waiting = (e.waiting || []).length ? `<div class="ev-wait"><b>Waiting on you</b><ul>${e.waiting.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
  return `<article class="ev-card" data-agent="${esc(e.agent)}">
    <header class="ev-top"><span class="ev-chip ev-${esc(e.agent)}">${esc(NAMES[e.agent] || e.agent)}</span><time datetime="${esc(e.at)}">${esc(timeLabel(e.at))}</time><span class="ev-status ev-s-${esc(e.status)}">${esc(STATUS_WORDS[e.status] || e.status)}</span></header>
    ${e.woke ? `<p class="ev-woke"><span>Woke for</span> ${esc(e.woke)}</p>` : ''}
    ${did}${pills}${waiting}
  </article>`;
}

function statusBlock(entries, now) {
  const mine = entries.find((e) => e.agent === 'everly');
  if (!entries.length) return '';
  if (!mine) return `<p class="ev-status-line ev-warn" role="status">Everly has not logged a run yet.</p>`;
  const age = now - Date.parse(mine.at);
  const line = `Everly last ran ${ago(age)} · ${STATUS_WORDS[mine.status] ? STATUS_WORDS[mine.status].toLowerCase() : esc(mine.status)}`;
  const warn = age > WARN_AFTER_MS ? `<p class="ev-status-line ev-warn" role="status">Everly has not run since ${esc(stampLabel(mine.at))}. She runs every morning.</p>` : '';
  return `<p class="ev-status-line">${esc(line)}</p>${warn}`;
}

function renderEverly(entries, now) {
  const list = (entries || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const days = [];
  list.forEach((e) => {
    const k = dayKey(e.at);
    if (!days.length || days[days.length - 1].k !== k) days.push({ k, label: dayLabel(e.at), items: [] });
    days[days.length - 1].items.push(e);
  });
  const body = days.length
    ? days.map((d) => `<section class="ev-day"><h2 class="ev-date">${esc(d.label)}</h2>${d.items.map(entryHtml).join('')}</section>`).join('')
    : `<div class="ev-empty"><b>Nothing here yet</b><p>Each time Everly or Ida runs, an entry appears here: what woke them, what they did with the links, and anything waiting on you.</p></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Everly · Me&amp;Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
.ad{max-width:760px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px;display:grid;gap:18px}
.ad-head h1{margin:0;font-size:clamp(30px,6vw,42px);line-height:1.05}
.ad-head p{margin:4px 0 0;color:var(--ink-soft)}
.ev-status-line{margin:0;padding:12px 14px;border-radius:var(--radius-sm);background:var(--white);border:var(--rule);font-weight:700;color:var(--oxford)}
.ev-status-line.ev-warn{background:var(--panel);border-color:var(--oxford)}
.ev-day{display:grid;gap:12px}
.ev-date{margin:10px 0 0;font:700 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
.ev-card{display:grid;gap:10px;padding:16px;border-radius:var(--radius);background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard)}
.ev-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.ev-top time{font:700 13px var(--mono);color:var(--ink-soft)}
.ev-chip{font:700 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:var(--radius-pill);border:1.5px solid var(--oxford);color:var(--oxford)}
.ev-everly{background:var(--lime)}
.ev-ida{background:var(--lavender)}
.ev-status{margin-left:auto;font-size:13px;font-weight:700;color:var(--ink-soft)}
.ev-woke{margin:0;color:var(--ink)}
.ev-woke span{font:700 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-right:6px}
.ev-did{margin:0;padding-left:20px;display:grid;gap:4px}
.ev-links{margin:0;display:flex;flex-wrap:wrap;gap:8px}
.ev-pill{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:var(--radius-pill);border:var(--rule);background:var(--white);color:var(--oxford);font:700 13px var(--sans);text-decoration:none}
.ev-wait{padding:12px 14px;border-radius:var(--radius-sm);background:var(--panel);border:1.5px solid var(--oxford)}
.ev-wait b{display:block;margin-bottom:4px;color:var(--oxford)}
.ev-wait ul{margin:0;padding-left:20px;display:grid;gap:4px}
.ev-empty{padding:22px;border-radius:var(--radius);background:var(--white);border:var(--rule)}
.ev-empty p{margin:6px 0 0;color:var(--ink-soft)}
body{padding-bottom:110px}
.ab-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;gap:4px;padding:6px;border-radius:18px;background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard-lg);width:min(400px,calc(100% - 24px))}
.ab-dock a{flex:1;display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:12px;color:var(--oxford);font:700 12.5px var(--sans);text-decoration:none}
.ab-dock span{font-size:20px;line-height:1}
.ab-dock .on{background:var(--lime);box-shadow:inset 0 0 0 1.5px var(--oxford)}
</style></head><body>
<main class="ad">
  <header class="ad-head"><h1>Everly</h1><p>Every run by Everly and Ida, newest first.</p></header>
  ${statusBlock(list, now)}
  ${body}
</main>
<nav class="ab-dock" aria-label="Your tabs"><a href="/admin"><span aria-hidden="true">👥</span>Businesses</a><a class="on" href="/admin/everly" aria-current="page"><span aria-hidden="true">🤖</span>Everly</a><a href="/admin/workflow"><span aria-hidden="true">⚙️</span>Settings</a><a href="/admin/inquiries"><span aria-hidden="true">📥</span>Inquiries</a></nav>
</body></html>`;
}

module.exports = { renderEverly, WARN_AFTER_MS };
