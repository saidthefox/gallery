# Copilot instructions for `gallery`

## Project overview
- Static, no-build gallery site: `index.html` + `style.css` + `gallery.js` drive all behavior.
- Data comes from a remote JSON API (`EXEC` in `gallery.js`) and optional metadata lookup (`METADATA_ENDPOINT2`).
- PWA bits are minimal: `manifest.webmanifest` defines icons/colors, `sw.js` is a network-pass-through service worker.

## Architecture & data flow
- `gallery.js` fetches paged items from `${EXEC}/api/items` and renders tiles into `#grid` (`index.html`).
- Each item is expected to have `imageUrls` plus optional `token`/`variant` for metadata lookup.
- The first page uses eager loading + loader dismissal; later pages use `IntersectionObserver` + lazy loading.
- Overlay/lightbox is built client-side: `openOverlay` + `buildOverlayThumbs` + `updateOverlay`.
- Metadata is fetched per item via `getMetadata()` and injected into `#ov-meta-content`.

## Conventions to keep
- Keep top-of-file config constants (`EXEC`, `METADATA_ENDPOINT2`, `PAGE_SIZE`) together in `gallery.js`.
- Image URL selection is centralized in `imageUrlAt(item, i, w)`; reuse that when adding views.
- Touch vs. desktop behavior is split by `isTouch` media query; preserve that pattern for interactions.
- The loader is intentionally static (no progress ring); `setLoader` is a no-op by design.

## Key files
- `index.html`: layout skeleton (grid, overlay, about panel) and editable About content.
- `gallery.js`: all fetching, paging, overlay, and metadata population logic.
- `style.css`: grid, overlay, and about panel styles (flat edges, minimal chrome).
- `sw.js` + `manifest.webmanifest`: minimal PWA setup, no caching.

## Workflow notes
- No build system detected; edit files directly and serve as a static site.
- When changing API shapes, update both tile rendering and overlay metadata expectations in `gallery.js`.
