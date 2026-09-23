# WorkRoute — Future Roadmap (Phase 2+)
**Status: PARKED. Not to be built until Phase 1 is live and validated with real tradies.**

This document preserves the bigger product vision so none of the thinking is lost — it simply isn't the starting point.

## Competitive Benchmark: ServiceM8

ServiceM8 (servicem8.com/au) is the main identified competitor — a mature, established platform, useful as an honest benchmark for what WorkRoute is and isn't trying to be.

**Their offering:** Job cards, scheduling, quoting/invoicing, full client history, online bookings, card payments, accounting integrations (Xero/QuickBooks/MYOB), reporting, and an AI writing helper — bundled into every tier, including a **Free plan** ($0/month, 1 user, 30 jobs/month). Paid tiers: Starter $29, Growing $79, Premium $149, Premium Plus $349 (unlimited users on all paid tiers, gated by job volume and SMS caps instead). A separate "ServiceM8 Phone" add-on (from $29/mo) provides caller ID, call recording/transcription, and staff call routing.

**Critical competitive insight — their phone offering is not the same thing WorkRoute is building.** ServiceM8 Phone is a smart phone system *for humans to use* (routing, recording, caller ID) — nothing in their published feature set suggests it autonomously answers and qualifies a missed call the way WorkRoute's core promise does. **This is WorkRoute's actual wedge**: the "someone/something always answers, even when the tradie is busy on the tools" problem doesn't appear to be solved by the market leader.

**The real threat to take seriously:** ServiceM8's Free plan is genuinely generous (30 jobs/month, full feature set, zero cost) — enough for many solo tradies' basic job/quote/invoice needs. **This is why WorkRoute's positioning must stay narrowly about the missed-call problem, not broaden into "another job management app."** Competing on breadth of features (job cards, invoicing, scheduling) against a free, mature product is a losing game for a new entrant. Competing on "the thing that stops you losing work when you're too busy to answer the phone" is a sharper, defensible claim ServiceM8 doesn't appear to make.

**Practical implication for positioning and marketing (not a build item):** every pitch, landing page, and pricing conversation should keep coming back to missed-call capture as the reason to choose WorkRoute — not compete on the general feature checklist where a mature, well-funded incumbent already has years of head start.

---

## Competitive Benchmark: Hercules (AI App-Builder Platforms — Different Category of Threat)

Hercules (hercules.app) is a general-purpose AI app-builder platform, not a ready-made trade CRM — worth distinguishing clearly from ServiceM8. A real case study: a Dutch plumbing business owner (Rachid, MMA Plumbing) with no coding background used it to build his own 46-module internal system and a 4,000-page SEO site, after being quoted €250,000 by a dev agency. Their "Business" tier is **$199/month**, including 50 AI credits/month, team member access, role-based permissions, and daily backups.

**Why this is a different kind of competitive pressure, not a direct feature competitor:** $199/month here buys the *ability* to build and maintain your own custom software (with real usage limits — 50 credits/month is a meaningful constraint for active building), not a finished, ready-to-use system. Someone paying that price is signing up to be their own ongoing product manager — prompting, refining, and maintaining their own tool over time. That's a fundamentally different value proposition from WorkRoute's $49-79/month for something that works immediately with zero technical involvement.

**Strategic implication:** the barrier to a determined tradie building their own custom software is genuinely dropping — this is a long-term trend worth being aware of, not an urgent threat. WorkRoute's durable edge against this category specifically has to be: genuinely done-for-you (zero prompting/maintenance burden), trade-specific logic already built and tested, and real ongoing support — not trying to out-feature a general-purpose builder platform.

---

## Competitive Benchmark: AI Quoting Tools (Sammy AI) — Different Category, Worth Knowing

**Sammy AI** (withsammy.ai) is a real, established Australian/NZ AI quoting/estimating app — feed it a voice note, photos, sketches, or even full architect plans, and it drafts a professional branded PDF quote, with client-facing accept/view-in-browser tracking, Xero integration, and job/client tracking. Genuinely impressive at this one job, broad trade coverage (electricians, builders, plumbers, landscapers, and more).

**Important distinction — this is a different product category from WorkRoute's core focus.** Sammy does AI-assisted quoting; it does not answer phones or capture missed calls. A broader AU/NZ tradie-AI-tools roundup (checked mid-2026) cleanly splits the market into: quoting tools (Sammy, QuoteMatey, QuoteMe) vs. **phone-answering/lead-capture tools — specifically named: Sophiie AI and Tradie Pal.**

**Sophiie AI and Tradie Pal are the genuinely direct competitors** to WorkRoute's actual core promise (answering missed calls, capturing leads) — worth researching properly at some point, not Sammy specifically. Sammy's existence is reassuring, not threatening: it validates that AI-assisted quoting (already planned via the deterministic pricing engine, §26/§31, and the "tie to Completed button" invoicing idea) is a real, wanted category — but it confirms WorkRoute's near-term focus (the phone AI) is correctly a separate priority, not something Sammy already solves.

## Phase 2 candidates (roughly ordered by effort)

- **Small team support (2–5 staff):** role-based dashboard views, manual job assignment, staff-only job visibility. Data model should already support this from Phase 1 (see locked spec §14).

**Confirmed via real architecture check (verified with Claude Code, not just assumed):** the single-tenant assumption is narrowly contained — RLS policies checking `business_id = auth.uid()` across roughly 8 tables — not tangled through the core job/run-sheet/Messenger logic. The original §14 decision (using `user_id`, not `tradie_id`, throughout) did its job. The mechanical part of adding team support (a `team_members` join table, rewriting RLS checks from "is this row mine" to "is this row my business's") is bounded and low-risk whenever it's built.

**What actually needs real design decisions when this gets built (not just plumbing):**
1. **How the run sheet displays jobs across a team** — one shared board everyone sees, or each staff member filtered to their own jobs
2. **Notification routing for Messenger's high-priority alerts** — currently hardcoded to page a single tradie's phone; needs a real decision once there's more than one person's phone on a team (page everyone? page whoever's assigned? a rotation?)

**Current status: no groundwork needed now.** Safe to keep building on the current single-tenant model — this is confirmed extendable later without rework, not something requiring preemptive changes today.

- **Basic invoicing:** "Send bill" button, Stripe payment link on job completion. **Design detail worth keeping (found via a competitor product, "QuoteLock," seen advertised on Facebook):** tie this directly to the existing "Completed" button rather than adding a new UI element — when a tradie marks a job complete, that same action can trigger generating the quote/invoice from the job's already-captured data (trade answers, price, customer info), rather than a separate manual step. Reuses an existing, familiar action instead of adding new UI clutter.
- **18-day re-booker:** automated check-in SMS to past clients.
- **Two-way SMS:** move beyond one-directional system messages.

## Phase 3+ / "Sarah" vision (bigger bets, higher risk)

- **Live conversational AI voice agent ("Sarah"):** full natural back-and-forth conversation, not scripted Q&A. Requires real-time audio streaming (e.g. OpenAI Realtime API + Twilio Media Streams), careful conversation design, and much higher per-call cost. This is very likely the piece that stalled the original freelancer — approach only once Phase 1 has real usage data.
- **Vision AI photo quoting:** customer or tradie submits a photo, AI drafts a price. Needs strong guardrails (photos can't show access, ground condition, hidden damage, etc.) and a mandatory tradie-approval step before anything is sent to a customer.
- **Lead exchange / marketplace:** karma-scored lead redistribution between tradies, commission billing ($15–20/lead), dispute resolution (including AI verification calls to customers). This is effectively a second product with its own trust, legal, and support surface — treat as a separate initiative, not a feature.
- **Route optimization — "WorkRoute Route Intelligence"** (expanded with real technical detail from a well-sourced follow-up document): three-part conceptual split — Sarah understands the customer, WorkRoute understands the job and price, Google Maps understands location/routing. Positioning matters: **"WorkRoute plans your week using Google Maps," not "Google Maps plans your week"** — keeps the actual product differentiation as WorkRoute's business logic layered on top of the mapping API, not just a thin wrapper.
  - **Confirmed (real research, not assumed): Google Maps' free consumer app does NOT automatically optimize stop order** — the founder's own real experience (typing in each address, then manually working out the best order by eye) matches this exactly, not a missed feature. It also caps at 10 stops total. This is genuinely useful validation: real route optimization isn't just duplicating something free elsewhere — nothing free currently solves this well, which strengthens the case for eventually building it properly. See also §32c in the locked spec (the free, cheap "Open in Google Maps" shortcut) — that solves manual address entry, but not the ordering problem; real optimization remains a genuine, distinct value-add for whenever this gets built.
  - **Third-party route optimization alternatives worth comparing when this gets built** (not decided, just real options on record): Circuit/Spoke ($10/driver/month, unlimited stops, has a mobile app — pricing structure may suit a multi-tenant SaaS better than per-call API pricing), RouteXL (free for 20 stops no signup, developer REST API on paid tiers, but browser-only with no mobile app or driver tracking), Routific (notably generous free tier — 100 orders/month, unlimited drivers). Worth a proper cost/fit comparison against Google's own Route Optimization API when this feature is actually scoped. **Founder's stated preference: investigate Circuit/Spoke first** — simplest per-driver pricing (fits a multi-tenant SaaS better than per-call billing) and the only option of the three with a real mobile app already built in.
  - **Address validation during the call** — Google's Address Validation API can validate/correct an address in real-time as it's captured (e.g. catching "Smith Street vs. Smith Road" confusion immediately rather than discovering it later). Directly relevant to §25 (the new adaptive voice AI intake) whenever that's built — worth including then.
  - **Route optimization is business-aware, not just "shortest path"** — Google's dedicated Route Optimization API (built for field-service use cases specifically) supports real constraints: job duration, appointment windows, working hours, job priority, equipment needs — not just minimizing driving distance blindly.
  - **Smart booking suggestions** — when booking a new job, the system can suggest times based on the tradie already being nearby that day ("Steve's already working in that suburb Thursday morning — would 10:30 suit you?") rather than just offering the next open slot.
  - **Trust-preserving UX pattern, consistent with everything else built today:** the system should propose a better route and let the tradie approve it ("I've found a better route — want me to use it?"), never silently rearrange their week without consent. Same "AI proposes, human approves" principle already proven throughout the Messenger and pricing work.
  - **Weekly summary view:** jobs count, suburbs grouped, estimated driving time, driving reduced — a simple, tradie-legible summary rather than raw routing data.
- **Debt recovery automation:** automated chase sequence for unpaid invoices at day 5.
- **Facebook radius ad automation:** tradie-triggered "boost this area" ads via Marketing API.
- **QR flyer / neighbour marketing flow:** GPS-aware "I'm working next door" pitch.
- **Zero-touch owner-side admin:** auto-provisioning, auto-billing, auto-top-up on Twilio/OpenAI credit, owner dashboard (MRR, active users, lead revenue).

## Tiered pricing (parked)

Earlier work proposed a $79 / $149 / $199 tier structure tied to the Sarah vision. This is not the Phase 1 pricing ($49 flat — see locked spec §16) and should only be revisited once Phase 2+ features exist to justify it.

## Tier structure & feature access matrix (parked template)

A later "Developer Specifications" doc proposed a 3-tier model (Starter $79/Growth $149/Dominator $199) with a Feature Access Matrix gating call minutes, invoicing automation, logistics/route optimization, quoting sophistication, marketing tools, and lead fee percentage by tier. The matrix structure itself is a useful template for whenever Phase 2+ tiering is introduced — but the specific tiers, minute limits, and $15–20 lead fees are not decided Phase 1 pricing (see locked spec §16, which notes $49 flat is Phase 1's price).

**Technical implementation notes for this tier structure (for whenever it's built):**
- Zero-touch provisioning: Twilio API purchases a local AU number on Stripe payment; dynamic divert-code screen per user (already pulled into Phase 1 as a simple, tier-agnostic screen — see locked spec §14a)
- Sarah engine: Twilio Voice + OpenAI Realtime/Chat Completions API bridge
- Account Lock Mode: middleware checks `subscription_status` before any AI/SMS call runs; plays a "service unavailable" message if unpaid, instead of the normal greeting
- 18-day re-booker & 5-day debt recovery: both are daily cron jobs querying job/invoice tables by date offset
- Vision AI quoting: photo → cloud storage → GPT-4o Vision API with a rate-based prompt → draft quote for tradie approval
- Voice site diary: Whisper API transcription → GPT summarization → written to a customer notes table
- 6am Battle Plan: Google Maps Route Optimization API on the day's job list
- Boost Area: Facebook Marketing API, geofenced ~1km radius campaign around current job GPS
- API Cost Monitor: usage tracker flagging accounts for manual review if raw API costs (talk-time, SMS volume) exceed a set threshold — important safeguard to build alongside any "unlimited" tier claim
- Lead attribution: every lead tagged by source (EXISTING = no fee, FLYER/AD/EXCHANGE = $15–20 fee) — same lead-marketplace/Karma Credits system noted elsewhere in this roadmap, not a separate idea

Also proposed in this doc, filed here as Phase 2+:
- PWA (Progressive Web App) as the technical framework — reasonable direction, but a framework decision should be made when we scope the actual build, not locked in prematurely from a vision document.
- Landing page builder templated per-tradie (auto-pulling logo/gallery/reviews)
- QR codes with `?source=flyer` tracking parameters
- Contextual "Sarah" caller recognition (checking Job_Table/Calendar mid-call to personalize the greeting)

## Competitor signal: video quotes

Saw a competitor ad for a company doing video-based quotes (customer/tradie submits video, gets a quote sent back). This is the same family as the Vision AI photo quoting item above — worth noting as market validation that AI-assisted remote quoting has demand, but it belongs in the same Phase 2+ bucket with the same guardrail concern: automated pricing from visual input alone is risky without a mandatory tradie-approval step before anything reaches the customer.

## Onboarding SMS copy (parked — needs rewrite for whatever's actually live)

An "Aussie workmate" onboarding SMS sequence was drafted for Sarah (welcome text, divert instructions, 2-hour check-in, "Friday Feedback" engagement text). Good tone and structure to reuse — but it's written assuming live conversational AI voice already exists ("give your Sarah number a test call to hear me in action," "I'm learning your pricing"). **Do not send this copy to real Alpha testers until whatever's actually built matches what it promises.** When Phase 1 onboarding copy is needed, write it to describe the scripted-voice intake system accurately, not the Sarah vision.

## Mechanic vertical expansion (parked)

- Rego/VIN lookup API integration (auto-pull engine code, oil type from a rego plate)
- Parts status toggle ([PARTS ORDERED] / [PARTS IN VAN])
- AI visual diagnosis of vehicle wear/damage from customer photos (e.g. belt wear, damage assessment)

**Guardrail (important, keep even in Phase 2+ planning):** any AI visual diagnosis of vehicle condition must be framed as a *possible observation for the tradie to verify*, never presented as a confident automated diagnosis, and must require tradie sign-off before anything reaches the customer. This is a materially higher liability category than a lawn-mowing price estimate — a wrong or overconfident "recommend immediate replacement" claim about vehicle safety is a different kind of risk than a quoting error.

## Dashboard design (parked, beyond core usability principle)

A detailed "Tradie Dashboard" layout was proposed: status bar (Sarah live/paused, today's earnings, new leads), a 3-button action center (Start Next Job w/ Sarah's pre-flight notes, Instant Photo Quote, Job Complete), a route-optimized daily timeline with "Boost this area" gap-filling, a pending-quotes approval tray, and bottom nav (Home/Money/Clients/Marketing). All of this assumes Phase 2+ features (route optimization, photo quoting, ad automation) are live, so the layout itself is parked — though the underlying usability principle (large buttons, high contrast, outdoor/glove-friendly) has been pulled into the Phase 1 spec since it costs nothing to build correctly from the start (see locked spec §15a).

## Trade category taxonomy (parked, useful reference)

Businesses were grouped into rough categories for marketing/product purposes: "Visual Kings" (lawn mowing, fencing, patios, landscaping, tree loppers), "Grease & Water Crew" (mobile mechanics, plumbers, pool cleaners, windscreen repairs), "Emergency Squad" (locksmiths, electricians, glaziers, solar panel cleaners, painters), "Maintenance Pros" (pest control, window cleaning, gutter cleaning, house cleaning). Useful for future marketing segmentation and for prioritising which trade-specific intake sets to build next.

## AI-driven quoting/scoring logic (parked — Phase 1 uses the plain question sets only)

The trade-specific intake scripts also included AI-driven elements not in Phase 1:
- **Vision AI photo analysis** for pricing (lawn area from photos, cleaning scope from kitchen/bathroom photos, vehicle fault assessment from photos)
- **Dynamic pricing matrices** calculating quotes in real time from structured answers (e.g. cleaning: bedrooms × rate + bathrooms × rate, with deep-clean/pet/travel multipliers; lawns: base rate × overgrowth multiplier + access surcharge)
- **Landscaping lead scoring** (1–100 score based on access/budget/photos provided, triggering a "high value lead" alert)
- **Mechanic "dynamic parts flag"** — auto-detecting parts needs (brakes/battery/alternator) and prompting for VIN/rego to pull part pricing from an API

Phase 1 simply records the structured question answers on the job card (see locked spec §8a) for the tradie to price manually — no automated pricing calculation or AI photo analysis.

## "Friday Feedback" Alpha engagement SMS (parked)

A weekly SMS to Alpha testers summarising leads captured and estimated pipeline value, asking two quick yes/no questions to gather feedback. Good engagement mechanic to reuse once there's a live AI system worth reporting on — not relevant to Phase 1's simpler intake.

## Phase 2 prioritization philosophy (genuinely useful — keep this framing)

One document argued for focus: "many software tools fail because they try to do 20 things okay instead of 5 things brilliantly," and proposed this as the priority order once Phase 1 is proven:
1. Reliable call capture (already Phase 1, via scripted intake rather than live AI — no conflict)
2. Job-completion automation (auto-invoice + next-client SMS + voice diary on one tap)
3. Automatic invoice chasing (day 3 / day 5 reminders)
4. Smart daily route planning
5. Secure payments / escrow ("Deposit Guardian")

**Worth naming directly:** this list is essentially the Sarah/Phase 2 feature set re-argued as "the essential 5." That's a pattern to watch for — it's easy for deferred scope to resurface as "but these ones actually matter." The prioritization instinct (few things done brilliantly) is sound and should guide *whichever* features get picked up in Phase 2, but the specific list still needs to wait until Phase 1 (rule-based intake, job cards, run sheet) is live and validated with real tradies.

## Pay-on-completion (Tap to Pay) — simpler, separate from Deposit Guardian

A much simpler payment idea, distinct from Deposit Guardian: let the tradie collect payment on the spot when the job finishes, using their own phone as the card terminal (Tap to Pay on iPhone/Android), instead of sending an invoice and waiting. This solves the same "stop chasing invoices" problem as the automated invoice-chasing idea above, but earlier and more directly — no invoice, no wait, no reminder sequence needed.

Unlike Deposit Guardian, this doesn't need escrow or a financial services licence — it's standard card processing, integrated via an existing provider's SDK/API. As of 2026, the main Australian options tradies actually use:
- **Zeller** — 1.4% transaction fee, no monthly fee, instant transfers to a Zeller account — generally the best fit for most sole traders
- **Square** — simple setup, no contract, daily payout, also handles on-site invoicing
- **Tyro** — better for higher-volume businesses, integrates with MYOB/Xero, but has a monthly fee and contract

This is realistically a Phase 2 candidate sooner than Deposit Guardian — it's an integration, not a build-from-scratch financial product. Worth sequencing as: pay-on-completion (simple, near-term) → Deposit Guardian/escrow (complex, longer-term, for deposits and staged payments on bigger jobs where the tap-to-pay model doesn't apply since work hasn't started yet).

**Accounting software sync (Xero, and others like MYOB/QuickBooks) — related, distinct consideration.** Beyond just collecting payment, tradies typically want job/invoice data flowing automatically into their bookkeeping software rather than re-entering everything by hand. Worth noting:
- **Tyro (above) already syncs with MYOB/Xero natively** — if Tyro ends up being the chosen tap-to-pay provider for higher-volume tradies, accounting sync may come along with it rather than needing to be built separately.
- **Xero itself has its own API** for creating/syncing invoices, contacts, and payments directly — a legitimate separate integration if WorkRoute wants to push job data into Xero regardless of which payment provider is used.
- **This genuinely depends on invoicing existing first** (already Phase 2, not built in Phase 1) — accounting sync without invoicing doesn't have much to sync. Sequence: invoicing → accounting software sync, not the other way around.
- Given ServiceM8 (the competitive benchmark) already offers Xero/QuickBooks/MYOB integration as standard, this is worth taking seriously as a real feature once the underlying invoicing exists — it's a genuine expectation for small trade businesses, not a nice-to-have novelty.

## Deposit Guardian — DECIDED AGAINST (not revisiting)

**Status update: Deposit Guardian will not be pursued.** After two years of trying, the founder has determined it cannot be made to work legally/compliantly at a viable cost. This supersedes the "worth exploring" framing below — the item is kept for historical context only, not as something to revisit.

Original context and exploration notes, preserved for reference:

Proposed: hold customer deposits/stage payments in escrow (via Trustap) until job completion is confirmed, giving both customer and tradie payment security. This is a materially different category of feature from anything else on the roadmap — it means WorkRoute would be handling and holding customer funds, which typically carries real regulatory obligations in Australia (potentially payment facilitator / financial services licensing requirements, depending on structure). **This needs proper legal/compliance advice before any development time is spent on it** — not a "just build it" feature, whenever it's revisited.

**Important context:** Deposit Guardian is actually the user's own separate business, in development for 2 years, currently stalled — not a new WorkRoute feature idea. The blocker was economics, not access: an escrow partner was found, but at a 5% transaction fee it isn't cost-effective for tradie-sized jobs (e.g. $15 gone on a $300 job before work even starts).

**Things worth exploring whenever this gets revisited (not now):**
- The 5% rate may have been a standard/retail quote rather than a negotiated volume rate — worth revisiting with concrete transaction volume numbers (e.g. "X WorkRoute tradies doing Y jobs/month") as leverage, rather than approaching as a pre-launch unknown.
- The provider may have priced for high-value one-off transactions (cars, domains, big purchases) rather than high-frequency/low-value trade jobs — a different risk profile that may warrant different pricing, or a different provider entirely (e.g. Escrow.com's API product, Tazapay).
- True escrow may not be necessary for every job size — a simpler Stripe hold-and-release mechanism (no separate licensed escrow provider needed, since Stripe already handles payment compliance) might deliver most of the trust benefit for smaller jobs, reserving full escrow for larger jobs (landscaping, renovations) where dispute risk is higher.
- If revisited, framing this as a WorkRoute-integrated payment feature (bringing guaranteed volume across all WorkRoute tradies) rather than a standalone product may change the negotiating position with providers.

This is a real, separate thread the user wants to properly brainstorm and rework — flagged here to pick back up deliberately, not to solve incidentally inside a WorkRoute planning session.

## Payment collection flow refinement (Phase 2+ — applies once invoicing/DG exist)

A good real-world correction surfaced in another session, worth keeping for whenever invoicing and Deposit Guardian are actually built: most tradies get paid on the spot (cash, card tap, PayID) the moment a job finishes — automatic invoicing shouldn't be the default "Finish Job" action, since it's the exception (customer not home, or a business account customer), not the rule.

**Refined Finish Job payment flow (Phase 2+ design, not built yet):**
A quick prompt after job completion: *How did you get paid?* — Cash / Card/Eftpos / PayID / Send payment link / Invoice later.
- Cash, Card, PayID → job marked paid immediately, no customer SMS needed (optional low-key "thanks for choosing us" text)
- Send payment link → for when the customer isn't home/couldn't pay on the spot; this is where the Stripe/tap-to-pay link and debt-recovery cron (§ above) would apply
- Invoice later → for business-account customers; formal invoice sent, same debt-recovery logic applies
- For Deposit Guardian jobs specifically, this prompt wouldn't apply — the customer confirms completion and funds release automatically, no manual payment-method decision needed

**Suggested data field for whenever this is built:** a `payment_collected_method` field on the job record (cash / card / PayID / Stripe link / Deposit Guardian / invoice sent / pending) — useful for reporting later regardless of exact implementation.

**Note:** a $500 Deposit Guardian threshold (jobs under $500 collected on the spot, over $500 eligible for upfront-secured payment) was proposed in that other session as sensible triage logic — reasonable direction, but not a decision made here; revisit once Deposit Guardian's underlying economics (5% fee problem, above) are actually resolved.

## Phase 2 — Full Scope Reference (organized, 10 systems)

A cleanly organized Phase 2 scope doc exists (referenced source: `workroute-phase2-scope.pdf`), framed correctly as Phase 2 from the start — no scope-creep conflict with the locked Phase 1 spec, unlike several earlier documents. Summarized structure, one-line framing: **Phase 1 is reactive (Sarah responds), Phase 2 is proactive (Sarah initiates)**.

10 systems: time-based cron automation (6am battle plan, 4pm heads-up, 18-day re-booker, debt recovery escalation to Day 7+ outbound calls), day-1 happiness check + review requests, route optimisation (geo-clustering, multi-stop maps, silent lunch waypoints), cold lead re-engagement (T+2h/72h/96h escalating sequence), email + social DM handling (landing page, Google Business, Facebook/Instagram), neighbourhood marketing (QR flyers, Boost Area Facebook ads, referral cards), Busy Mode + waitlist + Karma Credits (same lead-passing/fee system as earlier docs — see Section 4 lead-marketplace notes above, don't treat as a separate idea), frustration-detection/escalation AI with VIP-contact bypass, public directory + individual landing pages, and a 9-page onboarding questionnaire + monthly ROI scorecard.

## Next Thing to Check After §25 — Afternoon "Tomorrow's Jobs" Heads-Up

The "4pm heads-up" / "4:30 PM Run Sheet" idea (send the tradie tomorrow's job list automatically each afternoon) — still not built, confirmed. Deliberately held for after §25 (the phone AI) is finished and tested, per the founder's own call, rather than adding scope mid-build.

**Useful clue for whenever this gets picked up:** when the push notification system was built (weather warnings + customer message alerts), it included a `CRON_SECRET` — suggesting some kind of scheduled-job mechanism may already partly exist from that work. Worth checking with Claude Code whether that infrastructure can be reused/extended for this, rather than assuming it needs to be built completely from scratch.

## Retention Email — "Weekly Win" (merges with the Monthly ROI Scorecard above)

A more detailed, weekly-frequency version of the same idea as the Monthly ROI Scorecard — a "Friday Afternoon Success" email/SMS to the tradie summarizing real value delivered that week (calls captured, jobs booked, dollar value, a highlighted "top catch" story), framed to make the subscription cost feel small next to real results, plus an emotional hook (time/family) and a subtle upsell nudge.

**Genuinely good retention psychology worth keeping:** anchoring the AI's value in real dollar terms, and highlighting one specific concrete "save" story rather than only abstract stats — both proven, sensible engagement patterns.

**What needs resolving before this is buildable:**
- **New infrastructure required:** nothing built so far runs on a schedule — every current automation triggers from a user action. A weekly Friday email needs a genuine cron/scheduled job system, not yet built.
- **The example template references features that don't exist yet** ("Photo-to-Quote," "Gap-Filler Ads") — any real version must pull only from actually-built data (jobs captured, completed job values, calls captured via the phone intake once §25 is live), not invented or Phase-2-only stats.
- **Open naming/branding question:** the template assumes a named AI persona ("Sarah"). Everything built so far deliberately avoids giving the AI a persona name — it just acts as the business (§23, customer-facing). Worth a deliberate decision on whether an *internal* email to the tradie (not customer-facing) is allowed to use a friendlier name, or whether staying nameless is the right call everywhere for consistency. Not yet decided — don't assume "Sarah" carries over.
- A "Saturday Morning SMS" reminder (mentioned as a possible follow-up idea in the source material) is a small, related add-on worth considering at the same time, once the underlying weekly-summary infrastructure exists.

**Scale check, worth being honest about:** this is 9 third-party API integrations (Twilio Voice/SMS, Google Maps Directions, Google Places, Google Business, Google Review Webhook, Facebook Ads API, Facebook Graph API, Claude AI, Stripe Webhook) and real-time sentiment/frustration scoring on live calls. This is genuinely months of work for a small team, well-organized or not — worth treating as a proper phased roadmap of its own (Phase 2a/2b/2c) rather than "the next build" in one go, once Phase 1 is validated.

## Phase 2 Architecture Guidance — Event-Driven Automation Engine (Build This Way, Not New Scope)

A genuinely valuable piece of engineering advice, worth following when Phase 2 building actually starts — this isn't a new feature, it's a smarter way to build the many automations already documented above.

**The core idea:** instead of building each Phase 2 automation (debt recovery, happiness check, 18-day re-booker, cold lead re-engagement, onboarding sequence, monthly reports, etc.) as its own separate custom system, build one shared **event-driven automation engine** once, and make every automation a configurable *rule* on top of it rather than new code.

**How it works:** the platform emits events as things happen (`job_finished`, `invoice_sent`, `lead_created`, `call_answered`, etc.). An automation rules table defines: trigger event → optional delay → optional condition → action (using shared, reusable actions like `send_sms`, `place_call`, `send_invoice`). New automations become configuration, not new engineering.

**Example rules, illustrating the pattern:**
- `job_finished` → wait 24h → `call_customer` (happiness check)
- `invoice_sent` → wait 3 days → `send_sms` (reminder) → wait 2 days → `send_sms` (second reminder) → wait 2 days → escalate to call script (debt recovery)
- `lead_created` → wait 72h → if quote not progressed → `send_sms` reminder → wait 24h → escalate to a call (cold lead recovery)

**Why this matters:** the Phase 2 scope above genuinely has 30+ distinct automated behaviors. Building each as its own bespoke system is expensive, fragile, and hard to modify later. Building one engine plus many small rules is cheaper to build and maintain — directionally sound advice, though treat any specific day-count estimates as illustrative, not a real quote.

**Also worth keeping:** delay the Facebook Ads API integration specifically — it's the single most complex third-party integration in the whole Phase 2 list. Do a manual ad link first (Phase 2a), real automated ad launching later (Phase 2b) — consistent with the same "start simple, add complexity later" approach that's worked throughout Phase 1.

**No action needed now** — nothing in Phase 2 is being built yet. This is guidance to hand over when that work actually starts, so it's built as one clean, reusable system from day one rather than 30 fragile one-off pieces.

**One design choice worth a deliberate decision, not just cute copy:** the "Lunch Café Suggestion" is specced as intentionally undisclosed during onboarding — "a designed surprise." Worth being purposeful about that choice (delight vs. transparency) rather than defaulting to it because it reads well in a spec.

## Directory + Landing Pages (parked, with launch-market and design notes)

Building on the Section 9 directory concept above: a mockup was produced pairing a homeowner-facing search directory (top half — search by trade/suburb, trust badges, dynamic before/after cards pulled from the 10 most recent completed jobs across all local tradies) with a tradie-facing SaaS pitch (bottom half — dashboard preview, dopamine-hit earnings/battle-plan visuals). This is the same public directory + landing page concept already parked above — treat as one item, not two.

**Specific, useful details worth keeping regardless of when this gets built:**
- **Launch market: Hervey Bay, QLD** — the plan is to hard-code/auto-fill location to Hervey Bay for the first month rather than launching as a generic national directory, and to make social-proof numbers specific to that market ("25 Local Pros," not "2,400+ jobs") so it feels built for the local community rather than generic.
- **Design direction:** an "industrial but modern" high-trust aesthetic (Barlow Condensed font referenced), closer to Airbnb-style trust signals than a typical trade software look. Worth keeping as a design reference whenever the public-facing site/directory gets built — not necessarily something to apply to the Phase 1 dashboard itself, which prioritises field usability (§15a) over polish.
- Note: this doc assumed the live conversational Sarah voice call flow already existed ("Address → Zone Check → Squeeze you in → SMS Confirmation" call script) — same caution as elsewhere: don't build marketing/onboarding copy around a live-voice experience until that's actually built.

**AI-driven live matching (added — genuinely new capability, not just a bigger directory):** rather than a customer just browsing a static searchable list, Sarah actively matches them to an available tradie in real time — customer types their area and trade need on the homepage, Sarah finds and connects them with a genuinely free tradie right now, using actual cross-platform schedule knowledge, all without the customer leaving the site. Connects directly to the Lead Exchange/Karma-based matching system already documented elsewhere in this roadmap — same underlying concept, framed here as the consumer-facing search experience rather than the tradie-to-tradie overflow-passing mechanism.

**Why this is a genuinely different kind of build, not just "add a feature":** every piece of WorkRoute built so far deliberately keeps one business's data completely isolated from every other business (the core RLS security principle — "Tradie A can never see Tradie B's customers"). Live cross-tradie matching needs the opposite in this one specific place — Sarah would need real visibility across every tradie on the platform to know who's actually available right now. That's a new category of capability, not an extension of the AI patterns already proven (Messenger, phone AI) — those are both deliberately single-business-scoped. Worth planning as its own significant piece of work when the time comes, with real thought given to the security/isolation implications of the one place data needs to cross tenant boundaries.

## Review-sync loop (parked, depends on directory)

Proposed flow: job completion → SMS asks customer for a Google review → Google Business Profile API fetches new reviews and auto-pins them to the tradie's directory profile. Depends entirely on the public directory existing (Section 9 above) — not relevant until that's built. The underlying photo/business-ID data linking this depends on is already handled in Phase 1 (see locked spec §14, photo tagging note).

## Sarah voice AI system prompt example (parked)

A sample "personality prompt" was drafted for a lawnmowing-trade version of Sarah (local Hervey Bay tone, trade terminology, lead qualification flow, photo-quote close). Useful reference for whenever live conversational AI voice is actually built (Phase 2+, per earlier caution — Phase 1 uses scripted intake, not open conversation). Don't use this to write Phase 1 copy or onboarding material, since it assumes a fully conversational AI that doesn't exist yet.

**Homepage positioning strategy (parked, marketing decision not build decision):** one proposal argued for a "Directory First" homepage — leading with consumer-facing search ("Find the Best Hervey Bay Tradies") above a tradie-facing SaaS pitch below, positioning WorkRoute as a local marketplace/directory (like a localized Airtasker/HiPages) rather than a pure tradie software tool (like ServiceM8/Tradify). Real trade-offs noted: stronger SEO and consumer trust, but risk of tradies mistaking it for "just a directory" and bouncing before seeing the software pitch, plus the "empty room" problem of a directory looking sparse with only 5 tradies at launch. Technical note: would need the homepage to be location-aware (Hervey Bay-specific header for local visitors) and split into two distinct conversion paths (search vs. tradie signup) feeding the same database with different permissions.

**Worth being direct about:** this is homepage copy and positioning strategy for a directory feature that doesn't exist yet, discussed before Phase 1 has shipped anything. Good strategic thinking, wrong time to act on it — revisit once there's an actual product and the directory is being built.

## Database schema reference (parked, mostly phase-agnostic structure)

A Sprint 1 technical doc proposed a database schema — useful as structural reference regardless of build order: Users (business type, service radius, Stripe ID, karma score), Jobs (status, GPS, client phone), Media (job ID, before/after type, storage URL, timestamp), Site_Diary (voice note transcript, obstacles flag), Directory (SEO slug, keywords, verified flag). The Media table concept is already covered simply in Phase 1 (see locked spec §10a, §14 photo-tagging note) without needing the Karma_Score or Directory fields, which are Phase 2+.

**Important flag — do not use this document's "Sprint 1" as an actual build brief.** This document's proposed Sprint 1 deliverable (14 days) is a *working live conversational AI phone line* — Twilio call recording → Whisper transcription → GPT-4o intent mapping → open diagnostic conversation with the caller. That is the full real-time conversational AI voice pipeline, not the scripted intake we agreed on for Phase 1 (locked spec §5.2). Building this as the literal first sprint repeats the exact risk that very likely stalled the original freelancer attempt — the hardest, highest-uncertainty part of the whole project, attempted first, with nothing simpler proven yet. **The locked Phase 1 spec (WorkRoute_Phase1_Locked_Spec.md) is what should go to a developer as the actual build brief — not this document.**

## AI call intake + review loop workflow diagrams (parked, well-organized reference)

Two clean workflow diagrams surfaced from an earlier Gemini session, worth keeping as reference for Phase 2+ implementation:

**AI Call Intake:** Incoming call → live AI answering service (custom greeting, qualifies scope/location/urgency, captures name/phone/address) → auto-creates job lead → SMS to customer with a Trustap/Deposit Guardian link to confirm details and pay deposit → job data locks into the "Vault" once deposit confirms. This combines two Phase 2+ items already tracked separately in this roadmap — live conversational AI voice intake, and Deposit Guardian escrow — so nothing new here, just a clean picture of how they'd work together once both exist.

**Automated Review Loop:** Job marked complete → 2-hour delay buffer (lets the customer actually inspect the work first) → automated SMS asking for a 1–5 rating → branches: 4–5 stars redirects to the public Google/Facebook review link ("would you mind sharing this on our Google page?"); 1–3 stars redirects to a private feedback form instead and alerts the business owner internally, so a bad experience doesn't become a public review before the tradie has a chance to make it right. This is a smart, low-cost addition to the review-sync loop already in this roadmap — the star-based branching (public vs. private feedback path) is worth keeping as the exact mechanism whenever reviews get built.

## Deployment (Next Real Milestone After Local Testing)

The app currently only runs locally (`localhost:3000` on the founder's own machine) — it isn't reachable by anyone else yet. The existing public website (workroute.com.au) is still the original WordPress/Elementor "Founding Ambassador" landing page from early in this project, completely disconnected from the new app.

**Once local testing is solid, the next real milestone is:**
1. Deploy the app somewhere public — **both ChemiCloud and Vercel are now confirmed viable options**, worth deciding based on preference at the time, not technical necessity:
   - **ChemiCloud** — confirmed via real research: supports Node.js 20.10.0 via cPanel's "Setup Node.js App" tool, comfortably meets Next.js 14.2.15's minimum requirement (Node 18.17+). Familiar territory (SameNot already runs there), no new billing relationship.
   - **Vercel** — still slightly simpler specifically for Next.js (built by the same company, closer to zero-config), but no longer a clear technical necessity over ChemiCloud now that Node version concerns are resolved.
2. Connect it to a real domain
3. Add a Login/Sign Up link on the existing WordPress site pointing to the deployed app (or eventually replace the WordPress site entirely with pages served by the app itself)

**Deliberately still deferred** — not because of any remaining technical blocker, but because deploying while the app is still changing every session would trade the current fast local "save and refresh" workflow for a slower "save, redeploy, then test" cycle. Revisit once active development settles down.

## Custom SMTP for Supabase Auth Emails — Parked, Not a Blocker Yet

**The problem:** Supabase's default built-in email sender is capped at just 2-4 emails/hour and is explicitly meant for testing only — with as many test signups as this project has generated, it's easy to hit that limit and stop receiving confirmation emails.

**The fix, researched and ready when needed:** connect Resend as custom SMTP for Supabase Auth. Exact settings confirmed:
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend` (literal word, not an email)
- Password: the Resend API key already set up for the welcome email feature
- Sender: `onboarding@resend.dev` (works for testing; sending to real customers will need a verified domain later)

**Where this setting actually lives wasn't found** — checked Authentication's sub-tabs (Policies, Providers, Sessions, Rate Limits, URL Configuration, etc.) and Project Settings → Integrations, neither had it visible for this project. Supabase also offers a guided native Resend integration (mentioned in their own docs/partner page) that wasn't found either. Worth trying a fresh search or checking Supabase's current docs directly when this becomes a real priority, rather than assuming the same paths.

**Why this was deliberately parked:** zero real customers exist yet — hitting a testing-only email limit doesn't block anything important right now. Revisit closer to actual Alpha tradie signups, when reliable email delivery genuinely matters.

## Before Real Customers Touch the Messenger — Verification Checklist


The Messenger (§24) has a real, permanent test suite (`scripts/test-messenger-ai.mjs`, 8 scenarios) verifying the core safety architecture from §24. Status as of initial testing:

**Verified and solid:**
- No invented scheduling facts (asks clarifying questions instead of guessing) — passed
- Security: invalid/malformed token handling, throttling — passed, all 3 cases
- Tradie-takeover pause (AI backs off the moment a tradie replies) — passed, precisely re-verified after an initial test-script bug was found and fixed
- Reschedule logic: correctly executes valid changes, correctly refuses conflicting ones — passed, including 5 repeated runs each on the two scenarios that needed a prompt fix (10/10 pass rate after the fix)

**Two real bugs found and fixed** (both in the AI's Low/Medium urgency classification, not in safety/security logic): a future-dated scheduling conflict was under-classified as Low instead of Medium; a genuine customer question the AI couldn't fully resolve wasn't being flagged at all. Both fixed in the system prompt and reverified.

**Not yet tested — worth doing before opening this to real customers:**
- **Phrasing variants**: testing has so far used near-identical wording per scenario; a customer asking the same underlying thing in noticeably different phrasing is a genuinely different test, not yet covered
- **Adversarial testing**: a customer deliberately trying to get the AI to say something off-brand, admit it's AI (violates §23), or otherwise misbehave — not yet tested
- **Multi-turn, multi-topic conversations**: real customer threads that wander across several topics in one conversation, not yet tested
- **Real Mobile Message delivery behavior and cost under actual volume** — only tested at small scale so far

**Honest framing (Claude Code's own words, worth keeping):** this has "passed the tests we ran," which is not yet the same claim as "verified safe" for real customer traffic. Solid foundation, real gaps remain before full confidence.

## "AI Learning" Feedback Capture — BUILT AND VERIFIED

~~New Idea — Not Yet Built~~ — **Status: built and verified end-to-end.**

Founder's idea, drawing on prior chatbot-building experience: when the AI flags something it can't confidently resolve and the tradie handles it manually, the tradie can mark the outcome — "✓ Good response," "Improve response" (edit first), or "Not now" (dismiss). Approved examples get pulled into the system prompt as **calibration for tone and judgment, not rigid facts to repeat regardless of context** — capped at the 5 most recent to keep prompt size bounded.

**Implementation:** `supabase/migrations/0008_ai_knowledge.sql` (new `ai_knowledge` table, RLS-scoped per business), `lib/ai-knowledge.ts` (save/retrieve), integrated into `lib/messenger-ai.ts`'s system prompt, with the approve/improve/dismiss UI on the job detail page's messenger thread.

**Verified:** full 10/10 regression pass on the existing safety test suite (confirms this didn't break anything already tested), plus a real before/after test — a pricing question was correctly deflected with no saved knowledge, then correctly and appropriately answered (with hedging) after an example was saved and applied to a different job.

This is exactly the mechanism Claude Code described earlier as the real lever for improving the AI's judgment over time (few-shot examples) — now available directly to whoever's handling the messages, not requiring a developer to manually edit the prompt each time.

## Terms of Service — Needed Before Real Alpha Testers (Not Yet Drafted)

WorkRoute currently has no Terms of Service at all. This is a real gap to close before any real Alpha tester signs up — not urgent while the product is still actively changing, but must happen before onboarding begins.

**A draft was proposed but explicitly rejected as a starting point** — it was written entirely for the full Sarah vision (tiered pricing, lead exchange with karma points, "Sarah" as a named AI character customers interact with, calls being recorded/transcribed) rather than the actual built product ($49 flat, no lead exchange, AI stays invisible per §23, no phone calls recorded since §25 isn't built). Any real draft needs to be written against what's actually live, not the aspirational vision.

**Important, not just a formality:** any Terms of Service — especially one covering AI liability, data/privacy handling, and payment processing — needs real legal review before relying on it with actual paying customers. Specific reasons this matters here: Australian Consumer Law has real limits on what a business can disclaim away (certain consumer guarantees can't be excluded regardless of what a ToS says), and real customer contact data is being handled, which touches privacy obligations. This is not something to treat as solved by an AI-drafted document alone.

**When to revisit:** closer to actually onboarding real Alpha testers, drafted against the real product, then reviewed by an actual lawyer before use.

## "Kill Switch" — Account/Platform-Level AI Disable (Good Idea, Not Yet Built)

A safety feature worth adding: the founder being able to instantly disable AI functionality on any account (or platform-wide) if something looks wrong, reverting to manual-only mode until investigated.

**Genuinely connects to something already built:** the Messenger (§24) already has a per-job AI pause mechanism (confirmed working — the AI backs off automatically the moment a tradie replies to a conversation). This idea extends that same concept up a level — not just per-conversation, but per-account or platform-wide, for the founder's own oversight and control.

**Worth building** as a real safety net once there are real Alpha testers using the AI features live — a simple, cheap addition given the underlying pause mechanism already exists and works.

## Confirmed Architecture Rule — Do NOT Change (Flagged from a Conflicting Document)

One resurfaced document proposed "Sarah answers all calls by default, the tradie should not be getting calls" — this directly contradicts the already-locked §5 architecture (ring the tradie's phone first, only route to the AI intake system if unanswered after a timeout). **§5's "ring tradie first" behavior is correct and must not change** — this is a genuine architectural conflict worth flagging clearly, not just more Phase 2 material, since it touches §25 (phone intake), which may be actively planned or built. If Claude Code or any future document suggests "AI answers by default," check it against this note first.

**Reassuring cross-reference:** the "Escalation Queue / Needs Attention" concept this and other documents describe for phone calls already exists and works for text — that's the Messenger's flagging system (§24), already built, tested, and verified. Extending the same proven pattern to phone calls later (once §25 exists) is a natural, low-risk next step, not new design work.

## Additional Extracted Ideas (from a large consolidated document, most of which duplicated existing roadmap content)

A handful of genuinely new, distinct ideas worth preserving from an otherwise duplicate document:
- **"Call Whisper"** — a brief, private voice announcement only the tradie hears before a call connects (e.g. "WorkRoute call from Sarah in Urangan"), so they instantly know it's business, not personal, before saying hello. Applies once live voice calling exists.
- **Voice AI provider options** worth knowing for whenever live conversational voice gets built: Vapi.ai, Bland.ai, Retell AI — alternatives to a custom Twilio + OpenAI Realtime build.
- **"Job Diary" as a unified timeline UI** — combining call transcript, GPS check-in, before/after photos, and voice notes into one scrollable feed (chat/social-feed style) rather than scattered across separate tabs. The underlying pieces already exist (§10a photos, §21 voice notes, arrival status) — this is a UI/presentation idea for pulling them together.
- **Dashboard gamification specifics** — "Hours Saved" and "Fuel Saved" tiles on the home dashboard, adding concrete detail to the "Weekly Win" retention email idea already in this roadmap.
- **Stripe transaction fee** — a small percentage cut on payments processed through the platform, distinct from Deposit Guardian's escrow model. A legitimate additional monetization idea worth having on record.
- **SWMS "Safety Module" add-on** — Safe Work Method Statement PDF generation, a niche but real Australian trade-compliance requirement for larger jobs.

## 31. Generalized Pricing Configuration — CONFIRMED BUILT, This Entry Is Stale

**Status update: this was actually already built, as part of §26's implementation.** Confirmed directly against the real codebase (not assumed) while planning §25's phone AI: `lib/trade-pricing.ts`'s `computeEstimate()` and the `trade_pricing_configs` table (keyed by `business_id` + `trade`) already work generically across any trade's question set — not hardcoded to Lawn Mowing as this entry previously assumed. The design proposal below is preserved for historical context only; it describes what was built, not a future task.

*Original entry, preserved for context — the design actually implemented:*

**The problem:** §26's Instant Estimate Calculator (in the locked spec) originally only existed for Lawn Mowing. With more trades being added, and §25's adaptive voice AI needing real-time deterministic pricing to work at all, pricing configuration needed to generalize across trades — not be rebuilt bespoke each time a new trade is added.

**Architecture (as actually built):** pricing rules tie directly to each trade's existing question set (§8a/§29), rather than a separate pricing system per trade:
- **Single-select questions** (e.g. Size: Small/Medium/Large) — tradie enters a base price + duration per option
- **Yes/No questions** (e.g. Slope: Yes/No) — tradie enters a flat dollar adjustment for "Yes"
- **Multi-select questions** (e.g. add-ons: Edging/Blowing/Weed spraying) — each selected option adds its own adjustment

This means one generic "Pricing Setup" screen pattern reusable across every trade — confirmed live and working, not a strawman anymore.

## Why this is parked, not deleted

Several AI tools (and a freelancer unfamiliar with the space) contributed ideas across many sessions, and scope grew without anyone deciding what to cut. None of it is bad thinking — but building toward this as a first release is what stalled progress previously. The discipline going forward: **Phase 1 ships, gets real tradies using it, and only then do we pull items from this list based on what actual users ask for.**
