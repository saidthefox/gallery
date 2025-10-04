// --- CONFIG: your Apps Script Web App URL (no trailing slash)
const EXEC = 'https://script.google.com/macros/s/AKfycbyh2wrTXGhKAkoCEqt_ZN2HzoSX6w360OMcLw9hBP5Mn35uX7-hS1WBTahXyLZpvJEE/exec';
const PAGE_SIZE = 24;

// --- environment helpers ---
const isTouch = window.matchMedia('(pointer: coarse)').matches;

// --- DOM refs ---
const grid = document.getElementById('grid');
const sentinel = document.getElementById('sentinel');
const overlay = document.getElementById('overlay');
const ovImg = document.getElementById('ov-img');
const ovTitle = document.getElementById('ov-title');
document.getElementById('ov-close').onclick = () => overlay.style.display = 'none';

// If these exist in your HTML they’ll still work; otherwise harmless.
const buyBtn = document.getElementById('btn-buy');
const rentBtn = document.getElementById('btn-rent');
if (buyBtn) buyBtn.onclick = () => {};
if (rentBtn) rentBtn.onclick = () => {};

// --- image URL helpers ---
function fileIdFromUc(url){ const m=(url||'').match(/[?&]id=([^&]+)/); return m?m[1]:''; }
function lh3Url(id,w=1600){ return id ? `https://lh3.googleusercontent.com/d/${id}=w${w}` : ''; }
function imageUrlAt(item,i,w=1600){ return lh3Url(fileIdFromUc(item.imageUrls[i] || ''), w); }

// --- lazy thumb loader ---
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
function makeTile(item){
  const t = document.createElement('div'); t.className='tile'; t.dataset.token=item.token; t.dataset.index='0';

  const wrap = document.createElement('div'); wrap.className='imgwrap';
  const img = document.createElement('img');
  lazyThumb(img, imageUrlAt(item, 0, 400)); // fast thumbnail
  img.alt = ''; img.loading='lazy'; img.decoding='async';

  const hint = document.createElement('div'); hint.className='hint';
  hint.textContent = `${item.count} photo${item.count>1?'s':''}${isTouch?' — swipe':''}`;
  wrap.append(img, hint);
  t.append(wrap);

  // --- navigation (mobile: swipe only; desktop: arrow buttons) ---
  const change = (delta) => changeTileImage(item, t, delta);

  if (isTouch) {
    // Touch-only swipe
    let startX=null;
    wrap.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;},{passive:true});
    wrap.addEventListener('touchmove',e=>{
      if(startX==null) return;
      const dx=e.touches[0].clientX-startX;
      if(Math.abs(dx)>40){ change(dx>0?-1:1); startX=e.touches[0].clientX; }
    },{passive:true});
  } else {
    // Desktop clickable arrows (appear via CSS on hover)
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

  // Open overlay on click (no token/ID in the title)
  t.addEventListener('click',()=>openOverlay(item, +t.dataset.index||0));

  // Bottom meta was previously added here; we omit it now (hidden in CSS anyway)
  return t;
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
function openOverlay(item,index=0){
  overlay.style.display='flex';
  // Title shows only counter now (no ID)
  ovTitle.textContent = `Photo ${index+1} of ${item.imageUrls.length}`;
  ovImg.src = imageUrlAt(item, index, 1600);

  // Mobile swipe inside overlay; desktop can use keyboard arrows
  let startX=null;
  ovImg.ontouchstart = e => { startX = e.touches[0].clientX; };
  ovImg.ontouchmove = e => {
    if (startX==null) return;
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      index = (index + (dx>0?-1:1) + item.imageUrls.length) % item.imageUrls.length;
      ovTitle.textContent = `Photo ${index+1} of ${item.imageUrls.length}`;
      ovImg.src = imageUrlAt(item, index, 1600);
      startX = e.touches[0].clientX;
    }
  };

  // Optional: keyboard left/right on desktop
  const onKey = (e) => {
    if (e.key === 'Escape') overlay.style.display='none';
    if (e.key === 'ArrowLeft') {
      index = (index - 1 + item.imageUrls.length) % item.imageUrls.length;
      ovTitle.textContent = `Photo ${index+1} of ${item.imageUrls.length}`;
      ovImg.src = imageUrlAt(item, index, 1600);
    }
    if (e.key === 'ArrowRight') {
      index = (index + 1) % item.imageUrls.length;
      ovTitle.textContent = `Photo ${index+1} of ${item.imageUrls.length}`;
      ovImg.src = imageUrlAt(item, index, 1600);
    }
  };
  document.addEventListener('keydown', onKey, { once:false });

  // When overlay closes, remove key handler
  const mo = new MutationObserver(()=>{
    if (overlay.style.display === 'none') {
      document.removeEventListener('keydown', onKey);
      mo.disconnect();
    }
  });
  mo.observe(overlay, { attributes:true, attributeFilter:['style'] });
}

// ---- paging ----
let nextPage = 1, hasMore = true, loading = false;

async function loadNextPage({nocache=false} = {}) {
  if (loading || !hasMore) return; loading = true;
  try {
    const url = `${EXEC}?api=items&page=${nextPage}&pageSize=${PAGE_SIZE}${nocache?'&nocache=1':''}`;
    const res = await fetch(url, { cache:'no-store' });
    const data = await res.json();

    if (Array.isArray(data.items)) data.items.forEach(it => grid.appendChild(makeTile(it)));
    hasMore = !!data.hasMore; nextPage += 1;
    if (!hasMore) pageObserver.unobserve(sentinel);
  } catch (err) {
    console.error('Page load failed', err);
  } finally { loading = false; }
}

const pageObserver = new IntersectionObserver((entries)=>{
  if (entries.some(e=>e.isIntersecting)) loadNextPage();
}, { rootMargin:'800px' });

(async function boot(){
  // eager first page (bypass cache once)
  await loadNextPage({ nocache: true });
  pageObserver.observe(sentinel);
})();
