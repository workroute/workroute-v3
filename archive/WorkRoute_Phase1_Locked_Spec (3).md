# WorkRoute — Phase 1 Locked Build Specification
**Status: AUTHORITATIVE. This is the only document that should be built against.**
**All other documents (marketing research, "Sarah" AI office manager vision, lead exchange, Vision AI quoting, route optimization) are Phase 2+ and are NOT to be built now. See companion file: Future_Roadmap.md**

---

## 1. Product Purpose

WorkRoute is a front-of-business job capture system for solo tradies and small mobile service businesses (lawn care, cleaning, window cleaning, pool maintenance, general property services).

**It exists to:**
- Ensure no job opportunity is lost to a missed call
- Capture structured job details automatically
- Turn enquiries into organised job cards
- Present a clear daily run sheet

**It is explicitly NOT (Phase 1):**
- A CRM
- An invoicing or payment system
- A live chat platform
- A lead marketplace / commission system
- A route optimization engine
- A conversational "AI office manager" with memory, personality, or open-ended dialogue

---

## 2. Target Users

- Solo tradies, owner-operators, mobile service businesses
- Each business selects **one primary trade** in Phase 1
- Initial marketing focus: lawn mowing, cleaning, window cleaning, pool maintenance, general property services

---

## 3. Core Principle (Non-Negotiable)

All calls and messages must pass through WorkRoute to be captured.

- WorkRoute-managed virtual phone number (Twilio, AU mobile)
- Calls forwarded to the tradie's existing mobile — **no second phone required**
- If communication doesn't pass through WorkRoute, it cannot be logged or automated

---

## 4. Customer Entry Points

**Supported:**
- Calls to WorkRoute number
- Missed calls to WorkRoute number
- SMS to WorkRoute number
- Online intake forms
- Facebook / QR / booking links (all route to intake forms)

**Not supported (Phase 1):**
- Direct calls/SMS to tradie's personal number
- WhatsApp capture (redirect to intake link only)

---

## 5. Phone Call Handling — REVISED (was: ring tradie first)

**Architectural decision changed today, after genuine reconsideration — this supersedes the original "ring tradie first" model.** Original reasoning for the change: a tradie technically answering a call while distracted, hands dirty, mid-job doesn't reliably capture good information — fumbled notes, forgotten details, or a missed phone number can be just as bad as a missed call, while creating a false sense the enquiry was handled. Consistent, structured AI intake on every call is closer to the actual core promise ("someone in the office answering every call for you") than a ring-first model was.

### 5.1 Call Flow (Revised)
1. Customer calls WorkRoute number
2. **Default: the AI intake assistant answers immediately** — no ringing the tradie first, no timeout window
3. **Exception — VIP/known-contact override:** the tradie can designate specific numbers (family, key regular customers) that bypass the AI entirely and ring straight through to the tradie's phone, same as a normal call. Configurable in settings.
4. All other calls go straight to the AI intake assistant (§5.2)

**Technical implication worth knowing:** this requires **unconditional call forwarding**, not the conditional/no-answer forwarding originally planned — these typically use different carrier divert codes. §14a's setup screen needs updating to reflect this (see below).

### 5.2 Intake Assistant — "Scripted Voice" Model (v1 decision)
This is the agreed approach for Phase 1 — a middle ground between robotic IVR and full conversational AI:

- Assistant asks **fixed, pre-scripted questions** in a natural-sounding AI voice (text-to-speech), not old-style "press 1 for..." beeps
- Customer answers by speaking naturally
- Speech is converted to text and **mapped to fixed fields** (not open dialogue — no free-form conversation, no memory, no personality)
- If an answer doesn't parse cleanly, the assistant does **one simple clarifying re-ask** from a pre-written fallback line
- No voicemail is ever offered — every non-VIP call routes to the assistant

**Technical shape:** Twilio voice webhook → speech-to-text → simple field-matching logic (rule-based, not an LLM having a conversation) → text-to-speech response → repeat until fields are complete → job card created.

This deliberately avoids the real-time conversational AI voice pipeline (e.g. OpenAI Realtime API bridging live audio) for the initial build — that remains high complexity and high cost. Note: since §5.1's change now makes the AI the *primary* answering path (not just overflow), it may be worth revisiting whether the scripted model still fits, or whether the Messenger's proven, safety-tested tool-calling approach (§24) should extend to voice sooner than originally planned. Not decided — worth a deliberate conversation before building, not an assumption either way.


---

## 6. SMS Handling

- Incoming SMS logged, draft job card created
- Automatic reply sent with a secure intake link
- Customer completes structured intake form → draft becomes full job card
- **No two-way SMS chat in Phase 1**

---

## 7. WhatsApp Handling

- Not captured directly
- Tradies encouraged to set WhatsApp Business auto-reply redirecting to the WorkRoute intake link

---

## 8. Intake Questions

- All structured, rule-based — same logic across voice, SMS-linked form, and web form
- Required for every enquiry:
  - Customer name
  - Contact number
  - Address (mandatory)
  - Trade-specific questions (per selected primary trade)
  - Estimate vs. Quote choice (see §9)
- Preferred date/time for the work (customer's requested availability — free text or simple date/time picker; this feeds the scheduling decision in §11, which references "customer-selected availability" as a valid input)

## 10a-i. Scheduled Time Slot

In addition to the scheduled date (§11), each job needs a time-of-day slot — either a specific time or a simple Morning/Afternoon/Evening block. Without this, the run sheet (§12) is only a list of dates, not a usable day plan. This is the actual appointment time shown to the tradie (and, later, to the customer in system-triggered messages).

## 10a-ii. Quote Visit vs. Job Visit (Run Sheet Display)

No new job type or separate entity is needed — this is a display distinction built on the existing "Quote required" flag (§9). When a Scheduled job has "Quote required" set, the run sheet (§12) should visually mark it clearly as a quote visit (e.g. a badge or label), not a job to complete — since the tradie is going out to give a price, not necessarily do the work that visit. Once the tradie enters an actual price after visiting, the same job record updates in place and behaves as a normal priced job from then on.

---

## 8a. Trade-Specific Intake Question Sets (Phase 1 — rule-based, no AI judgement required)

These question sets can be asked via the scripted voice intake (§5.2) or the web/SMS-linked form — they're just structured branching questions, not AI analysis. Selected per the business's primary trade (§2).

**Lawn Mowing:**
- Full address
- One-off or regular (fortnightly/monthly) service?
- Time since last mow / grass height (standard trim vs. very overgrown)
- Known obstacles (rocks, branches, slopes)
- Access (side gate, locked, pets)
- Add-on interest (edging, blowing, weed spraying)

**Home Cleaning:**
- Bedrooms and bathrooms count
- Single-story or multi-level
- General clean vs. Deep clean vs. End-of-lease/bond clean
- Pets indoors (yes/no)
- Add-on interest (oven, fridge interior, window scrub)
- Products/equipment: customer-supplied or cleaner-supplied
- Entry method (home / lockbox code)

**Mobile Mechanic:**
- Make, model, year (and rego if available)
- Standard logbook service vs. specific fault/repair
- If fault: warning light, noise, or won't start — brief description
- Parts: tradie-supplied or customer-supplied
- Access (driveway/street, flat space to jack up safely)
- Key handover method

**Landscaping:**
- Softscaping (turf/plants/mulch) vs. hardscaping (walls/paving/decking)
- New build or renovation of existing garden
- Access (machine-accessible vs. wheelbarrow-only)
- Ground level or sloped
- Budget range
- Desired timeline

*(Note: photo/vision-based quoting, AI lead scoring, and dynamic pricing matrices referenced alongside these scripts in source material are Phase 2+ — see Future Roadmap. Phase 1 simply records these structured answers on the job card for the tradie to price manually, per §9.)*

---

## 9. Estimate vs. Quote

Every enquiry answers: *"Are you happy to proceed based on an estimate, or would you prefer a proper quote?"*

- Job tagged: **Estimated price** or **Quote required**
- Estimates are rule-based, tradie-editable, not fixed
- Disclaimer applied automatically to all estimates

---

## 10. Job Card (Core Object)

Every enquiry becomes a job card containing:
- Source (call / missed call / SMS / form)
- Customer details + address (street, suburb, postcode)
- Trade-specific answers
- Estimated duration (editable)
- Estimated price OR "Quote required"
- Job confidence indicator (High / Medium / Low)
- Status: Unscheduled → Scheduled → On the way → Running late → Completed

---

## 10a. Arrival Photo (Simple, No AI)

When the tradie starts a job (status changes to "on the way" / arrival), the app prompts a quick camera photo attached to the job record. No analysis, no AI — just a timestamped photo saved to the job card. Purpose: dispute protection ("proof of arrival/condition") and free raw material for before/after content later (publishing that content is Phase 2 — see Future Roadmap).

**Completion photo (elevated — decided, not optional-and-easy-to-skip):** when the tradie marks a job Completed, prompt a second photo clearly and prominently — not a buried optional field. Framed as "proof of work" for the tradie's own protection and professionalism, alongside the arrival photo forming a genuine before/after pair. Still not a hard technical block on completing the job (a tradie without signal or a broken camera shouldn't be stuck), but the prompt itself should be hard to miss, not an afterthought.

---

## 11. Scheduling Rules

- Jobs are unscheduled by default
- Enter run sheet only once a date is assigned (via customer-selected availability or tradie manual scheduling)

---

## 12. Run Sheet

- Grouped by day: Today / Tomorrow / Future
- Sorted by suburb/postcode, then street (alphabetical) — **suggested ordering only**
- No live traffic data, no AI route optimization (Phase 1)
- Tradie can freely drag & reorder

---

## 13. Messaging (System-Triggered Only)

No manual chat inbox. Automated, one-directional messages triggered on:
- Job scheduled
- Tradie marks "On the way"
- Tradie marks "Running late"
- Job completed (thank-you message)

Delivery: Email in Phase 1; SMS where cost-effective and applicable.

---

## 14. Data Model Notes (Build for Phase 2 Now, Cheaply)

To keep Phase 2 (small team support, up to 5 staff) a clean extension rather than a rebuild:
- Use `user_id`, not `tradie_id`, throughout
- Add (but leave unused) fields: `users.role`, `jobs.assigned_user_id`, a stubbed `service_areas` table
- Terms & Conditions language should allow for "additional authorised users under your account" even though unused in Phase 1

---

## 14a. Call Forwarding Setup (Divert UI)

Since the tradie keeps their existing mobile and number (§3), the app must include a simple setup screen showing carrier-specific call divert codes so the tradie can activate forwarding to their WorkRoute number themselves. This is a small, low-effort screen but essential for onboarding — without it, the core call-capture mechanism doesn't work.

**Updated per §5.1's revised call flow:** since the AI now answers by default (not just on no-answer), this screen needs **unconditional call forwarding** codes, not the conditional/no-answer forwarding (`**61*` style) originally planned — these are typically different codes per carrier (e.g. unconditional forwarding is often `**21*` rather than `**61*`, though exact codes must be confirmed per-carrier, not assumed). Get accurate, current codes for Telstra, Optus, and Vodafone specifically before building this screen — don't guess or reuse the old conditional codes.

- Photos (see §10a arrival photo) must be tagged with the business's ID from day one — a simple relational link (`business_id` on every photo/asset record), not treated as loose uploads. This is cheap to build correctly now and expensive to retrofit once a public directory or gallery feature (Phase 2+) needs to query "all photos for this business."

---

## 15. Screens

**Public website:**
Homepage, How It Works, Features, Pricing (standalone), Who It's For, About, FAQ, Legal (Terms, Privacy)

**Application:**
Signup/Login, Main Dashboard (today's jobs + notifications + usage meter), Job Card view, Run Sheet view, Intake Form Builder (light), Billing & Usage

---

## 15a. UI Requirement: Field-Usable Design ("Fat Finger Friendly")

The application is used outdoors, often in bright sunlight, with gloves on, or with sweaty/dirty hands. This is a Phase 1 requirement, not a later polish item — it costs nothing extra to build correctly from day one and is expensive to retrofit:
- High-contrast theme; avoid light greys or thin fonts
- Buttons at minimum 60px tall
- No tiny menus or dense text — large touch targets throughout
- The most common action (starting the next job) should be the most visually prominent element on the dashboard

---

## 16. Pricing & Usage (Phase 1) — REVISED (Founding Rate + Standard Rate)

**Decision:** two-tier pricing, not flat $49 forever. Confirmed consistent with the original "Founding Ambassador" positioning from the very start of this project (locked-in ambassador pricing was always part of the plan, just not finalized until now).

- **Founding rate: $49/month, first 50 businesses only** — locked in for life for those who join during the Alpha/founding period. If they ever cancel, they cannot return to this rate later (matches the original "Alpha Deal" concept).
- **Standard rate: $79/month** — the real, ongoing price for everyone after the first 50 spots are filled.
- Includes defined call, SMS, and form usage allowance
- Usage tracking visible in dashboard, warning at ~90% threshold
- Overage handled via block-based add-on
- Repeat overuse → auto-prompt to move to a higher tier
- No per-call billing

**Marketing site implication:** during the Alpha/founding period, the site should prominently feature the $49 founding rate with urgency/exclusivity framing ("Founding rate $49/mo — locked in for life. Price rises to $79/mo after the first 50 spots"), not just show $79 as a flat, ordinary price. This creates a genuine reason to sign up now rather than later.

---

## 17. Explicitly Out of Scope — Phase 1

- ❌ Invoicing
- ❌ Customer payment collection
- ❌ Two-way SMS/chat
- ❌ Multi-user teams (architected for, not built)
- ❌ AI route optimization
- ❌ WhatsApp capture
- ❌ Lead exchange / marketplace / commission billing
- ❌ Vision AI photo quoting
- ❌ Live conversational AI voice (open-ended dialogue)
- ❌ Facebook ad automation
- ❌ Debt recovery automation

---

## 18. Implementation Rule

**If a feature or behaviour is not explicitly described in this document, it is out of scope for Phase 1.**

This document supersedes all prior notes, chats, or specifications from any source (freelancer, ChatGPT, Gemini, or otherwise). Any conflicting instruction is obsolete.

---

## 19. Clients (Added — Real Client Records)

WorkRoute remains explicitly not a full CRM (§1 still holds — no pipeline, no marketing automation, no lead scoring). This is a deliberate, scoped addition: a real client record, separate from jobs, so regular customers are remembered properly.

**A client record includes:**
- Name, contact number, address (same fields already captured per-job)
- Notes (free text — preferences, access details, anything the tradie wants to remember)
- Job history — every past job linked to this client, visible in one place

**How it connects to jobs:** each job (§10) links to a client record. When capturing a new job, the tradie can either select an existing client (autocomplete by name/phone) or create a new one on the spot — capturing a job should never be blocked or slowed down by client management. A client can also be added directly, before any job exists (e.g. logging a new regular's details ahead of their first booking).

**What this explicitly does NOT include (stays out of Phase 1):** pipeline/stage tracking beyond §20 below, marketing automation or campaign tools, lead scoring, communication/email history beyond job notes. Those remain Phase 2+ (see Future Roadmap).

## 20. Job Outcome Tracking (Added — Won/Lost/Declined)

A lightweight addition to the existing status flow (§10), not a new system: alongside the existing status progression (Unscheduled → Scheduled → On the way → Running late → Completed), a job can also be marked with a terminal **outcome** if it doesn't proceed — Won (became a completed job), Lost, or Declined (customer said no, or the tradie couldn't take it). This gives the tradie basic conversion visibility (how many quotes actually turn into jobs) without building a full sales pipeline.

## 21. Voice-to-Text Notes (Added — Tradie Dictation, Free, Client-Side)

A microphone button on the client Notes field (§19) letting the tradie speak instead of type — useful mid-job, hands dirty/gloved, or just faster than typing on a phone. This uses the browser's built-in Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`), the same free, client-side approach already proven working on the founder's other product (SameNot). No backend transcription cost, no API key needed for this piece.

**How it works:** tap the mic icon, speak, the raw transcribed text is inserted directly into the notes textarea — no AI parsing or field-splitting, just plain speech-to-text. This keeps it fully free (unlike SameNot's version, which pays for a GPT-4o step to split speech across multiple structured fields — not needed here since there's just one free-text notes box as the destination).

**Important distinction from the customer-facing phone assistant (§5.2):** this is unrelated to that — this is the tradie dictating to themselves in the app, not a conversational AI, not customer-facing, and not the live-voice system deferred to Phase 2. Safe, low-risk addition.

**Browser support note:** Web Speech API works reliably in Chrome and Chrome-based browsers; Safari/Firefox support is spottier. Should degrade gracefully — if unsupported, hide the mic button or show a brief "voice input needs Chrome" message, same pattern already used on SameNot.

## 22. Progressive Web App / Installable (Added — Mobile-First, Home Screen Install)

WorkRoute should be installable to a phone's home screen like a native app — same approach already proven on the founder's other product, SameNot. This affects how the app is built from here on, so it's called out explicitly rather than left implicit in "mobile-first" language elsewhere in this spec (§15a).

**Requirements:**
- A web app manifest (name, icons, theme colour, display mode set to standalone so it opens without browser chrome/address bar)
- App icons in standard sizes (192px and 512px minimum)
- A basic service worker so the app degrades reasonably on patchy connections (common on job sites) rather than failing outright — doesn't need full offline functionality in Phase 1, just resilience
- Should prompt or make it easy for the tradie to "Add to Home Screen" during onboarding

This should be built in from this point forward, not retrofitted — pages and navigation should be designed assuming they'll be opened from a home-screen icon, not a browser tab.

## 23. Customer-Facing Branding Rule (Added — WorkRoute Stays Invisible)

WorkRoute is backend software the tradie runs their business on — it should never appear as a brand name in anything a customer sees or receives. All customer-facing messages (SMS, and later phone/email) should present as coming from the tradie's own business, using their business name and (where relevant) their own first name — never "WorkRoute" or "powered by WorkRoute."

This requires a **first name field on the business profile** (doesn't currently exist — only business name is captured). Add this so messages can read naturally, e.g. "Steve from Steve's Mowing," not "Steve's Mowing from WorkRoute."

## 24. In-House Messenger (Added — Additive, Not a Replacement for §13)

An in-app messaging system, giving customers a portal/link to a full conversation history with the tradie — reduces per-message SMS cost and keeps everything logged in one place, searchable.

**Important architectural decision:** this does NOT replace the three real-time SMS triggers already built and tested in §13 (On the way, Running late, Job completed). Those stay on direct SMS, because they're inherently time-sensitive — a customer has no account, no habit of checking a portal, and nothing alerts them to check one unless something pings them, defeating the immediacy that makes those three messages useful in the first place.

**What the in-house messenger is for instead:** less time-critical, richer conversation — quote discussions, follow-up questions, anything where a customer checking a link at their own convenience is fine, and where having a full logged history (rather than scattered SMS threads) genuinely helps both the tradie and customer.

**Notification mechanism (resolves the earlier open question):** the SMS becomes a "doorbell," not the message itself. One SMS is sent when a job moves from Unscheduled → Scheduled, containing a secure, token-based link (`customer_access_token`, e.g. `/m/[token]`) — no login or account needed, the link alone grants access to that customer's job/conversation. After that first SMS, the customer can revisit the same link anytime without needing another text. Rescheduling, status updates, or other changes don't need a fresh SMS each time — the customer just re-opens their existing link. Light SMS "doorbell" pings (e.g. "Steve is on his way — tap to view") can still accompany the §13 real-time triggers, but should stay short, linking into the messenger for full detail rather than carrying the full message content in the SMS itself.

**Refined decision (superseding the "no AI" framing above):** a three-level breakdown clarifies what's actually safe to build now versus later:

- **Level 1 — Deterministic schedule actions (Phase 1, this feature):** AI interprets customer intent from free text (e.g. "can I move to 11?"), but WorkRoute's existing scheduling rules and database are the sole source of truth — the AI never invents availability, travel times, or business rules. It only acts when: the customer is authenticated to their job/business record, the request is unambiguous, the requested slot passes existing scheduling rules, there's no conflict, and the database update succeeds. If any check fails, no change is made — instead, a "needs attention" item is created for the tradie, and the customer is told their request is being checked.
- **Level 2 — Route-aware scheduling (Phase 2+, NOT this feature):** understanding how a change affects the tradie's whole day's driving (needs Google Maps integration, travel time modeling). Not built now — the existing run sheet (§12) remains the authority on daily routing.
- **Level 3 — Full autonomous multi-week optimization (Phase 2+, NOT this feature):** AI deciding where to place new jobs across weeks to minimize driving. Explicitly deferred, tracked separately in the roadmap.

**Mandatory safety requirements for Level 1:**
1. Customer must be authenticated to their specific job/business record (via the secure token link)
2. AI may only execute changes that are unambiguous — anything requiring judgment escalates to the tradie instead
3. Every AI-initiated action must pass WorkRoute's existing deterministic scheduling rules (no AI-invented exceptions)
4. Full audit trail on every autonomous action: what was requested, what was checked, what changed, whether it succeeded, whether the customer was notified
5. The AI is never the source of truth — it interprets intent and requests actions; WorkRoute's rules and database confirm or reject
6. Pricing questions, emergencies, or anything outside simple scheduling always escalate to the tradie — never handled autonomously

**What Level 1 AI can reasonably handle:** "What time is my appointment?", "Can I move from 10 to 11?" (if 11 is actually free), "Can you send Steve a photo?" (routes the photo into the job record). **What always escalates:** pricing/quote questions, emergencies, anything ambiguous or requiring judgment.

This is a genuinely new category of build — the first point where an actual AI/LLM interprets free-text intent, rather than rule-based forms and buttons. Worth treating as its own carefully scoped feature with real testing, not an afterthought bolted onto the messenger.

## 25. Phone Voice Intake — New Caller (REVISED — Adaptive Conversational AI, Supersedes Scripted Model)

**Architecture decision changed — this supersedes the original "scripted voice" description below.** After genuine reconsideration, the phone intake AI will use an adaptive conversation model, not fixed sequential questions — reusing the same proven safety architecture already built and tested for the Messenger (§24), applied to voice instead of text.

**Explicit scope decision (unchanged):** this handles new callers creating a new job — not existing customers managing an existing job (that's the Messenger, §24). Keep them separate.

**Core architecture — same "AI interprets, deterministic system decides" split as §24:**
- The AI has a natural conversation, not a rigid script — it asks questions conversationally, in whatever order makes sense, and adapts based on complexity (a simple, easy job needs fewer follow-up questions; a complex one needs more)
- The AI never invents a price. It extracts structured job information from the conversation, then hands that off to the deterministic pricing engine (§26) — which uses the tradie's own configured rates — to calculate the actual number. Same separation of concerns already proven safe in §24: **AI understands intent, deterministic logic decides outcomes.**
- The job card builds live during the call — structured fields populate as the conversation progresses, not reconstructed afterward from a transcript
- **Full audit trail, same principle as §24:** every job created this way shows "Captured by AI intake, [timestamp]" with the structured summary, and the full call transcript available underneath — so the tradie can always see exactly what the customer said if a captured detail seems off
- **Adaptive stopping point:** the AI should recognize when it has enough information for a simple job and stop asking questions, rather than working through an exhaustive fixed list regardless of complexity

**Trade + job type determines the intake path:** the AI first identifies the trade/job type, then loads that trade's specific fields (reusing `lib/trade-questions.ts`, §8a/§29) — not a fixed universal script.

**Feedback/learning loop:** reuses the same pattern as the Messenger's AI Learning system (already built) — over time, question sets and phrasing can improve based on real captured calls and tradie feedback, not just built once and left static.

**Rollout scope — deliberately narrow at launch, per genuine reconsideration:** start with **Lawn Mowing only**, not all trades at once. Reasoning: Lawn Mowing already has a working deterministic pricing engine (§26) with clean variables (size, slope, edging) — it's genuinely ready for the full "AI understands → pricing engine calculates → customer accepts" experience. Plumbing, Electrical, and similar trades are much harder to price this way (a "blocked drain" could reasonably be $150 or $800 depending on cause) — for those, the honest right output is usually "Quote Required" (§9), not an instant AI-calculated price. Add trades to the voice AI one at a time as each is proven working well — do not roll out to all trades simultaneously just because §29 added their text-based question sets. §29's expanded trade coverage stands separately for web/SMS capture, which doesn't carry the same real-time conversational risk.

**Technical implication, worth being upfront about:** this requires real-time conversational voice capability (e.g. Twilio Media Streams + a realtime AI, or a dedicated voice AI platform), not the simpler Twilio `<Gather input="speech">` approach originally planned. This is a genuinely bigger technical undertaking than the scripted model — deserves the same careful, dedicated planning and testing the Messenger got (§24), not something to build casually. Plan this properly in its own session before writing code.

**Voice selection (unchanged from original decision):** start with Twilio's built-in text-to-speech for simplicity while proving out the core flow; the custom ElevenLabs voice ("Emma Lilliana") remains a planned later upgrade. Whichever voice is used, it must not introduce itself with a name or persona (e.g. "Sarah") — stays consistent with §23.

**Explicitly still not in this build:** rescheduling, availability checks, or any judgment-making about an *existing* job — this is new-caller intake only. A caller asking about an existing job gets escalated appropriately, same as before.

---

*Original scripted-model description, superseded above, kept for reference:*

*This was the real implementation of §5.2's "scripted voice" model — fixed, pre-scripted questions via Twilio's `<Gather input="speech">`, mapped to fixed fields, with only contained AI use for classification (mapping a free-form answer to the closest structured option), never open conversation. Deliberately avoided a real-time conversational AI voice pipeline due to complexity/cost. This remains a valid, simpler fallback approach if the adaptive model above proves too complex to build well — worth remembering it's there as a lower-risk alternative, not lost.*

## 26. Instant Estimate Calculator (Added — Deterministic, No AI)

Turns existing captured job data into an automatic, calculated estimate — the tradie sets their own rates once, the system calculates from there. No AI, no guessing — pure deterministic math, subject to on-site confirmation (already required by §9's disclaimer).

**New question added to Lawn Mowing (§8a) — the only genuinely missing piece:**
- **Lawn Size** (Small / Medium / Large) — added alongside the existing questions, not replacing them. This measures a different thing than "time since last mow" (overgrown-ness) — both matter for an accurate estimate, and both stay.

**Reused, not duplicated, from existing data:** Slope and Edging already exist in the current question set (Slope inside "Known obstacles," Edging inside "Add-on interest") — the calculator reads these from the existing checkbox data rather than adding separate duplicate fields.

**Rate configuration (business profile settings, per trade):**
- Base price and base duration per size (Small/Medium/Large) — tradie sets their own numbers
- Modifiers: Edges (+$/+minutes), Slope (+$/+minutes) — tradie sets their own numbers
- Starting reference numbers (tradie-editable, not fixed): Small $40/30min, Medium $60/45min, Large $90/75min; Edges +$10/+10min; Slope +$15/+15min

**Calculation behavior:**
- **Duration is read-only** — system-calculated from the tradie's rate config, not manually editable per job (keeps run sheet time estimates consistent)
- **Price is tradie-editable per job** — the calculated estimate populates automatically, but the tradie can still adjust it for that specific job if needed (matches §9's existing "estimates are tradie-editable" rule)
- Applies at job capture — as soon as the trade-specific questions are answered, the estimate calculates and displays automatically, no separate step

**This applies to Lawn Mowing initially** — the same pattern (tradie-configured rates + deterministic formula from existing question data) can extend to other trades later, following the same approach: identify what's genuinely missing, reuse what's already captured.

## 27. Home Dashboard — Visual Design Direction (Added)

A visual mockup was produced for a marketing video and turned out to closely match what's actually built — worth adopting as real design direction for the home/dashboard page, not just inspiration.

**Layout:**
- Dark navy sidebar (business branding at top — logo/name), light content area
- Sidebar nav: Run Sheet, Messages (with unread count badge), Customers, Jobs, Calendar, Reports, Settings
- Bottom of sidebar: a small "WorkRoute AI — Your AI Secretary" indicator ("is looking after things while you're on the tools") — tradie-facing only, doesn't conflict with §23 (customers never see WorkRoute branding; this is the tradie's own view of their tools)
- Bottom of sidebar: tradie's own profile (photo, name, role — "Owner")

**Top bar:**
- "Good morning, [Name]" greeting + "Here's your day at a glance" subtext
- Weather widget (temp + condition + location) — small, genuinely useful touch for outdoor trade work
- Notification bell with unread indicator
- Business name + avatar, top right

**Main content — three-part structure, matching what's already built:**
1. **Needs Attention panel** (already exists via the Messenger, §24) — list of flagged items with Medium/Low priority badges, customer name, one-line reason, click-through to resolve. "View all messages" link.
2. **Unscheduled tray** (already exists, §11/§12) — same "nothing waiting" empty state already built.
3. **Run Sheet** (already exists, §12) — Today / Tomorrow / Future columns, with a Day/Week/List view toggle and a prominent "+ New Job" button. Future column groups by actual date (e.g. "Tue, 20 May") rather than one flat bucket — nicer organization than currently built, worth adopting.

**Empty states matter:** "No jobs scheduled — enjoy the quiet before the next one" for an empty Today column — good tone, worth keeping this kind of friendly, calm empty-state language throughout rather than sterile "no data" messages.

This should be treated as the real design reference for the home/dashboard page already in progress — not just aesthetic inspiration, since the underlying structure already matches what's built.

## 28. Messenger Photo Attachment (Added — Simple, No AI)

Customers can attach a photo to a message in the Messenger conversation (§24) — e.g. "here's what the blocked drain looks like." Simple upload and display in the thread, no AI analysis involved. Reuses the same private storage pattern already built and tested for arrival/completion photos (§10a) — same business-scoped access rules, same simple "just a file, no judgment" approach.

**Important distinction, not to be confused with this feature:** this is NOT AI-driven photo analysis or auto-quoting from an image (Vision AI) — that remains explicitly Phase 2+ (see Future Roadmap), due to real liability concerns around AI making confident-sounding guesses from images (e.g. diagnosing a fault or estimating a price from a photo alone). This feature is just attach-and-display — the tradie still looks at the photo themselves and makes their own judgment.

## 29. Expanded Trade Coverage (Added — 9 New Trades, Question Sets Upgraded with Real Research)

Expanding beyond the original 4 trades (Lawn Mowing, Home Cleaning, Mobile Mechanic, Landscaping) to cover the remaining trades from §2's original marketing focus plus several genuinely common solo-trade services. Same proven pattern as existing trades: add a `Question[]` array to `lib/trade-questions.ts`, add the trade name to the dropdown list — no new architecture needed, confirmed already working.

**Question sets below are researched, not guessed** — grounded in real industry pricing-factor guidance for each trade (same treatment Plumbing already received), not just reasonable-sounding assumptions.

**Pool Cleaning:** Pool type (In-ground/Above-ground); Pool material (Concrete-gunite/Fiberglass/Vinyl liner — concrete needs more algae-fighting effort, genuinely affects labor); Pool size (Small/Medium/Large); Pool system (Chlorine/Salt); Nearby trees/heavy debris exposure? (Yes/No); Service type (One-off/Regular); Current condition (Well-maintained/Neglected or green — affects first-clean effort significantly)

**Window Cleaning:** Small windows (0/1–5/6–10/10+); Medium windows (same scale); Large windows (same scale); Sliding doors (0/1/2/3+); Inside & outside? (Yes/No); Property type (House/Apartment); Levels (1/2+); **Screens present? (Yes/No)**; **Window condition (Normal/Heavy stains or hard water marks)**

**Pressure Cleaning:** Area type (Driveway/Patio/House exterior/Deck/Roof/Other); Area size (Small/Medium/Large); **Surface material (Concrete/Pavers/Timber deck/Render or siding/Roof tiles)**; **Condition/staining (Light/Moderate/Heavy — oil, mould, rust)**; **Height/access (Ground level/Second storey or higher)**; **Water access on-site? (Yes/No)**

**Gardening / Garden Maintenance** *(distinct trade from "Landscaping," which is for larger projects — this is regular tidy-ups and maintenance):* Type of work (General tidy/Garden maintenance/Landscaping-lite); Yard size (Small/Medium/Large); Green waste removal? (Yes/No); **Garden bed complexity (Simple/open vs. hedges, borders, tiered beds)**; **Slope/terrain (Flat/Sloped)**; **Access (Clear and wide/Narrow or side-gate only)**

**Painting:** Area (Interior/Exterior); Number of rooms/areas (1/2/3+); Surface condition (Good/Fair/Poor — confirmed as one of the single biggest price drivers); Prep work required? (Yes/No); **Ceiling height (Standard/High or vaulted)**

**Plumbing** *(already upgraded — see original detailed version, unchanged here)*

**Electrical:** Job type (Lighting/Power points/Fault finding/Installation); Urgency (Standard/Urgent); Property type (Residential/Commercial); **Property age (Newer, post-2000/Older, pre-2000 — older properties often have different wiring types requiring more care)**; **Safety switches currently installed? (Yes/No/Not sure)**; **Photo of switchboard requested** (reuses the Messenger's photo attachment feature, §28 — genuinely speeds up remote quoting, confirmed by real trade guidance)

**Pest Control:** Pest type (Ants/Cockroaches/Spiders/Rodents/Other); Property type (House/Apartment); Indoors, outdoors, or both?; **Infestation severity (Just noticed/light, Ongoing/moderate, Severe/widespread — confirmed as one of the top pricing factors)**; **Service type (One-off treatment/Ongoing plan)**

**Carpet Cleaning:** Number of rooms (1/2/3/4+); Stains present? (Yes/No); Residential or commercial?; **Stairs included? (Yes/No — often priced separately)**; **Pets in home? (Yes/No — affects odour treatment needs)**

**Handyman / General Maintenance:** **Specific task description (free text)** — added because handyman work varies so much task-to-task that categories alone aren't enough, confirmed by real guidance emphasizing itemized task lists over vague descriptions; Estimated task size (Small/Medium/Large); **Materials (Customer-supplied/Tradie to supply)**

**Existing Lawn Mowing and Home Cleaning trades are unchanged** — this document proposed simpler versions of both, but per the earlier resolution, the already-built, tested question sets stay as-is; nothing here replaces them.

## 30. Official Estimate Disclaimer Wording (Added — Adopts Concrete Copy for §9)

§9 has always required a disclaimer on every estimate, but no exact wording existed until now. Adopting this as the standard text, displayed on every job:

> **Estimates Only**
> Prices and time estimates are a general guide based on the information provided. Final pricing may change after on-site inspection or once the full scope of work is confirmed.

## 32. Mobile-First UX Redesign (Added — Major Information Architecture Revision)

A comprehensive UX redesign document was received, resolving a real problem the founder found through actual use: the current Run Sheet page tries to be both a business command center and a field tool at once, which doesn't work well on mobile (the actual primary use case — a tradie on their phone, on the road, one-handed).

**Core philosophy:** WorkRoute should feel like an AI secretary handling admin in the background, not a database/CRM the tradie has to operate. Every screen should answer exactly one question:
- **Run Sheet:** What am I doing today?
- **Messages:** Who needs my attention?
- **Customers:** Who are my customers and their history?
- **Jobs:** What work exists in my business (master record, all statuses)?
- **Calendar:** What does my week look like?
- **Reports:** How is my business performing?
- **Settings:** How does my business operate?

**Key structural change — Run Sheet becomes today-only:** Needs Attention, Unscheduled jobs, and the Lost/Declined/Reschedule buttons move OUT of the Run Sheet entirely. A job appearing on today's Run Sheet is already fully organized — the tradie sees a map with numbered stops matching numbered job cards below, a "Next Job" card with one-tap Directions, and each job card shows only three actions: **On My Way / Delayed / Completed.** Nothing else.

**Needs Attention moves to Messages**, which becomes a real, proper inbox (closing a known gap — "Messages" has been a stub since §27, with real conversations only living per-job until now). Messages shows what needs a reply, and Sarah can surface decisions there too (e.g. "Peter wants to move Thursday's job — I found a Friday slot, move it?" with Yes/No).

**Calendar is genuinely different from Run Sheet** — Calendar shows the whole week filling up (jobs-per-day counts), not daily operational detail. This is new, not yet built.

**Jobs list gets simplified mobile card presentation** — full detail only shown when a job is opened, not crammed into the list view.

**Bottom navigation** replaces/supplements the current sidebar for mobile: Run Sheet | Messages | + | Calendar | More (More containing Customers/Jobs/Reports/Settings).

### 32a. "Tell Sarah" Quick Voice Job-Entry (Added — Reuses Proven Patterns, Not a Big New Risk)

When adding a job, the primary option is **"🎙️ Tell Sarah"** — the tradie speaks naturally ("Sarah, add a lawn mow for Mick Tester tomorrow at 9am, about an hour, $80"), and it's parsed into a structured job, checked against the calendar, and booked with confirmation.

**Initially flagged as needing its own big planning session (like §25) — reassessed and revised after founder input.** This is meaningfully smaller than §25's phone AI: it reuses the same client-side speech-to-text already built and proven for §21 (voice notes) plus a single AI call to extract structured fields — the same pattern already validated on the founder's other product (SameNot). Not real-time conversational audio, not telephony infrastructure — a proven, buildable pattern.

**The calendar-conflict-checking logic** ("if 9am is taken, suggest an alternative time, get confirmation") reuses the Messenger's already-tested deterministic-check architecture (§24, Level 1 AI: AI interprets, deterministic logic decides, human confirms) — not new architecture, but real logic worth testing properly before relying on it.

**This is a second, additive job-entry path, not a replacement for the existing detailed capture flow.** The existing trade-question-driven capture (§8a, feeding §31's pricing engine) stays exactly as-is for real leads coming through calls/Messenger, where full trade detail is needed for accurate pricing. "Tell Sarah" is for fast, on-site, tradie-initiated quick-adds where full trade-question detail isn't the point — both coexist.

**Naming decision, resolved:** "Sarah" is the accepted internal, tradie-facing name for the AI assistant — used both in writing and as the spoken voice-command name (comparable to "Hey Siri" / "OK Google" — a culturally normalized pattern for addressing an AI assistant by name). This is distinct from and does not conflict with §23, which governs what a tradie's *customers* see — customer-facing communications remain completely anonymous, business-branded only, no "Sarah," no AI persona, no exceptions.

**Simplified manual entry ("Enter it yourself") remains for tradies who don't want to use voice** — Customer / Job / Date / Time / Duration / Price, kept deliberately minimal for this fast on-site path specifically (distinct from the full detailed form used elsewhere).

**Process note, worth keeping for any future big redesign:** the source document explicitly instructed Claude Code to explain the proposed information architecture back and confirm understanding *before* writing any code. This is exactly right and should be kept as standard practice for structural changes of this size — confirm shared understanding first, build second.

### 32b. Resolution — Route Optimization Boundary Confirmed, Sequencing Locked

Claude Code correctly caught that §32's numbered-map/Directions treatment for the Run Sheet implies real route optimization, which directly conflicts with §12's existing Phase 1 boundary ("no live traffic data, no AI route optimization... suggested ordering only"). Resolved, not silently overridden:

- **§12's boundary stands, unchanged.** No real Google Maps Route Optimization API, no live routing calculation in Phase 1.
- **§32's map treatment is visual polish only:** numbered pins on a simple map reflecting the *already-existing* suggested order (suburb/postcode/street sort + manual drag-reorder, exactly as §12 already specifies) — not an AI-calculated optimal route. Looks like the polished mockup, doesn't require the real routing integration or its ongoing API cost.
- **Real route optimization stays exactly where it already was** — Phase 2+, in the Future Roadmap, not urgent, to be revisited once the "WorkRoute Route Intelligence" idea gets its own proper session.

**Sequencing confirmed:** reorganize what's already built first (Run Sheet cleanup to today-only + 3 actions, Jobs table → mobile cards, bottom nav, simplified Add Job form) — all structural/deterministic work on existing data and logic. Then layer in genuinely new capability (Tell Sarah voice entry per §32a, real Messages inbox, real Calendar week view) once the reorganized skeleton is in place. This matches how every other build decision in this project has been sequenced — deterministic/structural first, AI-assisted second.

### 32c. "Open in Google Maps" — Cheap, Real Alternative to Building Route Optimization (Added)

**Key realization:** WorkRoute doesn't need to calculate an optimal route at all — a free, already-trusted tool already does this. Instead of building or paying for route optimization (§32b, deferred to Phase 2+), add a simple **"Open in Google Maps"** button on the Run Sheet that constructs a standard Google Maps multi-stop URL from today's job addresses (as waypoints) and opens it directly in the tradie's own Google Maps app.

**Why this is genuinely different from what's deferred:** this requires no Google API key, no paid Routes/Directions API calls, no server-side routing computation — just building a URL from addresses already in the database. Google Maps' own app handles the actual routing, traffic awareness, and lets the tradie freely reorder stops within an interface they already know. This is cheap enough to build in Phase 1, not something that needs to wait.

**Scope:** this button appears on the Run Sheet, sending all of today's scheduled job addresses as stops. Doesn't replace the existing suggested sort/manual drag-reorder within WorkRoute itself (§12) — it's an additional, optional "just send me to Maps" shortcut for tradies who'd rather plan their route there.

### 32d. Calendar Week View — Design Approved (Content), Nav Stays As Already Approved (Structural)

A detailed "Your Week" mobile design was received and approved as the real design direction for the Calendar screen — week navigation, per-day job breakdown, a capacity summary (jobs booked / hours booked / hours available), explicit "AVAILABLE" gap display, and a Sarah-generated capacity insight (e.g. "Thursday is nearly full, but you've got room Friday afternoon").

**Important, explicitly resolved:** this mockup's own bottom navigation (Calendar-first, Customers visible, no central + button) does **not** supersede §32's already-approved structural navigation. That decision stands exactly as locked:

**APPROVED MOBILE NAV (unchanged): Run Sheet | Messages | + | Calendar | More**
- Customers stays inside **More**, alongside Jobs, Reports, Settings — not moved to the main bar
- The central **+** button stays — removes any "where do I add a job" hesitation
- Run Sheet stays first — it's the screen used most while actually working

The Calendar mockup's own nav bar was purely illustrative of that one screen in isolation and should not be read as changing the structural decision. **Two separate, correctly-scoped decisions: the bottom nav is structural (applies everywhere, decided once), the Calendar's internal design is content (belongs to one screen).**

**Travel time hints — resolved consistently with §32b:** the mockup shows travel-time estimates between jobs ("18 min to next job"). Same boundary as the Run Sheet applies here — **skip travel-time calculation for now.** No real routing/travel-time computation in Phase 1; this stays consistent with the existing §32b decision rather than being separately re-litigated.

**Capacity summary and Sarah's insight message — genuinely low complexity, not a new AI system.** The capacity math (jobs booked, hours booked vs. available, based on working hours + job durations) is simple, deterministic arithmetic from data that already exists — no new capability required. The "Sarah" framing for the summary message can be a simple template ("X is nearly full, Y has room") or lightly AI-phrased — either way, meaningfully simpler than the adaptive voice AI (§25) or the Messenger's tool-calling logic (§24). Worth building as straightforward derived-data display, not treating it as requiring the same caution as genuinely new AI capability.

### 32e. Full-App Visual Polish Pass — Resolved Decisions

A comprehensive mockup set was received covering every screen (Run Sheet, Calendar, Customers, Jobs, Messages, Job/Message detail, More menu, Reports, Settings). Same disciplined process as Calendar's polish pass — pure styling applied broadly, genuine new functionality explicitly listed and decided rather than silently built or skipped.

**Approved to build now (low-risk, no major new data model):**
- Jobs list filter tabs (Total/Upcoming/Today/Completed) — derivable from existing status/date columns, no schema change
- Tabbed Job Detail view (Details/Customer/Notes/History) — reorganizing existing page content, not new data
- Short job label/description field (e.g. "Lawn mowing · Front & Back") — small new field, since trade-specific Q&A answers don't cleanly reduce to a short label across all trades
- Settings restructured as its own hub page (separate from just linking to Profile) — Business details / Notifications / Work hours / Help sections. **Integrations stays a placeholder only** — matches Xero/accounting work already properly deferred to Phase 2+ in the roadmap; do not build real integration functionality here.
- **Working hours field** — added now, not deferred, because Calendar's already-approved capacity math (§32d) depends on knowing working hours to calculate "hours available." Worth building alongside the Settings hub work rather than blocking §32d's capacity feature later.

**Explicitly deferred — genuinely big, separate features, not styling:**
- **Reports as a real page** (charts, revenue, completion stats) — zero backend exists (no revenue field, no analytics queries). Deserves its own planning session, same treatment as the Messenger got, not squeezed in as part of a polish pass.
- **AI insight banners on every screen** (Run Sheet, Jobs, Customers, Messages — beyond Calendar's already-approved one) — each would require real AI-generated content on every page load, which is a meaningfully different cost/complexity profile than the Messenger's per-message AI calls. Risk of the AI feeling over-used rather than special if it's everywhere. Stays limited to Calendar for now.
- **Customer ratings + "Regular" badges with recurring-cadence "next due in X days" predictions** — references a customer rating system that has never actually been designed (no source for ratings exists), plus real recurrence-detection logic. Genuinely new territory, not a missing field — needs its own proper design conversation before being built, not assumed as part of a visual refresh.

### 32f. Run Sheet — Explicit Reversal of Part of §32's "Today-Only, No Dashboard Elements" Rule

**Decision, recorded clearly since it changes an established principle rather than just adding to it:** the Run Sheet will keep a "Good morning [Name]" summary header and a highlighted "Next Job" card, alongside the today-only numbered list. This reverses part of §32's original instruction to strip Run Sheet down to a pure field tool with no dashboard-style elements.

**Context for why this is being recorded explicitly:** §32 was originally written specifically to fix a real problem the founder found through actual use — Run Sheet trying to be both a business command center and a field tool at once, which didn't work well on mobile. Reintroducing a dashboard-style header is a deliberate, informed choice to bring some of that back for this specific screen, not an accidental slide backward — but worth flagging clearly in case it's worth revisiting once it's actually used day-to-day again, the same way the original problem was discovered.

**What stays unchanged from §32:** Needs Attention and the Lost/Declined/Reschedule actions remain out of the Run Sheet (still live in Messages and the job detail page respectively) — only the summary header and Next Job card are being reintroduced, not the full original clutter.

### 32g. Dark Theme for More Menu / Reports / Settings — Resolved

The mockup shows these three screens using the dark theme (matching the sidebar), while every other screen uses the light/white card system already established, where dark has been treated as nav-only ("used sparingly"). **Recommended and applied: keep the existing light system for content pages, dark stays reserved for navigation only** — consistent with the established pattern rather than introducing a second visual mode for just three screens. Founder can override this call if the dark treatment is genuinely preferred once seen in context.

## 33. Real Onboarding/Help Content (Added — for Actual Tradie Customers, Not the Founder)

With real Alpha testers approaching, WorkRoute needs genuine onboarding help written for a tradie who's never used anything like this before — not the founder's own reference materials (like the App Map document), which serve a different purpose.

**Two-part plan:**
1. **Build real content into the "Help & support" section of Settings** (currently a placeholder per §32e) — a plain-English explanation of each screen, written for someone with zero technical background, not "documentation" tone.
2. **A short personal video from the founder for the first Alpha testers specifically** — this is not a build task; it's the founder recording themselves clicking through the app naturally. Connects back to the very first "Founding Ambassador" onboarding plan from the start of this whole project, which specifically called for a "Quick Start Video" — tradies respond far better to seeing a real person use something than reading a manual.

**Content for the Help page — plain-English, one short section per screen:**

- **Run Sheet:** "Your day, in order. Shows only what you're doing today — tap On the way, Delayed, or Completed as you go. Nothing else to manage here."
- **Calendar:** "How full your week is. See your jobs by day, and where you've still got room for more work."
- **Jobs:** "Every job you've ever had, searchable. Filter by Upcoming, Today, or Completed if you're looking for something specific."
- **Customers:** "Your regulars, remembered. Notes, job history, everything about a customer in one place — not a sales pipeline, just a record."
- **Messages:** "Things that need your reply. Your AI assistant handles routine questions automatically — this is where you step in when something needs a human decision."
- **Settings:** "Your business details, working hours, and notification preferences — set once, rarely touched again."

**Not in scope for this Help page:** anything about features not yet built (Reports, voice job entry, etc.) — only explain what's actually live, so it never contradicts what a tradie is actually looking at.

## 34. §25 Two Real Gaps Resolved (Found During Build Planning, Not in Original Spec)

Claude Code correctly identified two real gaps in §25/§5.1 that needed genuine decisions, not guesses — resolved here rather than left ambiguous.

### 34a. VIP Call Routing — Punted for Now (Not Built in This Phase)

**The problem:** §5.1's unconditional call forwarding creates a real technical bind — trying to route a VIP call back to the tradie's real mobile just re-triggers the same forwarding rule and bounces back to WorkRoute (infinite loop). The spec never addressed how VIP calls actually reach the tradie.

**Options considered:**
1. In-app answering (VIP calls ring inside the WorkRoute app itself, like WhatsApp/Zoom) — no second number needed, but real additional technical work
2. A separate contact number for VIP routing — **rejected: directly conflicts with §3's foundational "no second phone required" principle**
3. Punt entirely for now — every call goes to the AI, VIP bypass built as its own follow-up later

**Decision: Option 3.** Given this is already the single biggest technical undertaking in the project, adding in-app calling infrastructure on top risks the same overreach this project has deliberately avoided elsewhere. Every call — including family, temporarily — goes to the AI at launch. VIP routing (likely in-app answering) becomes its own focused follow-up once the core "AI answers and captures a job properly" loop is proven working, not before.

**34a-i. Lightweight addition — instant SMS alert for pre-registered numbers (added, genuinely cheap, solves the real safety concern).** Rather than routing the call itself around the AI, when a call comes from a specific pre-registered number (e.g. a spouse, family member), the system immediately sends an SMS to the tradie — e.g. *"[Name] is calling right now — you might want to call them back."* The AI still answers and handles the call normally (so a genuine emergency the caller describes still gets captured), but the tradie gets an instant heads-up on their own phone to call back directly if needed.

**Why this is meaningfully simpler than full VIP routing:** reuses SMS, which is already built and working (Mobile Message) — no new telephony infrastructure, no call-forwarding-loop problem to solve. Just needs: a small settings field to store a few "always alert me" numbers, and a check against caller ID when a call comes in to trigger the SMS.

### 34b. Non-Lawn-Mowing Calls — AI Captures for Every Trade, Escalates Pricing

**The problem:** §25's live AI-calculated pricing is explicitly Lawn Mowing only (the only trade with a working pricing engine). But nothing addressed what happens when a customer calls a WorkRoute number belonging to a Plumbing, Electrical, or any other trade business — without a decision, those numbers would do nothing at all.

**Decision:** the same adaptive AI answers calls for **every** trade and captures job details conversationally — but for anything other than Lawn Mowing, it never attempts a price, creating the job as **"Quote Required"** instead, reusing the same honesty rule §9 already applies elsewhere. Every tradie's phone number works from day one; only the "instant calculated price" experience is Lawn-Mowing-specific for now.

**Rejected alternative:** making the phone AI feature inactive entirely for other trades — would mean a real chunk of tradies' WorkRoute numbers simply don't work, directly undermining the core "never miss a call" promise for exactly the trades just added in §29.

**Correction to the framing above (added — the "Lawn Mowing only" reasoning was based on an outdated assumption):** it's not that only Lawn Mowing is *technically capable* of live pricing — §31's generalized pricing engine already works for any trade's question set. The real distinction is which trades have genuinely clean, quantifiable pricing variables versus which don't:

- **Genuinely well-suited to live pricing, same category as Lawn Mowing:** Pool Cleaning (size/type), Window Cleaning (pane count), Painting (room count/condition), Home Cleaning (bedroom/bathroom count) — clean, quotable variables, same as what makes Lawn Mowing work
- **Genuinely harder to price live, regardless of technical capability:** Plumbing, Electrical — the underlying problem varies too much (a "leak" could be $150 or $2,000) for even a human to price accurately without inspection, which is exactly why §30's disclaimer and the "Quote Required" flag exist

**Practical implication, not changing today's actual build:** starting with Lawn Mowing alone for the phone AI still makes sense as the first proven trade — but the natural next expansion, once it's proven working, is the other "cleanly quotable" trades (Pool Cleaning, Window Cleaning, Painting, Home Cleaning), which should be a relatively small lift given the pricing infrastructure already supports them generically. Plumbing and Electrical stay "Quote Required by default" as a deliberate, permanent design choice — not a temporary technical limitation to eventually remove.
