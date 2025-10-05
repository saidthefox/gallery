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

// Loader DOM
const loader = document.getElementById('loader');
const loaderPct = document.getElementById('loader-pct');
const loaderCircle = document.querySelector('#loader .fg');
const CIRC = 2 * Math.PI * 52; // r=52 (matches CSS/SVG)
if (loaderCircle) {
  loaderCircle.style.strokeDasharray = CIRC;
  loaderCircle.style.strokeDashoffset = CIRC;
}
setLoader(0);
function setLoader(pct) {
  if (!loaderPct || !loaderCircle) return;
  const clamped = Math.max(0, Math.min(100, pct));
  loaderPct.textContent = Math.round(clamped);
  loaderCircle.style.strokeDashoffset = CIRC * (1 - clamped / 100);
}
function hideLoader(){
  if (!loader) return;
  loader.style.opacity = '0';
  setTimeout(()=> { loader.style.display = 'none'; }, 200);
}

// --- helpers ---
function fileIdFromUc(url){ const m=(url||'').match(/[?&]id=([^&]+)/); return m?m[1]:''; }
function lh3Url(id,w=1600){ return id ? `https://lh3.googleusercontent.com/d/${id}=w${w}` : ''; }
function imageUrlAt(item,i,w=1600){ return lh3Url(fileIdFromUc(item.imageUrls[i] || ''), w); }

// Lazy loader
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
function makeTile(item, {eager=false} = {}){
  const t = document.createElement('div'); t.className='tile'; t.dataset.index='0';

  const wrap = document.createElement('div'); wrap.className='imgwrap';
  const img = document.createElement('img');

  if (eager) {
    // Important: do NOT use lazy loading on first page, or Safari/Chrome may defer loads.
    img.loading = 'eager';
    img.src = imageUrlAt(item, 0, 400);
  } else {
    img.loading = 'lazy';
    lazyThumb(img, imageUrlAt(item, 0, 400));
  }
  img.alt = ''; img.decoding='async';

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

  // Click => overlay (no ID)
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

// --- overlay ---
let currentItem = null;
let currentIndex = 0;

function updateOverlay(){
  if (!currentItem) return;
  ovImg.src = imageUrlAt(currentItem, currentIndex, 1600);
  ovTitle.textContent = `Photo ${currentIndex+1} of ${currentItem.imageUrls.length}`;
}
function openOverlay(item,index=0){
  currentItem = item; currentIndex = index;
  overlay.style.display='flex';
  updateOverlay();
}

ovPrev?.addEventListener('click', ()=>{ if(!currentItem) return; currentIndex = (currentIndex-1+currentItem.imageUrls.length)%currentItem.imageUrls.length; updateOverlay(); });
ovNext?.addEventListener('click', ()=>{ if(!currentItem) return; currentIndex = (currentIndex+1)%currentItem.imageUrls.length; updateOverlay(); });

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
  if (e.key === 'ArrowLeft') { currentIndex = (currentIndex-1+currentItem.imageUrls.length)%currentItem.imageUrls.length; updateOverlay(); }
  if (e.key === 'ArrowRight') { currentIndex = (currentIndex+1)%currentItem.imageUrls.length; updateOverlay(); }
});

// ---- paging + robust first-page loader ----
let nextPage = 1, hasMore = true, loading = false;
let firstPageTracked = false;

async function loadNextPage({nocache=false} = {}) {
  if (loading || !hasMore) return; loading = true;

  try {
    const url = `${EXEC}?api=items&page=${nextPage}&pageSize=${PAGE_SIZE}${nocache?'&nocache=1':''}`;
    const res = await fetch(url, { cache:'no-store' });
    const data = await res.json();

    const eager = nextPage === 1; // eagerly load first page so images actually fire 'load'
    const imgsToTrack = [];

    if (Array.isArray(data.items) && data.items.length) {
      data.items.forEach(it => {
        const { tile, imgEl } = makeTile(it, {eager});
        grid.appendChild(tile);
        if (eager) imgsToTrack.push(imgEl);
      });
    } else if (eager) {
      // No items on first page — don't leave the loader up
      hideLoader();
      firstPageTracked = true;
    }

    if (eager && !firstPageTracked) {
      firstPageTracked = true;
      await trackFirstPageLoads(imgsToTrack);
    }

    hasMore = !!data.hasMore; nextPage += 1;
    if (!hasMore) pageObserver.unobserve(sentinel);
  } catch (err) {
    console.error('Page load failed', err);
    if (!firstPageTracked) hideLoader();
  } finally {
    loading = false;
  }
}

function trackFirstPageLoads(imgEls){
  return new Promise((resolve)=>{
    const total = imgEls.length;

    // If there are no images to wait for, bail out immediately.
    if (!total) { hideLoader(); resolve(); return; }

    let done = 0;
    const bump = () => {
      done++;
      setLoader((done / total) * 100);
      if (done >= total) { hideLoader(); resolve(); }
    };

    imgEls.forEach(img=>{
      if (img.complete && img.naturalWidth > 0) {
        bump();
      } else {
        img.addEventListener('load', bump, { once:true });
        img.addEventListener('error', bump, { once:true }); // count errors too
      }
    });

    // Nudge from 0% so it feels alive
    setLoader(Math.min(10, (done/total)*100 || 5));
  });
}

const pageObserver = new IntersectionObserver((entries)=>{
  if (entries.some(e=>e.isIntersecting)) loadNextPage();
}, { rootMargin:'800px' });

(async function boot(){
  // Safety: if something goes terribly wrong, auto-hide loader after 8s
  const safety = setTimeout(()=>{ if (!document.hidden) hideLoader(); }, 8000);

  await loadNextPage({ nocache: true });
  pageObserver.observe(sentinel);

  // If we reached here and first page completed, remove safety.
  setTimeout(()=> clearTimeout(safety), 9000);
})();
