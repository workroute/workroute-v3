# WorkRoute — Phase 1 scaffold

This is a working Next.js app with:
- Email/password signup and login (via Supabase Auth)
- A protected "Business profile" page
- A job capture form matching §10 of the locked spec, with trade-specific
  questions (§8a), an estimate + confidence indicator, and a timestamped
  arrival photo tagged to the business (§10a/§14)
- A drag-and-drop run sheet (§12) grouped by Today/Tomorrow/Future, with
  scheduling (§10a-i), quote-visit badges (§10a-ii), and status changes
  through the full §10 flow
- Tailwind styling with a look built for WorkRoute, not default Tailwind gray
- Installable as a home-screen app (manifest, icons, a basic service worker
  for patchy job-site connections, and an Add to Home Screen prompt)
- Client records (§19) — separate from jobs, with a job history per client,
  and autocomplete client selection built into job capture
- Job outcome tracking (§20) — mark a job Lost or Declined, or let it become
  Won automatically when it's Completed
- Voice-to-text client notes (§21) — dictate straight into the Notes field
  in Chrome, via the browser's built-in Web Speech API
- WorkRoute Messenger — SMS is now a one-way invitation only (§13); the
  actual two-way conversation happens in an in-house, white-labeled web chat
  with an AI agent that replies in-character as the tradie's business, can
  check the schedule and reschedule the job itself when it's confident, and
  otherwise flags a Low/Medium/High priority for the tradie to handle
- §23: WorkRoute is never mentioned in anything a customer sees — SMS,
  Messenger, and any future customer-facing feature only ever show the
  tradie's own name
- §27 dashboard redesign — a persistent sidebar (nav, AI Secretary
  indicator, tradie profile) across every authenticated page, a rebuilt
  home dashboard with a greeting + local weather, a "+ New Job" button, and
  a date-grouped Future column, plus a new all-jobs list page
- The product now lives under `/app` (e.g. `/app/run-sheet`, `/app/clients`)
  — `/` is a temporary placeholder reserved for a separate public marketing
  page (see `MARKETING_INTEGRATION.md`). After signup, a one-time `/app/welcome`
  screen promotes installing WorkRoute as a home-screen app before landing
  on the dashboard.
- Web Push notifications — customers get pushed a heads-up when the tradie
  or the AI replies in Messenger, and the owner gets pushed high-priority
  Messenger flags and a bad-weather warning for scheduled jobs, all on top
  of (never instead of) the existing SMS, which stays the reliable fallback
  especially for iOS customers who haven't installed the page to their
  home screen yet.

Nothing runs yet until you do the setup below — there's no server running
on your computer permanently, and no database connected. You're doing that now.

## 1. Install the tools you need (one-time)

- Install **Node.js** (v18 or later): https://nodejs.org — download the
  "LTS" installer for your OS and run it like any other app installer.
- You don't need to install anything else globally. `npm` (Node's package
  manager) comes bundled with Node.

## 2. Create your Supabase project (one-time)

Supabase is the hosted database + auth service this app talks to.

1. Go to https://supabase.com and sign up (free tier is fine).
2. Click **New project**. Pick a name (e.g. "workroute"), a database
   password (save it somewhere), and a region close to you (Sydney).
3. Wait ~2 minutes for it to provision.
4. In the left sidebar go to **Project Settings > API**. You'll need two
   values from this page in step 4: **Project URL** and the **anon public** key.

## 3. Set up the database table

1. In Supabase, open **SQL Editor** (left sidebar) > **New query**.
2. Open `supabase/migrations/0001_init.sql` from this project, copy its
   contents, paste into the SQL editor, and click **Run**.
3. This creates a `business_profiles` table and locks it down so each
   tradie can only ever see their own profile.
4. Repeat with `supabase/migrations/0002_jobs.sql` — run it as a second
   query. This adds the `jobs` table plus a private storage bucket for
   arrival photos, both locked to the logged-in business the same way.
5. Repeat again with `supabase/migrations/0003_run_sheet.sql` — this adds
   the scheduling fields the run sheet needs (date, time slot, drag order).
6. Repeat again with `supabase/migrations/0004_clients.sql` — this adds
   the `clients` table and links `jobs` to it.
7. Repeat again with `supabase/migrations/0005_job_outcomes.sql` — this adds
   the `outcome` field (Won/Lost/Declined) to `jobs`.
8. Repeat again with `supabase/migrations/0006_business_first_name.sql` —
   this adds your first name to `business_profiles`, used in customer SMS.
9. Repeat again with `supabase/migrations/0007_messenger.sql` — this adds
   WorkRoute Messenger: the `messages` table, the per-job customer link, and
   the database functions that power it.
10. Repeat again with `supabase/migrations/0008_ai_knowledge.sql` — this
    adds the `ai_knowledge` table behind the "Good response"/"Improve
    response" review prompt.
11. Repeat again with `supabase/migrations/0009_business_city.sql` — this
    adds `business_profiles.city`, used by the dashboard's weather widget.
12. Repeat again with `supabase/migrations/0010_push_subscriptions.sql` —
    this adds the `owner_push_subscriptions`/`customer_push_subscriptions`
    tables, the token-gated RPC that saves a customer's subscription, and
    `business_profiles.last_weather_warning_date`.

## 4. Connect the app to your Supabase project

1. In this project folder, duplicate `.env.local.example` and rename the
   copy to `.env.local`.
2. Open `.env.local` and paste in the **Project URL** and **anon public**
   key from step 2.4. This file is already excluded from git so it never
   gets committed or shared.
3. Optional, for real SMS (§13) — sign up at mobilemessage.com.au, grab
   your **API username/password** from Settings > API, and register a free
   **Sender ID** (≤11 characters, matching your business name) under
   Settings > Sender ID — required by the national ACMA Sender ID Register,
   otherwise your texts show as "Unverified" to customers. Paste all three
   into `.env.local` as `MOBILEMESSAGE_USERNAME`, `MOBILEMESSAGE_PASSWORD`,
   and `MOBILEMESSAGE_SENDER_ID`. Without these, status-change SMS attempts
   just fail with an error notice — everything else in the app works fine.
4. Optional, for WorkRoute Messenger — two more values:
   - **Service role key**: already in your Supabase project, no new
     signup — Project Settings > API > `service_role` secret key. Paste as
     `SUPABASE_SERVICE_ROLE_KEY`.
   - **Anthropic key**: sign up at console.anthropic.com, create a key
     under API Keys. Paste as `ANTHROPIC_API_KEY`.

   Without these, the invitation SMS still sends (if Mobile Message is set
   up) and its link still opens, but a customer's message in Messenger just
   won't get an AI reply.
5. Optional, for the dashboard's weather widget — sign up at
   openweathermap.org, create a free API key, and paste it into `.env.local`
   as `OPENWEATHERMAP_API_KEY`. Then set a **City** on your business profile
   (Settings page). Without a key or a city set, the dashboard just renders
   without the widget — nothing breaks.
6. Optional, for Web Push notifications — three more values:
   - **VAPID keypair**: after `npm install` (next step), run
     `npx web-push generate-vapid-keys` in this project folder. Paste the
     two printed values into `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
     and `VAPID_PRIVATE_KEY`, and set `VAPID_SUBJECT` to `mailto:` followed
     by your own email address.
   - **Cron secret**: pick any long random string and paste it into
     `.env.local` as `CRON_SECRET` — this protects the weather-check
     endpoint (`/api/cron/weather-check`) from being triggered by anyone
     who doesn't know it.

   Without these, "Enable notifications" quietly does nothing (no error) —
   SMS keeps working as normal either way.

   **Push notifications can't be tested with `npm run dev`** — the service
   worker only registers in a production build (see `app/sw-register.tsx`;
   dev mode deliberately unregisters it to avoid stale-chunk caching during
   development). To test push, stop `npm run dev` first, then run
   `npm run build && npm run start` instead.

## 5. Install dependencies and run it

Open a terminal in this project folder and run:

```
npm install
npm run dev
```

If you're picking this project back up after the run-sheet update, you'll
need to run `npm install` again even if you already ran it before — it
pulls in the drag-and-drop library the run sheet uses.

Then open http://localhost:3000 in your browser. It'll redirect you to
`/login`. Click through to **Create an account**, sign up, and check your
email for the confirmation link (Supabase sends this automatically).
Clicking it logs you in and drops you on the **Business profile** page.

## What each part does

| Path | What it's for |
|---|---|
| `app/page.tsx` | Temporary marketing placeholder at `/` — replace wholesale with the real marketing page (see `MARKETING_INTEGRATION.md`); the product lives at `/app` |
| `app/login`, `app/signup` | The auth screens — not in the sidebar route group, deliberately shown with no sidebar |
| `app/auth/callback` | Handles the link Supabase emails after signup — routes a first-time confirmation to `/app/welcome`, everything else to `/app` |
| `app/m/[token]` | The customer-facing Messenger page — public, no login, no sidebar, reachable only by knowing the job's link |
| `app/app/welcome` | One-time post-signup onboarding screen — promotes installing WorkRoute as a home-screen app (custom install button where supported, Safari instructions on iOS) before continuing into `/app` |
| `app/app/(app)/layout.tsx` | The real auth gate for every page below (redirects signed-out users to `/login`) and the shared sidebar shell — `(app)` is a route group nested under the real `/app` segment, so `/app/run-sheet` is the actual URL |
| `app/app/(app)/sidebar.tsx` | The persistent sidebar — branding, nav (with a live Messages badge), the static "WorkRoute AI / Your AI Secretary" indicator, and the tradie profile block + sign-out |
| `app/app/(app)/page.tsx` | The dashboard (serves `/app`) — greeting + weather, then the same Needs Attention/Unscheduled/Run Sheet rendering as `/app/run-sheet` (reused via `run-sheet-board.tsx`, not duplicated) |
| `app/app/(app)/profile` | The protected business profile page + form, at `/app/profile` |
| `app/app/(app)/jobs` | All-jobs list (§27) — every job regardless of status, searchable by customer name, at `/app/jobs` |
| `app/app/(app)/jobs/new` | The job capture page, form, trade-question renderer, and client autocomplete |
| `app/app/(app)/jobs/[id]` | Job detail view, linked from a client's job history — now also shows that job's Messenger thread, with a reply box for the tradie |
| `app/app/(app)/run-sheet` | The run sheet board, job cards, schedule modal, and the Needs Attention tray — also reused directly by the dashboard |
| `app/app/(app)/clients` | Clients list (search, job count, last job date) — labeled "Customers" in the UI |
| `app/app/(app)/clients/new` | Manually add a client before any job exists |
| `app/app/(app)/clients/[id]` | Client detail — editable fields, notes, job history |
| `app/app/(app)/messages`, `calendar`, `reports` | Placeholder "Coming soon" pages — real nav destinations, honest that the underlying features aren't built yet |
| `app/app/(app)/install-prompt.tsx` | "Add to Home Screen" banner shown on the dashboard for anyone who skipped install at `/app/welcome` — native prompt on Android/desktop, tap instructions on iOS |
| `lib/hooks/use-install-prompt.ts` | Shared iOS-detection / `beforeinstallprompt`-capture / standalone-detection hook used by both the dashboard banner and the welcome screen |
| `app/app/(app)/profile/notifications-toggle.tsx` | "Enable notifications" control on Settings — owner opt-in for push, saved directly to `owner_push_subscriptions` |
| `app/m/[token]/push-prompt.tsx` | Dismissible "get notified here" banner on the customer chat page — opt-in for push, saved via the `messenger_save_push_subscription` RPC |
| `lib/hooks/use-push-subscription.ts` | Shared permission-request / `PushManager.subscribe()` / unsubscribe hook, mirrors `use-install-prompt.ts`'s conventions |
| `lib/push-client.ts` | Browser-safe VAPID key helper — kept separate from `lib/push.ts` so the server-only `web-push` package never reaches a client bundle |
| `lib/push.ts` | Server-only `web-push` wrapper — sends a push, prunes the caller's subscription row on a 404/410 (expired) |
| `lib/push-notifications.ts` | Event-keyed push dispatch — customer "new message," owner high-priority, owner weather-warning — mirrors `lib/notifications.ts`'s shape |
| `app/api/messenger/notify-customer` | Server-only route the tradie-reply UI calls to trigger a customer push (can't hold the VAPID private key client-side) |
| `app/api/cron/weather-check` | Secret-protected scheduled route — checks each business's forecast against its scheduled jobs, pushes a warning once per day |
| `app/api/notify` | Server-only route that sends the real §13 SMS via Mobile Message — holds the credentials, never called with client-supplied message text |
| `app/api/messenger/[token]` | Server-only route a customer's message goes through — stores it, then generates and stores the AI's reply, then pushes a "new message" notification if the customer has push enabled |
| `app/manifest.ts` | Web app manifest — name, navy theme colour, standalone display, icons |
| `app/icon.png`, `app/apple-icon.png` | Favicon and iOS home-screen icon (auto-linked by Next.js) |
| `app/sw-register.tsx` | Registers the service worker on page load |
| `public/sw.js` | Service worker — caches static assets, falls back to a cached page or `offline.html` if the network drops mid-navigation, and shows/handles Web Push notifications |
| `public/icons/` | 192×192 and 512×512 PNG icons referenced by the manifest |
| `scripts/generate-icons.mjs` | Regenerates all app icons from `scripts/assets/logo-source.png` — run `node scripts/generate-icons.mjs` after swapping in a new logo |
| `scripts/test-messenger-ai.mjs` | Reusable Messenger AI test suite — hits the real running app, creates and cleans up its own throwaway jobs. `node scripts/test-messenger-ai.mjs` runs everything once; `--only=4,5 --repeat=5` re-runs specific scenarios multiple times to check for consistent behavior before trusting a prompt change (see the file header for full scenario list and usage) |
| `lib/supabase/client.ts` | Talks to Supabase from the browser |
| `lib/supabase/server.ts` | Talks to Supabase from the server (keeps you logged in across page loads) |
| `lib/supabase/auth.ts` | `cache()`-deduped `getAuthedUser`/`getBusinessProfile` — the layout and a page both calling these cost one network round-trip, not two |
| `lib/trade-questions.ts` | §8a question sets, one array per trade |
| `lib/run-sheet.ts` | Day-bucketing, sort order, status-flow rules, and status/outcome badge colours shared by the run sheet, dashboard, jobs list, and client job history |
| `lib/run-sheet-data.ts` | `getRunSheetBuckets()` — the shared fetch-bucket-backfill logic used by both `/app/run-sheet` and the dashboard |
| `lib/weather.ts` | Server-only OpenWeatherMap client for the dashboard widget — plain city name in, returns `null` on any failure (missing key, unset city, API error) rather than breaking the page |
| `lib/clients.ts` | Shared `Client` type and address formatting |
| `lib/notifications.ts` | The four §13 SMS templates (booking confirmed / on the way / running late / completed) — one-way invitations into Messenger, never mentions WorkRoute (§23) |
| `lib/mobile-message.ts` | Server-only Mobile Message API client — never import this from a "use client" file |
| `lib/messenger-ai.ts` | The AI agent that replies in Messenger — system prompt, tool-calling loop, Low/Medium/High classification, inserting its own reply; also pushes + texts the owner on a "high" flag |
| `lib/messenger-scheduling.ts` | The AI's two schedule tools — checking for a time conflict and actually rescheduling the job, reusing the run sheet's own append-to-end-of-day logic |
| `lib/ai-knowledge.ts` | Save/fetch owner-approved examples — practical, curated knowledge, not machine-learning retraining |
| `lib/supabase/service-role.ts` | Server-only client that bypasses RLS — used only for AI-message insertion and the AI's schedule writes, never anywhere reachable from a browser |
| `middleware.ts` | Redirects signed-out users away from anything under `/app` — defense-in-depth alongside `app/app/(app)/layout.tsx`'s own gate |
| `supabase/migrations/0001_init.sql` | `business_profiles` table + security rules |
| `supabase/migrations/0002_jobs.sql` | `jobs` table, security rules, and the arrival-photo storage bucket |
| `supabase/migrations/0003_run_sheet.sql` | Scheduling fields (date, time slot, drag order) added to `jobs` |
| `supabase/migrations/0004_clients.sql` | `clients` table, security rules, and the `jobs.client_id` link |
| `supabase/migrations/0005_job_outcomes.sql` | `jobs.outcome` field (Won/Lost/Declined) |
| `supabase/migrations/0006_business_first_name.sql` | `business_profiles.first_name` — used in customer SMS, never the app name (§23) |
| `supabase/migrations/0007_messenger.sql` | WorkRoute Messenger — `messages` table, `jobs.customer_access_token`/`ai_paused`/`attention_priority`, the two public database functions that power the customer-facing chat, and the trigger that pauses the AI when a tradie replies |
| `supabase/migrations/0008_ai_knowledge.sql` | `ai_knowledge` table — owner-approved examples behind the Good/Improve review prompt |
| `supabase/migrations/0009_business_city.sql` | `business_profiles.city` — used by the dashboard's weather widget |
| `supabase/migrations/0010_push_subscriptions.sql` | `owner_push_subscriptions`/`customer_push_subscriptions` tables, the `messenger_save_push_subscription` RPC, `business_profiles.last_weather_warning_date` |

## Trying job capture

1. Log in and make sure your business profile has a **trade** selected —
   the job form loads its questions from whichever trade you picked.
2. Click **Capture a job** on the profile page.
3. Fill in the core fields, the trade-specific ones, an estimate, and
   optionally attach an arrival photo, then **Capture job**.
4. Every captured job starts as **Unscheduled** — moving it through
   Scheduled → On the way → Running late → Completed is a job-list/board
   feature we haven't built yet.

## Trying the run sheet

1. Click **Run sheet** from the profile page or job capture page.
2. Any job you've captured but not scheduled shows in the **Unscheduled**
   column. Click **Schedule** on one, pick a date and either a specific
   time or a Morning/Afternoon/Evening block, and save.
3. It'll appear in **Today**, **Tomorrow**, or **Future** depending on the
   date you picked, sorted by suburb/postcode/street to start with.
4. Drag jobs within a column (grab the ⠿ handle) to reorder — that order
   is saved and takes over from the suggested sort from then on.
5. Use the status buttons on a job (**On the way**, **Running late**,
   **Completed**) to move it through the flow. Moving to any of those three
   sends a real SMS to the customer (§13, via Mobile Message) — a short
   one-way invitation into WorkRoute Messenger, not the full update — and
   shows a notice confirming it, or explaining why it failed (no phone
   number on file, SMS not configured yet, and so on).
6. A job with **Quote required** ticked shows a **Quote visit** badge once
   it's scheduled — enter a real price on it later and it behaves like a
   normal job from then on, no separate job type needed.

## Trying clients

1. On the job capture form, the **Client** field at the top searches by
   name/phone as you type. Select a match to auto-fill their details, or
   tap **+ New client** to enter someone new inline — either way the job
   ends up linked to a client record.
2. Click **Clients** from the profile, job capture, or run sheet header to
   see the full list — name, suburb, phone, job count, last job date —
   searchable by name/phone. **Add client** creates one directly, with no
   job attached yet.
3. Click a client to open their detail page: editable name/phone/address/
   notes, and every job they've ever had, newest first. Click a job in that
   history to see its full read-only detail (including the arrival photo,
   if one was captured).

## Trying job outcomes

1. On any job that isn't Completed yet — on its run sheet card or its job
   detail page (`/app/jobs/[id]`, linked from a client's job history) — you'll
   see **Declined** / **Lost** buttons. Use them to record why a job isn't
   going ahead.
2. Marking a job **Completed** (via the run sheet's status buttons)
   automatically records it as **Won** — there's no separate step, and this
   holds even for jobs completed before this feature existed.
3. The outcome shows as a badge on the run sheet card, the job detail page,
   and in a client's job history — no separate report, just visible where
   you're already looking.

## Trying WorkRoute Messenger

1. Schedule a job for the first time (Unscheduled → pick a date) — the
   customer gets a short SMS with a link, not the appointment details
   themselves. Open the link (in a different browser/private window works
   well, so you're not logged in as the tradie) — that's what the customer
   sees: just the business's own name, never "WorkRoute."
2. Send a message the AI can resolve on its own — e.g. ask to move the
   appointment to a specific date/time that's genuinely free. It should
   confirm directly in the chat and actually move the job (check the run
   sheet). No second SMS gets sent for this — the confirmation happens in
   the conversation itself.
3. Ask for a time that conflicts with another job that day, or something
   vague ("sometime next week"). The AI won't guess — it tells you it'll
   check and get back to you, and the job shows up under **Needs
   Attention** on the run sheet.
4. Open that job's detail page as the tradie (`/app/jobs/[id]`) — you'll see
   the same conversation, with a reply box of your own underneath it.
   Sending a reply there pauses the AI for that job; the customer's next
   message won't get an automatic reply until you've handled it.
5. High-priority requests (an emergency, a same-day cancellation, an
   explicit "let me speak to {tradie}") also text the tradie's own phone
   immediately, on top of showing in Needs Attention — and push a
   notification too, if you've enabled it (see below).

## Trying Web Push notifications

Requires the VAPID keys + cron secret from setup step 6, and only works
against a production build — stop `npm run dev` first, then
`npm run build && npm run start` (see the "critical gotcha" note in step 6).

1. **Owner**: sign in, go to Settings (`/app/profile`), and click **Enable
   notifications** under the new "Notifications" section. Accept your
   browser's permission prompt.
2. **Customer**: open a real `/m/[token]` link (e.g. from a booking SMS) in
   a different browser/private window, and click **Enable** on the small
   banner at the top of the chat.
3. Send a tradie reply from the job's detail page, or a customer message
   that triggers a non-paused AI reply — the *other* party should get a
   push notification (title = the business's own name for the customer's
   push, never "WorkRoute" — §23), on top of the conversation updating as
   normal.
4. Trigger a high-priority Messenger flag (e.g. an urgent customer
   message) — confirm both the existing SMS to your own phone and a push
   notification arrive, linking to the job.
5. For the weather warning, curl the cron endpoint yourself once you've
   got a city set on your profile and a job scheduled today/tomorrow:
   `curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/weather-check`
   — if the forecast for that city includes rain/storms/snow on a
   scheduled day, you'll get a push; running the same curl again the same
   day won't send a second one (debounced via
   `business_profiles.last_weather_warning_date`). There's no scheduler
   wired up yet to run this automatically — see "Next steps" below.

## Trying AI Knowledge

1. Follow step 4 above (a job that's in Needs Attention) — reply as the
   tradie to resolve it. Right after you send, a small prompt appears:
   "Save this as an example for the AI?"
2. **✓ Good response** saves your reply exactly as you sent it.
   **Improve response** opens it for editing first — clean up the wording
   before saving. **Not now** dismisses it with nothing saved; nothing is
   forced.
3. Saved examples get pulled into the AI's instructions on every future
   reply for that business — up to the 5 most recent. Ask a similar
   question on a *different* job afterward and the AI's tone/judgement
   should reflect what you approved, without repeating stale specifics
   (an old time or price) that don't fit the new situation.
4. There's no management screen yet for browsing/deleting saved examples —
   only the capture flow above. See "Next steps" below.

## Next steps (not built yet)

- A "forgot password" flow — `/login` has no reset link yet. Supabase
  already supports it (`auth.resetPasswordForEmail`), just needs a page to
  request it and a page to set the new password after clicking the emailed
  link
- Editing a captured job's details after the fact
- The §13 email fallback (SMS is live; email isn't)
- Quotes/invoices generated from a job's details
- Travel-time/route-aware scheduling — the AI's availability check only
  looks for a time conflict today, not whether the tradie can physically get
  there from the previous job
- A scheduler actually triggering `/api/cron/weather-check` — the route
  itself is built and secret-protected, but nothing calls it on a timer
  yet (this app has no chosen deployment target; wire it to Vercel Cron via
  a `vercel.json` crons block once deployed there, or any external
  scheduler hitting the URL with `CRON_SECRET`)
- "Call me" as a tradie alert channel — High priority currently sends SMS
  + push; the full "Normal/Important/Urgent, configurable per channel"
  preference system isn't built
- An "unsubscribe from notifications" control — owner push can be disabled
  by revoking the browser permission manually; no in-app toggle-off exists
  yet (the `unsubscribe()` half of `use-push-subscription.ts` isn't wired
  to any UI)
- An AI Knowledge management screen — browsing, editing, or deleting saved
  examples after the fact; only the inline capture flow exists today
- Topic-relevant retrieval for AI Knowledge — examples are currently just
  the 5 most recent for the business, not matched to what the current
  question is actually about; fine at small volume, worth revisiting once
  a business has built up a large knowledge base
- The inbound voice AI booking flow (forward the tradie's existing number,
  AI answers, takes a new job) — researched, not started
