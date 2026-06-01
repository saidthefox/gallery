// =============================================================================
// rescued.art — central configuration
// Edit endpoints here ONLY. Every page imports from this file.
// =============================================================================
export const CONFIG = {
  IMG_HOST: 'https://img.rescued.art',  // your R2 custom domain; leave '' to disable resizing
  // Your Cloudflare Worker (serves the paginated image feed at /api/items)
  WORKER: 'https://rescued-art-sync.rescuedart.workers.dev',

  // Your Apps Script web app (serves per-piece metadata at ?api=meta&key=TOKEN)
  META: 'https://script.google.com/macros/s/AKfycbzXYKl5Wi1iOplK9d4mZNHtg-H70H9lb07JkitkPrl0Zb7pVoh8sPYWTxzicUtlE-a4/exec',

  PAGE_SIZE: 24,

  // Contact + venue (used on landing / visit / rent pages)
  EMAIL: 'jake@rescued.art',
  VENUE: 'Blue Star Arts Complex — 117 Blue Star, behind Contemporary',
  HOURS: 'Every First Friday, ~7–11pm · otherwise by appointment',

  // When your feed (or metadata) starts returning a `status` field per piece,
  // /rent will automatically show only the rentable ones. Values treated as
  // rentable are listed here (matched case-insensitively, substring OK).
  RENTABLE_STATUSES: ['for rent', 'for_rent', 'rent', 'available', 'for sale or rent'],
};

// --- Service worker (installability + offline shell). Safe to keep; it never
// caches the live feed, so your art is always fresh. -------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
  });
}
