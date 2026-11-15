# UI system and the design check loop

The look is defined in one file, `src/styles/tokens.css`. Components use the Tailwind names
(`bg-primary`, `text-muted-foreground`, `text-2xl`, `shadow-sm`); never raw hex values.

## Rules
- Colour: every text pair >= 4.5:1, UI borders >= 3:1. Status = icon + text + colour, never colour alone.
- Brand: from CIC's logo (`src/assets/brand/`). Logo green `brand-green` is for graphics only (4.03:1 on
  white); text and buttons use `primary`. Use `<CicMark />` / `<CicLogo />` from `@/components/brand/CicLogo`.
- Type: Inter for body text; Courier Prime (`font-display`) for headings, the wordmark and code, echoing
  the logo. Labels in the logo style: `font-display uppercase tracking-[0.16em] text-brand-grey`.
  Sizes are fluid (`clamp`) from 320 to 1440 px. Two fonts maximum.
- Layout: mobile first; no horizontal scroll at 320, 375, 414, 768, 1024, 1280, 1440, 1920 px.
- Interaction: 44 px minimum targets (`Button` sizes already do this), visible `:focus-visible`,
  keyboard reachable, motion only when `prefers-reduced-motion` allows.
- Pages: one `<h1>`, headings in order, the layout owns the only `<main>`.
- Performance: a new feature page goes through `lazyPage()` in its `index.tsx`, so its code loads
  on its own route only. No new UI or animation library without a reason in the PR.

## Check loop (before a UI PR)
1. `npm run build` then `npm run preview` (port 4173). For sample data, build with
   `VITE_DATA_SOURCE=mock` and an empty `VITE_SUPABASE_URL`.
2. Look at the page at 375 px and 1280 px (Chrome DevTools device toolbar) and fix what looks off.
3. Lighthouse (Chrome DevTools > Lighthouse, or
   `npx lighthouse http://localhost:4173/learn --form-factor=mobile --view`): target 95+ in all four
   categories; Accessibility below 95 blocks the PR (the brief's hard requirement).

## Theme pieces (from Daxx's mockup, 2026-11-14)
- Page: pale mint with soft glows and a dot grid (`body::before` in `src/index.css`, CSS gradients only).
- Cards: `<Card>` is frosted white. Add `tint-card-yellow`, `tint-card-cyan` or `tint-card-green` for a
  coloured edge and glow; icon tiles use `bg-tint-<colour> text-tint-<colour>-fg`.
- Buttons: `default` is the glowing green gradient, `outline` has the green-to-gold gradient edge,
  `ghost` is a plain text action (add an `ArrowRight` icon for "go somewhere").
- Labels above headings: `className="eyebrow"` (Courier caps, green-to-gold text).
- Lesson rows and answer options: solid white rows (`bg-white`) with Courier titles.
