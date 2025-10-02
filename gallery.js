// --- CONFIG: your Apps Script Web App URL (no trailing slash)
const EXEC = 'https://script.google.com/macros/s/AKfycbyh2wrTXGhKAkoCEqt_ZN2HzoSX6w360OMcLw9hBP5Mn35uX7-hS1WBTahXyLZpvJEE/exec';
const PAGE_SIZE = 24;

// --- helpers ---
const grid = document.getElementById('grid');
const sentinel = document.getElementById('sentinel');
const overlay = document.getElementById('overlay');
const ovImg = document.getElementById('ov-img');
const ovTitle = document.getElementById('ov-title');
document.getElementById('ov-close').onclick = () => overlay.style.display = 'none';
document.getElementById('btn-buy').onclick = () => alert('Buy flow coming soon');
document.getElementById('btn-rent').onclick = () => alert('Rent flow coming soon');

function fileIdFromUc(url){ const m=(url||'').match(/[?&]id=([^&]+)/); return m?m[1]:''; }
function lh3Url(id,w=1600){ return id ? `https://lh3.googleusercontent.com/d/${id}=w${w}` : ''; }
function imageUrlAt(item,i,w=1600){ return lh3Url(fileIdFromUc(item.imageUrls[i] || ''), w); }

// Lazy thumb loader
const lazyObserver = new IntersectionObserver((entries)=>{
  for (const ent of entries) {
    if (!ent.isIntersecting) continue;
    const img = ent.target;
    if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
    lazyObserver.unobserve(img);
  }
}, { rootMargin: '300px' });

function lazyThumb(img, src){ img.dataset.src = src; lazyObserver.observe(img); }

// Build a tile
function makeTile(item){
  const t = document.createElement('div'); t.className='tile'; t.dataset.token=item.token; t.dataset.index='0';

  const wrap = document.createElement('div'); wrap.className='imgwrap';
  const img = document.createElement('img');
  lazyThumb(img, imageUrlAt(item, 0, 400)); // fast thumbnail
  img.alt = item.token; img.loading='lazy'; img.decoding='async';
  const hint = document.createElement('div'); hint.className='hint';
  hint.textContent = `${item.count} photo${item.count>1?'s':''} — swipe`;
  wrap.append(img, hint); t.append(wrap);

  const meta = document.createElement('div'); meta.className='meta';
  meta.innerHTML = `<span class="token">${item.token}</span><span class="count">${item.count}</span>`;
  t.append(meta);

  // swipe/drag
  let startX=null, mouseStart=null;
  wrap.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;},{passive:true});
  wrap.addEventListener('touchmove',e=>{
    if(startX==null) return;
    const dx=e.touches[0].clientX-startX;
    if(Math.abs(dx)>40){ changeTileImage(item,t,dx>0?-1:1); startX=e.touches[0].clientX; }
  },{passive:true});
  wrap.addEventListener('mousedown',e=>{mouseStart=e.clientX;});
  wrap.addEventListener('mouseup',e=>{
    if(mouseStart==null) return;
    const dx=e.clientX-mouseStart;
    if(Math.abs(dx)>40) changeTileImage(item,t,dx>0?-1:1);
    mouseStart=null;
  });

  t.addEventListener('click',()=>openOverlay(item, +t.dataset.index||0));
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

function openOverlay(item,index=0){
  overlay.style.display='flex';
  ovTitle.textContent = `${item.token} (${index+1}/${item.imageUrls.length})`;
  ovImg.src = imageUrlAt(item, index, 1600);
  let startX=null;
  ovImg.ontouchstart = e => { startX = e.touches[0].clientX; };
  ovImg.ontouchmove = e => {
    if (startX==null) return;
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      index = (index + (dx>0?-1:1) + item.imageUrls.length) % item.imageUrls.length;
      ovTitle.textContent = `${item.token} (${index+1}/${item.imageUrls.length})`;
      ovImg.src = imageUrlAt(item, index, 1600);
      startX = e.touches[0].clientX;
    }
  };
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
