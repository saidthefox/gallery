// rescued.art/rent (2026-10-08): choose how many, a size, what you like and how often; see the price; pick
// favourites; send a request. The API re-checks everything and computes the real quote; nothing is charged.
// Favourites show PAGE at a time; the side card (bottom bar on phones) mirrors the price and what is chosen.
import { CONFIG } from '/assets/config.js';

const API = CONFIG.WORKER;
const form = document.getElementById('rent');
const $ = (sel) => form.querySelector(sel);
const started = Date.now();
const state = { count: null, size: null, frequency: null, types: new Set(), subjects: new Set(), picks: new Set() };
let opts = null;
let pool = [];   // pieces in the chosen size
const PAGE = 24;
let limit = PAGE;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const thumb = (url) => {
  if (!url) return '';
  if (CONFIG.IMG_HOST && url.startsWith(CONFIG.IMG_HOST)) {
    return `${CONFIG.IMG_HOST}/cdn-cgi/image/width=420,quality=75,format=auto/${url.slice(CONFIG.IMG_HOST.length + 1)}`;
  }
  return url;
};

function choiceButtons(key, items) {
  const box = $(`[data-choice="${key}"]`);
  box.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'choice'; b.dataset.value = it.value;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="choice__main">${esc(it.label)}</span>${it.sub ? `<span class="choice__sub">${esc(it.sub)}</span>` : ''}`;
    if (it.disabled) { b.disabled = true; b.title = 'Nothing in this size right now'; }
    b.onclick = () => select(key, it.value);
    box.appendChild(b);
  }
}

function paint(key) {
  form.querySelectorAll(`[data-choice="${key}"] .choice`).forEach((b) =>
    b.setAttribute('aria-pressed', String(String(state[key]) === b.dataset.value)));
}

async function select(key, value) {
  state[key] = key === 'count' ? Number(value) : value;
  paint(key);
  if (key === 'size') {
    state.picks.clear();
    limit = PAGE;
    const r = await fetch(`${API}/api/rent/pieces?size=${encodeURIComponent(value)}`);
    pool = r.ok ? (await r.json()).pieces : [];
  }
  update(key === 'size');
}

function chips(key, names) {
  const box = $(`[data-chips="${key}"]`);
  box.querySelectorAll('.chip').forEach((c) => c.remove());   // keeps the row's label
  for (const n of names) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = n; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      state[key].has(n) ? state[key].delete(n) : state[key].add(n);
      b.setAttribute('aria-pressed', String(state[key].has(n)));
      limit = PAGE;
      update(true);
    };
    box.appendChild(b);
  }
}

function priceDollars() {
  if (!state.count || !state.size || !state.frequency) return null;
  const each = opts.prices[`${state.size}:${state.frequency}`];
  const off = opts.multiDiscount[String(state.count)] || 0;
  return Math.round((each * state.count * (1 - off)) / 100);
}

function matches(p) {
  const t = !state.types.size || state.types.has(p.type);
  const s = !state.subjects.size || p.subjects.some((x) => state.subjects.has(x));
  return t && s;
}

function update(repick = false) {
  const dollars = priceDollars();
  document.getElementById('price').textContent = dollars == null ? '—' : `$${dollars} / month`;
  document.getElementById('barPrice').textContent = dollars == null ? '—' : `$${dollars}/mo`;
  const off = state.count ? (opts.multiDiscount[String(state.count)] || 0) : 0;
  document.getElementById('priceNote').textContent = dollars == null
    ? (opts.maxPieces > 1 ? 'Choose how many, a size and how often.' : 'Choose a size and how often.')
    : `${opts.maxPieces > 1 ? `${state.count} piece${state.count > 1 ? 's' : ''}, ` : 'One piece, '}swapped ${state.frequency === 'twice' ? 'twice a month' : 'once a month'}`
      + (off ? ` · ${Math.round(off * 100)}% off for ${state.count}` : '') + ' · delivery and swaps included';
  if (repick) renderPicks(); else refreshPicks();
}

function need() { return state.count ? opts.minPicks[String(state.count)] : 3; }

function visible() {
  let shown = pool.filter(matches);
  const narrowed = shown.length < pool.length;
  if (shown.length < need()) shown = pool;   // too few matches: show the whole size rather than a dead end
  return { shown, fallback: narrowed && shown === pool };
}

function renderPicks() {
  const box = document.getElementById('picks');
  const more = document.getElementById('more');
  box.innerHTML = '';
  more.hidden = true;
  if (!state.size) return refreshPicks();
  const { shown } = visible();
  for (const p of shown.slice(0, limit)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pick'; b.dataset.token = p.token;
    b.innerHTML = `<img src="${esc(thumb(p.image))}" alt="${esc(p.title)}" loading="lazy">
      <span class="pick__title">${esc(p.title || 'Untitled')}</span>
      <span class="pick__meta">${esc(p.medium)}</span>`;
    b.onclick = () => toggle(p.token);
    box.appendChild(b);
  }
  const left = shown.length - limit;
  if (left > 0) {
    more.hidden = false;
    more.textContent = `Show ${Math.min(left, PAGE)} more (${left} left)`;
  }
  refreshPicks();
}

function toggle(token) {
  if (state.picks.has(token)) state.picks.delete(token);
  else if (state.picks.size < opts.maxPicks) state.picks.add(token);
  refreshPicks();
}

// Pressed/disabled state, hint, side-card list and bar, without rebuilding the grid.
function refreshPicks() {
  const hint = document.getElementById('pickHint');
  const n = state.picks.size;
  const full = n >= opts.maxPicks;
  document.querySelectorAll('#picks .pick').forEach((b) => {
    const on = state.picks.has(b.dataset.token);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = full && !on;
  });
  if (!state.size) hint.textContent = 'Choose a size first.';
  else if (!pool.length) hint.textContent = 'Nothing in this size right now — try another size.';
  else hint.textContent = `Pick at least ${need()} you’d be happy to live with (up to ${opts.maxPicks}). ${n} chosen.`
    + (full ? ' That’s the most — tap one to swap it out.' : '')
    + (visible().fallback ? ' Not enough matches for what you like, so here is everything in this size.' : '');
  renderChosen();
  checkReady();
}

function renderChosen() {
  const n = state.picks.size;
  const box = document.getElementById('chosen');
  document.getElementById('chosenN').textContent = state.size ? `${n} of at least ${need()}` : String(n);
  box.innerHTML = '';
  for (const token of state.picks) {
    const p = pool.find((x) => x.token === token);
    if (!p) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chosen__item'; b.title = `Remove ${p.title || 'Untitled'}`;
    b.setAttribute('aria-label', `Remove ${p.title || 'Untitled'}`);
    b.innerHTML = `<img src="${esc(thumb(p.image))}" alt="">`;
    b.onclick = () => toggle(token);
    box.appendChild(b);
  }
  const bar = document.getElementById('bar');
  bar.hidden = !state.size && priceDollars() == null;
  document.getElementById('barCount').textContent = `${n} favourite${n === 1 ? '' : 's'}${state.size && n < need() ? ` · ${need() - n} more` : ''}`;
}

function checkReady() {
  const ready = state.count && state.size && state.frequency && state.picks.size >= need() && state.picks.size <= opts.maxPicks;
  document.getElementById('send').disabled = !ready;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const status = document.getElementById('status');
  const send = document.getElementById('send');
  const body = {
    count: state.count, size: state.size, frequency: state.frequency,
    types: [...state.types], subjects: [...state.subjects], picks: [...state.picks],
    name: (f.get('name') || '').trim(), contact: (f.get('contact') || '').trim(),
    zip: (f.get('zip') || '').trim(), notes: (f.get('notes') || '').trim(),
    website: f.get('website') || '', elapsed_ms: Date.now() - started,
  };
  if (!body.name || !body.contact || !body.zip) { status.textContent = 'Please fill in your name, a way to reach you and your zip code.'; return; }
  send.disabled = true; status.textContent = 'Sending…';
  try {
    const r = await fetch(`${API}/api/rent/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      status.textContent = typeof d.detail === 'string' ? d.detail : 'Something in the form needs another look.';
      send.disabled = false; return;
    }
    form.classList.add('rent--sent');
    status.textContent = d.message || 'Thanks — I’ll be in touch.';
  } catch (_) {
    status.textContent = 'Could not send just now. Please try again in a minute, or email jake@rescued.art.';
    send.disabled = false;
  }
});

(async function boot() {
  try {
    const r = await fetch(`${API}/api/rent/options`);
    opts = await r.json();
  } catch (_) {
    document.getElementById('pickHint').textContent = 'Renting is not available right now. Please email jake@rescued.art.';
    return;
  }
  if (opts.maxPieces > 1) {
    choiceButtons('count', [1, 2, 3].slice(0, opts.maxPieces).map((n) => ({ value: String(n), label: String(n), sub: n === 1 ? 'piece' : 'pieces' })));
  } else {
    // One piece per rental for now: no how-many step; renumber the steps that remain.
    state.count = 1;
    form.querySelector('[data-choice="count"]').closest('.step').hidden = true;
    [...form.querySelectorAll('.step:not([hidden]) .step__no')].forEach((el, i) => { el.textContent = String(i + 1).padStart(2, '0'); });
  }
  choiceButtons('size', opts.sizes.map((s) => ({ value: s.key, label: s.label, sub: s.range, disabled: !s.available })));
  choiceButtons('frequency', opts.frequencies.map((x) => ({ value: x.key, label: x.label })));
  chips('types', opts.types);
  chips('subjects', opts.subjects);
  document.getElementById('more').onclick = () => { limit += PAGE; renderPicks(); };
  update(true);
})();
