// =============================================================================
// rescued.art — gallery engine (shared by /gallery and /rent; landing uses
// mountRecent). Plain ES module, no build step, no dependencies.
//
// Backend contract (unchanged from your existing setup):
//   GET  {WORKER}/api/items?page=N&pageSize=M[&nocache=1]
//        -> { items: [ { imageUrls:[url...], count, token, variant? } ], hasMore }
//   GET  {META}?api=meta&key=TOKEN
//        -> a record (or object keyed by token) carrying at least `description`.
//
// Forward-compatible: if items OR metadata also carry title / price / status /
// foundAt / year / medium / dimensions, they're rendered automatically.
// =============================================================================

import { CONFIG } from '/assets/config.js';

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Image URL helpers
// ---------------------------------------------------------------------------

/** Extract a Google Drive file id from the common URL shapes, if present. */
export function fileIdFromUrl(url) {
  if (!url) return '';
  let m;
  if ((m = url.match(/[?&]id=([\w-]+)/))) return m[1];          // uc?export=view&id=ID
  if ((m = url.match(/\/d\/([\w-]+)/))) return m[1];            // .../d/ID...
  if ((m = url.match(/googleusercontent\.com\/([\w-]+)/))) return m[1];
  return '';
}

/**
 * Best-effort sized image URL. Drive/Google image hosts accept a size suffix;
 * where the format is recognised we request a right-sized image instead of the
 * full-resolution original (the old code requested full-res for every thumb).
 * Unknown formats are returned untouched, so nothing breaks.
 */
function sizedUrl(url, w) {
  if (!url || !w || !CONFIG.IMG_HOST) return url || '';
  let path;
  try { path = new URL(url).pathname.replace(/^\/+/, ''); } catch { return url; }
  // Route through the custom domain's transformation pipeline.
  // onerror=redirect quietly falls back to the original if a transform ever fails.
  return `${CONFIG.IMG_HOST}/cdn-cgi/image/width=${w},quality=80,format=auto,onerror=redirect/${path}`;
}

function imageUrlAt(item, i, w) {
  const url = item && item.imageUrls && item.imageUrls[i];
  return url ? sizedUrl(url, w) : '';
}

// ---------------------------------------------------------------------------
// Field readers (tolerant of casing + missing data)
// ---------------------------------------------------------------------------
const pick = (obj, ...keys) => {
  if (!obj) return '';
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
    const lk = Object.keys(obj).find(x => x.toLowerCase() === k.toLowerCase());
    if (lk && obj[lk] != null && obj[lk] !== '') return obj[lk];
  }
  return '';
};

const accession = (item) => {
  const t = pick(item, 'token', 'variant') || fileIdFromUrl(item?.imageUrls?.[0]);
  if (!t) return '';
  const tail = String(t).replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase();
  return tail ? 'RA·' + tail : '';
};

const titleOf = (item, meta) =>
  pick(meta, 'title', 'name') || pick(item, 'title', 'name') || '';

const statusOf = (item, meta) =>
  String(pick(item, 'status', 'availability') || pick(meta, 'status', 'availability') || '').trim();

const isRentable = (statusStr) => {
  const s = statusStr.toLowerCase();
  return CONFIG.RENTABLE_STATUSES.some(v => s.includes(v.toLowerCase()));
};

// ---------------------------------------------------------------------------
// Metadata (cached; folded into the overlay). Tolerates {desc} or {key:{...}}.
// ---------------------------------------------------------------------------
const metaCache = new Map();
async function getMetadata(token) {
  if (!token) return null;
  if (metaCache.has(token)) return metaCache.get(token);
  let record = null;
  try {
    const res = await fetch(`${CONFIG.META}?api=meta&key=${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      record = (data && data[token]) ? data[token] : data;
    }
  } catch (_) { /* offline / blocked — fall through to null */ }
  metaCache.set(token, record);
  return record;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ===========================================================================
// LIGHTBOX  (one instance, lazily built, shared across pages)
// ===========================================================================
let lb = null;
function ensureLightbox() {
  if (lb) return lb;
  const root = document.createElement('div');
  root.className = 'lb';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="lb__scrim" data-close></div>
    <figure class="lb__stage" role="dialog" aria-modal="true" aria-label="Artwork viewer">
      <button class="lb__x" data-close aria-label="Close">esc</button>
      <button class="lb__nav lb__nav--prev" data-prev aria-label="Previous">&larr;</button>
      <img class="lb__img" alt="" />
      <button class="lb__nav lb__nav--next" data-next aria-label="Next">&rarr;</button>
      <figcaption class="lb__panel">
        <div class="lb__acc"></div>
        <h2 class="lb__title"></h2>
        <div class="lb__stamp"></div>
        <dl class="lb__facts"></dl>
        <p class="lb__desc"></p>
        <div class="lb__thumbs"></div>
        <div class="lb__count"></div>
      </figcaption>
    </figure>`;
  document.body.appendChild(root);

  const els = {
    root,
    img: root.querySelector('.lb__img'),
    acc: root.querySelector('.lb__acc'),
    title: root.querySelector('.lb__title'),
    stamp: root.querySelector('.lb__stamp'),
    facts: root.querySelector('.lb__facts'),
    desc: root.querySelector('.lb__desc'),
    thumbs: root.querySelector('.lb__thumbs'),
    count: root.querySelector('.lb__count'),
  };
  let item = null, idx = 0;

  const render = () => {
    els.img.src = imageUrlAt(item, idx, 1600);
    els.img.alt = (titleOf(item, item._meta) || 'Rescued artwork') + ` — view ${idx + 1}`;
    els.count.textContent = item.imageUrls.length > 1
      ? `${idx + 1} / ${item.imageUrls.length}` : '';
    els.thumbs.querySelectorAll('img').forEach((t, i) =>
      t.classList.toggle('is-active', i === idx));
  };

  const buildThumbs = () => {
    els.thumbs.innerHTML = '';
    if (item.imageUrls.length < 2) return;
    item.imageUrls.forEach((_, i) => {
      const t = document.createElement('img');
      t.src = imageUrlAt(item, i, 200);
      t.alt = `View ${i + 1}`;
      t.tabIndex = 0;
      t.addEventListener('click', () => { idx = i; render(); });
      t.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); idx = i; render(); }
      });
      els.thumbs.appendChild(t);
    });
  };

  const fact = (label, val) => val ? `<dt>${esc(label)}</dt><dd>${esc(val)}</dd>` : '';

  const fillMeta = async () => {
    els.acc.textContent = accession(item);
    els.title.textContent = titleOf(item, null) || '';
    els.stamp.innerHTML = '';
    els.facts.innerHTML = '';
    els.desc.textContent = '';

    const meta = await getMetadata(pick(item, 'token', 'variant'));
    item._meta = meta;
    const title = titleOf(item, meta);
    if (title) els.title.textContent = title;

    const status = statusOf(item, meta);
    if (status) {
      els.stamp.innerHTML = `<span class="stamp ${isRentable(status) ? 'stamp--rent' : ''}">${esc(status)}</span>`;
    }
    const price = pick(item, 'price') || pick(meta, 'price');
    els.facts.innerHTML =
      fact('Found', pick(item, 'foundAt') || pick(meta, 'foundAt', 'location')) +
      fact('Medium', pick(item, 'medium') || pick(meta, 'medium')) +
      fact('Size', pick(item, 'dimensions') || pick(meta, 'dimensions', 'size')) +
      fact('Year', pick(item, 'year') || pick(meta, 'year')) +
      fact('Price', price);

    const desc = pick(meta, 'description', 'desc') || pick(item, 'description');
    els.desc.textContent = desc || '';
    if (!title && !desc && !status) els.desc.textContent = 'No catalogue notes yet for this piece.';
  };

  const open = (it, i = 0) => {
    item = it; idx = i;
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
    buildThumbs(); render(); fillMeta();
    els.root.querySelector('.lb__x').focus();
  };
  const close = () => {
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
  };
  const step = (d) => { if (item) { idx = (idx + d + item.imageUrls.length) % item.imageUrls.length; render(); } };

  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  root.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  root.querySelector('[data-next]').addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (root.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  // swipe inside the lightbox
  let sx = null;
  els.img.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  els.img.addEventListener('touchmove', e => {
    if (sx == null) return;
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 45) { step(dx > 0 ? -1 : 1); sx = e.touches[0].clientX; }
  }, { passive: true });

  lb = { open };
  return lb;
}

// ===========================================================================
// TILES
// ===========================================================================
const tileObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target;
    if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
    tileObserver.unobserve(img);
  }
}, { rootMargin: '400px' });

function makeTile(item, position) {
  const t = document.createElement('button');
  t.className = 'tile';
  t.type = 'button';
  t.style.setProperty('--i', position % CONFIG.PAGE_SIZE);
  t.dataset.view = '0';

  const frame = document.createElement('span');
  frame.className = 'tile__frame';
  const img = document.createElement('img');
  img.alt = titleOf(item, null) || 'Rescued artwork';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.dataset.src = imageUrlAt(item, 0, 600);
  tileObserver.observe(img);
  frame.appendChild(img);

  const status = statusOf(item, null);
  if (status) {
    const s = document.createElement('span');
    s.className = 'tile__stamp stamp' + (isRentable(status) ? ' stamp--rent' : '');
    s.textContent = status;
    frame.appendChild(s);
  }

  const cap = document.createElement('span');
  cap.className = 'tile__cap';
  const acc = accession(item);
  const title = titleOf(item, null);
  cap.innerHTML = `<span class="tile__acc">${esc(acc)}</span>` +
    (title ? `<span class="tile__title">${esc(title)}</span>` : '') +
    (item.count > 1 ? `<span class="tile__more">${item.count} views</span>` : '');

  t.append(frame, cap);
  t.addEventListener('click', () => ensureLightbox().open(item, 0));
  return t;
}

function emptyState(mount, html) {
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = html;
  mount.appendChild(d);
}

// ===========================================================================
// PUBLIC: mountGallery — paginated grid, optional filter ('rent')
// ===========================================================================
export function mountGallery(mount, { filter = null } = {}) {
  if (!mount) return;
  const grid = document.createElement('div');
  grid.className = 'grid';
  const sentinel = document.createElement('div');
  sentinel.className = 'sentinel';
  mount.append(grid, sentinel);

  let page = 1, more = true, busy = false, shown = 0, sawStatus = false, sawAny = false;

  async function loadPage(first = false) {
    if (busy || !more) return; busy = true;
    if (first) mount.classList.add('is-loading');
    try {
      const url = `${CONFIG.WORKER}/api/items?page=${page}&pageSize=${CONFIG.PAGE_SIZE}${first ? '&nocache=1' : ''}`;
      const data = await (await fetch(url, { cache: 'no-store' })).json();
      const items = Array.isArray(data.items) ? data.items : [];
      sawAny = sawAny || items.length > 0;

      for (const it of items) {
        const status = statusOf(it, null);
        if (status) sawStatus = true;
        if (filter === 'rent' && !isRentable(status)) continue;
        grid.appendChild(makeTile(it, shown++));
      }
      more = !!data.hasMore; page += 1;
      if (!more) io.unobserve(sentinel);
    } catch (err) {
      console.error('feed load failed', err);
      more = false;
      if (first && !shown) emptyState(mount,
        `<p>The collection couldn’t load right now.</p><p class="empty__sub">Please try again shortly.</p>`);
    } finally {
      busy = false;
      mount.classList.remove('is-loading');
      // keep pulling until the viewport is full (handles tall screens / heavy filtering)
      if (more && grid.getBoundingClientRect().bottom < window.innerHeight + 200) loadPage();
      else if (filter === 'rent' && !shown && !more) showRentEmpty();
    }
  }

  function showRentEmpty() {
    if (!sawAny) return;
    emptyState(mount, sawStatus
      ? `<p>Nothing is listed for rent at the moment.</p>
         <p class="empty__sub">New pieces rotate in regularly — or email <a href="mailto:${CONFIG.EMAIL}">${CONFIG.EMAIL}</a> to ask about a specific work.</p>`
      : `<p>The rental list isn’t switched on yet.</p>
         <p class="empty__sub">Add a <code>status</code> field to each piece in the feed (e.g. “For rent”) and this page fills itself automatically.</p>`);
  }

  const io = new IntersectionObserver((e) => { if (e.some(x => x.isIntersecting)) loadPage(); }, { rootMargin: '900px' });
  loadPage(true).then(() => io.observe(sentinel));
}

// ===========================================================================
// PUBLIC: mountRecent — a short strip of the latest pieces (landing page)
// ===========================================================================
export async function mountRecent(mount, { count = 6 } = {}) {
  if (!mount) return;
  try {
    const url = `${CONFIG.WORKER}/api/items?page=1&pageSize=${count}&nocache=1`;
    const data = await (await fetch(url, { cache: 'no-store' })).json();
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, count);
    if (!items.length) { mount.closest('[data-recent]')?.remove(); return; }
    const strip = document.createElement('div');
    strip.className = 'strip';
    items.forEach((it, i) => {
      const fig = document.createElement('button');
      fig.type = 'button';
      fig.className = 'strip__item';
      fig.style.setProperty('--i', i);
      fig.innerHTML = `<span class="strip__frame"><img alt="${esc(titleOf(it, null) || 'Recent rescue')}" loading="lazy"></span>
                       <span class="strip__acc">${esc(accession(it))}</span>`;
      fig.querySelector('img').src = imageUrlAt(it, 0, 500);
      fig.addEventListener('click', () => ensureLightbox().open(it, 0));
      strip.appendChild(fig);
    });
    mount.replaceChildren(strip);
  } catch (_) {
    mount.closest('[data-recent]')?.remove();
  }
}
