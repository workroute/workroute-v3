# Marketing page integration notes

This is a handoff note for whoever builds the public marketing/landing page
at `workroute.com.au` (currently ChatGPT) — not general project setup, see
`README.md` for that.

## Routes contract

- **JOIN NOW** → `/signup`
- **LOG IN** → `/login`

Both already exist and are stable — don't rename or move them.

## What you own vs. what you don't

- You own `app/page.tsx` — a temporary placeholder is there now
  (`JOIN NOW`/`LOG IN` + a one-line pitch). Replace it wholesale with the
  real marketing page — **except keep the logged-in redirect at the top**:
  it checks `getAuthedUser()` and `redirect("/app")`s if someone's already
  signed in, so a returning user who types the bare domain (instead of
  using their bookmark/installed icon) lands straight in the app instead of
  seeing the marketing pitch again. Copy that check into whatever you
  replace this file with.
- You may add sibling marketing routes/assets under `app/` (e.g.
  `app/pricing/page.tsx`, `app/how-it-works/page.tsx`) as long as they
  don't collide with `/app`, `/login`, `/signup`, `/auth`, `/api`, or `/m`.
- Everything under `/app/**` is the actual product and is out of scope —
  don't edit anything in `app/app/`.

## PWA install is fully handled app-side

Nothing to implement here for "Install WorkRoute" — after a customer signs
up and confirms their email, the app itself shows a dedicated install
screen (custom install button where the browser supports it, Safari
"Add to Home Screen" instructions on iOS). The marketing page just needs to
link to `/signup`; the rest happens automatically.

## Root layout is shared

`app/layout.tsx` (fonts, page metadata defaults, service worker
registration) wraps every page in this project, including the marketing
page. Don't duplicate `<html>`/`<body>` tags or re-register fonts — they're
already available as CSS variables from the root layout. Override
`metadata` per-page (e.g. a different `<title>`/description for the
marketing homepage) using Next.js's normal per-page `metadata` export.

## Same origin, no auth bridging needed

This is one Next.js app, one deploy — cookies/session are automatically
shared between the marketing page and the product. No tokens to pass
around, no cross-origin auth handshake needed.

## One thing to know, not to touch

`app/manifest.ts`'s `start_url`/`scope` point at `/app`, not `/` — that's
intentional (the installed PWA icon should open the dashboard, not
marketing). You shouldn't need to touch this file at all.
