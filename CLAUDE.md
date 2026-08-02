# Space Prints — Shopify Theme

## What this is

A Shopify store selling fine-art prints of NASA space photography. Not yet launched. This repo (`space-prints`) is a fully custom theme built from scratch — not a stock theme — on Shopify's Online Store 2.0 architecture, starting from the Dawn reference theme.

Preview with `shopify theme dev`.

Planning, content, and strategy for this project happen in a separate Claude project (chat-based), not in this repo. If deeper context is ever needed on a decision, ask rather than assume.

## Site structure

Build/maintain templates and sections for:

- Homepage
- Shop/collection page — filterable by planet, mission, or subject (e.g. Mars, Nebulae, Earth, Deep Space)
- Product page
- Collection landing pages
- Blog
- Cart
- About/story
- FAQ
- Search results
- 404

## Product page — required features

- High-res, zoomable image viewer
- Size/frame variant selector, paired with a simple dimension/ruler-style size comparison graphic — **explicitly not a human silhouette graphic**
- Related photos module

## Explicitly excluded (for now)

- No NASA metadata panel (mission, telescope, capture date) on product pages
- No source links back to NASA on product pages
- Revisit later: `images.nasa.gov` is a free/open API and could auto-populate this metadata once specific photos are selected — no manual data entry needed if we go this route. Don't build toward this yet, just don't architect anything that would block it.

## Style direction

Dark, high-contrast, image-first, minimal UI chrome. Aim for a planetarium/observatory feel — not the typical bright, cluttered e-commerce look. Let the photography carry the page; UI should recede.

## SEO priorities

In order:

1. Descriptive alt text and file naming on every product image (photo/print stores get meaningful traffic via Google Images)
2. Product structured data (schema.org)
3. Fast image loading — responsive sizing, lazy load, WebP

Formal keyword research (Semrush/Ahrefs) is deferred until post-launch/budget allows. Don't invent target keywords — use straightforward, accurate descriptions until research happens. Blog topic strategy is also on hold pending that research.

## Other decisions in play

- Considering a lightweight email capture (e.g. "photo of the week") for pre-launch list-building — not yet spec'd or built.

## Working conventions

- Work template-by-template / section-by-section rather than attempting the whole structure in one pass.
- Match Dawn's existing OS 2.0 patterns (sections, blocks, schema) unless there's a specific reason to diverge — this keeps the theme editor usable for non-devs later.
- Flag any place where a feature request conflicts with the exclusions above rather than building around it silently.
