# rescued.art — front-end

A static, build-free front-end for your existing GitHub Pages + Cloudflare Worker +
Apps Script setup. Drop these files into your repo root; nothing server-side changes.

## What's here

```
index.html              landing / hub
gallery/index.html      the full archive grid
rent/index.html         rentable pieces (filtered) + the pitch
visit/index.html        First Fridays, by-appointment, events
assets/config.js        ALL endpoints live here — edit nothing else
assets/core.css         the design system
assets/gallery.js       the engine (feed, lightbox, metadata, filtering)
sw.js                   real service worker (installable + offline shell)
manifest.webmanifest    PWA manifest (your old HTML referenced a missing one)
icon-192.png            your existing logo
```

## Deploy

1. Copy everything into your Pages repo root, replacing the old `index.html`,
   `style.css`, `gallery.js`, `sw.js`.
2. Commit and push. Paths are root-absolute (`/assets/...`), which is correct for
   an apex custom domain (rescued.art). They work uniformly across `/gallery/` and
   `/rent/`. (If you ever host under a subpath instead, switch them to relative.)
3. Done. The site reads your current `{WORKER}/api/items` feed and `{META}?api=meta`
   exactly as before.

## ⚠️ Do this first: rotate the delete token

Your old `gallery.js` contained, in a code comment, a live delete URL:
`/delete?token=…`. Anything in a file served by Pages is public (view-source).
**Rotate that token on the Worker now** — treat the old one as compromised — and
ideally move delete behind real auth rather than a token sitting in client code.
None of the new files contain it.

## How to light up titles, prices, and the Rent page

The UI already renders these the moment your data provides them — no code changes:

- **Titles / prices / found-location / medium / size / year** — return any of these
  fields from your Apps Script `?api=meta` response (or include them on items in the
  Worker feed). Tiles and the lightbox pick them up automatically.
- **The Rent page** filters on a `status` field. Add `status` to each piece (e.g.
  `"For rent"`, `"For sale"`, `"On loan"`). Values containing any of the strings in
  `RENTABLE_STATUSES` (in `config.js`) show on `/rent/` and get a green stamp; others
  get the vermillion stamp on the archive. Until you add `status`, `/rent/` shows a
  short note explaining exactly that.

## Notes

- **Thumbnails are now sized.** `assets/gallery.js` requests right-sized images for
  tiles instead of full-res (the old code ignored its width argument). It auto-detects
  common Google Drive / googleusercontent URL shapes; unknown shapes pass through
  untouched. If your `imageUrls` use a format it doesn't recognise, tell me the shape
  and I'll extend `sizedUrl()`.
- **GPS stays private.** The public feed carries no location, and the UI never asks
  for one — keep precise capture coords on your private side; only surface a rounded
  "found" location if you ever want to.
- No `localStorage` / cookies; metadata is cached in memory per session.
