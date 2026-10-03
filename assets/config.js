// =============================================================================
// rescued.art — central configuration
// Edit endpoints here ONLY. Every page imports from this file.
// =============================================================================
export const CONFIG = {
  IMG_HOST: 'https://img.rescued.art',  // R2 custom domain (Cloudflare image resizing); leave '' to disable
  // rescued.art backend (FastAPI on the homelab). Serves the paginated feed at /api/items.
  WORKER: 'https://api.rescued.art',

  // Per-piece metadata endpoint on the same backend (?api=meta&key=TOKEN).
  META: 'https://api.rescued.art/api/meta',

  PAGE_SIZE: 24,

  // Contact + venue (used on landing / visit / rent pages)
  EMAIL: 'jake@rescued.art',
  VENUE: 'Behind Contemporary / Bar 1919, Southtown — address on request',
  // First Fridays are paused (2026-10-02, Jake): visits are by appointment until he decides. To bring them
  // back, set FIRST_FRIDAYS_OPEN: true, restore HOURS, and restore the First Friday lines in index.html and
  // visit/index.html (see git history).
  FIRST_FRIDAYS_OPEN: false,
  HOURS: 'By appointment',

  // When your feed (or metadata) starts returning a `status` field per piece,
  // /rent will automatically show only the rentable ones. Values treated as
  // rentable are listed here (matched case-insensitively, substring OK).
  RENTABLE_STATUSES: ['for rent', 'for_rent', 'rent', 'available', 'for sale or rent'],
};

// --- Next First Friday: fills any element marked data-next-ff -----------------
// "Open tonight" on the day itself; otherwise the date of the next one (local time).
export function nextFirstFriday(now = new Date()) {
  const firstFriday = (y, m) => { const d = new Date(y, m, 1); d.setDate(1 + ((5 - d.getDay() + 7) % 7)); return d; };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let ff = firstFriday(now.getFullYear(), now.getMonth());
  if (ff < today) ff = firstFriday(now.getFullYear(), now.getMonth() + 1);
  return { date: ff, tonight: ff.getTime() === today.getTime() };
}
function fillNextFirstFriday() {
  if (!CONFIG.FIRST_FRIDAYS_OPEN) {  // paused: the static text says "by appointment"
    document.querySelectorAll('[data-next-ff]').forEach(el => { el.textContent = ''; });
    return;
  }
  const { date, tonight } = nextFirstFriday();
  const text = tonight ? 'Open tonight, ~7–11pm.'
    : 'Next First Friday: ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '.';
  document.querySelectorAll('[data-next-ff]').forEach(el => { el.textContent = text; });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillNextFirstFriday);
else fillNextFirstFriday();

// --- Service worker (installability + offline shell). Safe to keep; it never
// caches the live feed, so your art is always fresh. -------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
  });
}
