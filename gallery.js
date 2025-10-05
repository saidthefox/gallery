// --- CONFIG: your Apps Script Web App URL (no trailing slash)
const EXEC = 'https://script.google.com/macros/s/AKfycbyh2wrTXGhKAkoCEqt_ZN2HzoSX6w360OMcLw9hBP5Mn35uX7-hS1WBTahXyLZpvJEE/exec';
const PAGE_SIZE = 24;

const isTouch = window.matchMedia('(pointer: coarse)').matches;

// --- DOM refs ---
const grid = document.getElementById('grid');
const sentinel = document.getElementById('sentinel');
const overlay = document.getElementById('overlay');
const ovImg = document.getElementById('ov-img');
const ovTitle = document.getElementById('ov-title');
const ovPrev = document.getElementById('ov-prev');
const ovNext = document.getElementById('ov-next');
document.getElementById('ov-close').onclick = () => overlay.style.display = 'none';
// About panel elements (may be absent in some edits)
const aboutToggle = document.getElementById('about-toggle');
const aboutPanel = document.getElementById('about-panel');
const aboutClose = document.getElementById('about-close');
const aboutContent = document.getElementById('about-content');
let lastFocusedBeforeAbout = null;

if (aboutToggle && aboutPanel) {
  aboutToggle.addEventListener('click', () => {
    const expanded = aboutToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) closeAbout(); else openAbout();
  });
}
if (aboutClose) aboutClose.addEventListener('click', closeAbout);

function openAbout(){
  if (!aboutPanel || !aboutToggle) return;
  lastFocusedBeforeAbout = document.activeElement;
  aboutPanel.setAttribute('aria-hidden', 'false');
  aboutToggle.setAttribute('aria-expanded', 'true');
  // move focus into the panel
  const first = aboutPanel.querySelector('button, a, [tabindex], input, textarea') || aboutPanel;
  (first).focus && (first).focus();
}

function closeAbout(){
  if (!aboutPanel || !aboutToggle) return;
  aboutPanel.setAttribute('aria-hidden', 'true');
  aboutToggle.setAttribute('aria-expanded', 'false');
  // restore focus
  try { if (lastFocusedBeforeAbout && lastFocusedBeforeAbout.focus) lastFocusedBeforeAbout.focus(); } catch(e){}
}

// close about with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (aboutPanel && aboutPanel.getAttribute('aria-hidden') === 'false') closeAbout();
  }
});

// Loader DOM
const loader = document.getElementById('loader');
// loader text only; no percentage element
// circumference for r=52 (matches SVG)
const CIRC = 2 * Math.PI * 52;
// Ensure loader is visible at startup (in case CSS or race hid it)
if (loader) {
  loader.style.display = loader.style.display || 'flex';
  loader.style.opacity = loader.style.opacity || '1';
}

// Loader is now static (no animated progress). setLoader is a no-op.
setLoader(0);
function setLoader(pct) { /* noop - static loading text only */ }
function hideLoader() {
  if (!loader) return;
  loader.style.opacity = '0';
  setTimeout(() => { loader.style.display = 'none'; }, 200);
  // Reveal the about toggle after loader hides
  try {
    document.body.classList.add('about-ready');
    if (aboutToggle) aboutToggle.removeAttribute('aria-hidden');
  } catch (e) { /* ignore */ }
}

// --- helpers ---
function fileIdFromUc(url){ const m=(url||'').match(/[?&]id=([^&]+)/); return m?m[1]:''; }
function lh3Url(id,w=1600){ return id ? `https://lh3.googleusercontent.com/d/${id}=w${w}` : ''; }
function imageUrlAt(item,i,w=1600){ return lh3Url(fileIdFromUc(item.imageUrls[i] || ''), w); }

// Lazy loader (used for pages after the first)
const lazyObserver = new IntersectionObserver((entries)=>{
  for (const ent of entries) {
    if (!ent.isIntersecting) continue;
    const img = ent.target;
    if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
    lazyObserver.unobserve(img);
  }
}, { rootMargin: '300px' });
function lazyThumb(img, src){ img.dataset.src = src; lazyObserver.observe(img); }

// --- tile factory ---
function makeTile(item, {eager=false} = {}) {
  const t = document.createElement('div'); t.className='tile'; t.dataset.index='0';

  const wrap = document.createElement('div'); wrap.className='imgwrap';
  const img = document.createElement('img');
  img.alt = ''; img.decoding = 'async';

  if (eager) {
    // First page: force actual loading so events fire reliably
    img.loading = 'eager';
    img.fetchPriority = 'high';
    img.src = imageUrlAt(item, 0, 400);
  } else {
    img.loading = 'lazy';
    lazyThumb(img, imageUrlAt(item, 0, 400));
  }

  const hint = document.createElement('div'); hint.className='hint';
  hint.textContent = `${item.count} photo${item.count>1?'s':''}${isTouch?' — swipe':''}`;
  wrap.append(img, hint);
  t.append(wrap);

  const change = (delta) => changeTileImage(item, t, delta);

  // Touch: swipe; Desktop: click arrows
  if (isTouch) {
    let startX=null;
    wrap.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;},{passive:true});
    wrap.addEventListener('touchmove',e=>{
      if(startX==null) return;
      const dx=e.touches[0].clientX-startX;
      if(Math.abs(dx)>40){ change(dx>0?-1:1); startX=e.touches[0].clientX; }
    },{passive:true});
  } else {
    const left = document.createElement('button');
    left.className = 'arrow left';
    left.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
    const right = document.createElement('button');
    right.className = 'arrow right';
    right.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>';
    left.addEventListener('click', (e)=>{ e.stopPropagation(); change(-1); });
    right.addEventListener('click', (e)=>{ e.stopPropagation(); change(1); });
    t.append(left, right);
  }

  // Click => overlay
  t.addEventListener('click',()=>openOverlay(item, +t.dataset.index||0));

  return { tile: t, imgEl: img };
}

function changeTileImage(item,tile,delta){
  const n = item.imageUrls.length;
  const idx = +tile.dataset.index || 0;
  const next = (idx + delta + n) % n;
  tile.dataset.index = String(next);
  const img = tile.querySelector('img');
  const nextUrl = imageUrlAt(item, next, 400);
  if (img.dataset.src !== nextUrl) { img.dataset.src = nextUrl; lazyObserver.observe(img); }
}

// --- overlay / lightbox ---
let currentItem = null;
let currentIndex = 0;
// Build the stacked thumbnail column for the overlay
function buildOverlayThumbs(item){
  const container = document.getElementById('ov-thumbs');
  if (!container) return;
  container.innerHTML = '';
  const urls = (item && item.imageUrls) ? item.imageUrls : [];
  urls.forEach((u, i) => {
    const img = document.createElement('img');
    img.src = imageUrlAt(item, i, 400);
    img.alt = `Thumbnail ${i+1}`;
    img.tabIndex = 0;
    img.addEventListener('click', () => { currentIndex = i; updateOverlay(); });
    img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); currentIndex = i; updateOverlay(); } });
    container.appendChild(img);
  });
}
function updateOverlay(){
  if (!currentItem) return;
  ovImg.src = imageUrlAt(currentItem, currentIndex, 1600);
  ovTitle.textContent = `Photo ${currentIndex+1} of ${currentItem.imageUrls.length}`;
  // highlight active thumb
  try {
    const thumbs = document.querySelectorAll('#ov-thumbs img');
    thumbs.forEach((t, i) => t.classList.toggle('active', i === currentIndex));
  } catch (e) {}
}
function openOverlay(item,index=0){
  currentItem = item; currentIndex = index;
  overlay.style.display='flex';
  buildOverlayThumbs(item);
  updateOverlay();
}
ovPrev?.addEventListener('click', ()=>{ if(!currentItem) return; currentIndex=(currentIndex-1+currentItem.imageUrls.length)%currentItem.imageUrls.length; updateOverlay(); });
ovNext?.addEventListener('click', ()=>{ if(!currentItem) return; currentIndex=(currentIndex+1)%currentItem.imageUrls.length; updateOverlay(); });

// Mobile swipe inside overlay; keyboard arrows on desktop
let startX=null;
ovImg.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive:true });
ovImg.addEventListener('touchmove', e => {
  if (startX==null || !currentItem) return;
  const dx = e.touches[0].clientX - startX;
  if (Math.abs(dx) > 40) {
    currentIndex = (currentIndex + (dx>0?-1:1) + currentItem.imageUrls.length) % currentItem.imageUrls.length;
    updateOverlay();
    startX = e.touches[0].clientX;
  }
}, { passive:true });
document.addEventListener('keydown', (e)=>{
  if (overlay.style.display !== 'flex') return;
  if (e.key === 'Escape') overlay.style.display = 'none';
  if (!currentItem) return;
  if (e.key === 'ArrowLeft') { currentIndex=(currentIndex-1+currentItem.imageUrls.length)%currentItem.imageUrls.length; updateOverlay(); }
  if (e.key === 'ArrowRight') { currentIndex=(currentIndex+1)%currentItem.imageUrls.length; updateOverlay(); }
});

// ---- paging + bulletproof first-page progress ----
let nextPage = 1, hasMore = true, loading = false;
let firstPageTracked = false;

async function loadNextPage({nocache=false} = {}) {
  if (loading || !hasMore) return; loading = true;

  try {
    const url = `${EXEC}?api=items&page=${nextPage}&pageSize=${PAGE_SIZE}${nocache?'&nocache=1':''}`;
    const res = await fetch(url, { cache:'no-store' });
    const data = await res.json();

    const eager = nextPage === 1; // only the very first page participates in loader
    const imgsToTrack = [];

    if (Array.isArray(data.items) && data.items.length) {
      data.items.forEach(it => {
        const { tile, imgEl } = makeTile(it, { eager });
        grid.appendChild(tile);
        if (eager) imgsToTrack.push(imgEl);
      });
    }

    // first page progress tracking
    if (eager && !firstPageTracked) {
      firstPageTracked = true;
      await trackFirstPage(imgsToTrack);
    }

    hasMore = !!data.hasMore; nextPage += 1;
    if (!hasMore) pageObserver.unobserve(sentinel);
  } catch (err) {
    console.error('Page load failed', err);
    // Don’t leave the loader up if the request fails
    if (!firstPageTracked) hideLoader();
  } finally {
    loading = false;
  }
}

/** Waits for first-page thumbnails to be decoded/loaded, with robust fallbacks. */
async function trackFirstPage(imgEls) {
  // No images? Dismiss quickly.
  if (!imgEls || !imgEls.length) { setLoader(100); hideLoader(); return; }

  const total = imgEls.length;
  let done = 0;
  setLoader(1);

  const waitFor = (img, timeoutMs = 7000) => new Promise((resolve) => {
    // already ready (from cache)
    if (img.complete && img.naturalWidth > 0) return resolve();

    let settled = false;
    const finalize = () => { if (settled) return; settled = true; resolve(); };

    // prefer decode() when available
    if (img.decode) {
      img.decode().then(finalize).catch(()=>{/* fall back to events */});
    }

    const onEnd = () => finalize();
    img.addEventListener('load', onEnd, { once: true });
    img.addEventListener('error', onEnd, { once: true });

    // ensure we don't wait forever
    setTimeout(finalize, timeoutMs);
  });

  // Kick off all waits in parallel; as each settles, increment progress
  const promises = imgEls.map(img => {
    // ensure the same URL is requested (sometimes dataset vs src differs)
    if (!img.src) img.src = img.dataset?.src || img.getAttribute('src') || '';

    return waitFor(img).then(() => {
      done++;
      setLoader((done / total) * 100);
    }).catch(() => {
      done++;
      setLoader((done / total) * 100);
    });
  });

  await Promise.all(promises);
  hideLoader();
}

const pageObserver = new IntersectionObserver((entries)=>{
  if (entries.some(e=>e.isIntersecting)) loadNextPage();
}, { rootMargin:'800px' });

(async function boot(){
  // Absolute fallback: never let the loader sit forever.
  const hardFail = setTimeout(() => hideLoader(), 9000);

  await loadNextPage({ nocache: true });
  pageObserver.observe(sentinel);

  // If first page finished, remove the hard fail (no-op if already hidden)
  setTimeout(() => clearTimeout(hardFail), 10000);
})();
