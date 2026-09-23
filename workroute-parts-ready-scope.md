# WorkRoute Parts Ready — Feature Scope

## What it solves
Right now parts availability is checked informally (a call to the supplier) and there's no system link between "parts confirmed" and "job booked." This means jobs can get scheduled before parts are actually available, customers don't get proactively updated when something's on back order, and tradies waste trips to suppliers that could've been combined with their run.

## Goals
- Don't let a job get booked until parts are confirmed available (unless a tradie deliberately overrides it).
- Keep a visible queue of jobs stuck waiting on parts, with the customer kept in the loop automatically.
- Tell the tradie what to collect the afternoon before, and where — ideally routed sensibly against tomorrow's jobs.
- Support jobs that get partially started because a tradie chooses to come back later for a missing part.

---

## Data model

### `jobs`
| Field | Notes |
|---|---|
| id | |
| customer_id | |
| status | Quoting / Parts Pending / Ready to Book / Booked / In Progress / Complete |
| parts_status | Pending / Sent / Ready / Partial / Unavailable |
| booking_gate_override | bool — set true if tradie booked despite incomplete parts |
| override_reason | free text, required if override_gate = true |
| scheduled_date | null until parts_status allows booking (or override used) |
| assigned_tradie_id | |
| parent_job_id | null unless this is a follow-up/return-visit job |

### `job_parts`
| Field | Notes |
|---|---|
| id | |
| job_id | |
| description | |
| quantity | |
| supplier_branch_id | which branch this part is being sourced from |
| status | Pending / Sent / Confirmed Ready / Backordered / Unavailable |
| eta | populated if backordered, from supplier response |

### `suppliers` / `supplier_branches`
| Field | Notes |
|---|---|
| id | |
| supplier_name | e.g. "Reece Plumbing" |
| branch_name | e.g. "Reece Newstead" |
| address / lat-lng | needed for route-aware reminder later |
| contact_method | SMS / email / WhatsApp |
| contact_number_or_email | |

### `part_orders`
| Field | Notes |
|---|---|
| id | |
| job_id | |
| supplier_branch_id | |
| sent_at | |
| confirmed_at | |
| response_status | Ready / Partial / Unavailable |
| confirmation_method | link tap / SMS reply / manual entry by office |

### `tradie_preferences`
| Field | Notes |
|---|---|
| tradie_id | |
| require_parts_before_booking | bool, default true |
| allow_self_override | bool |

### `customer_notifications`
| Field | Notes |
|---|---|
| id | |
| job_id | |
| trigger | Parts Backordered / Parts Ready / Job Booked |
| message_sent | |
| sent_at | |
| auto_sent or staff_confirmed | |

### `follow_up_jobs`
Not a separate table necessarily — modeled via `parent_job_id` on `jobs`, tagged with a reason ("return visit — missing part") and the outstanding `job_parts` rows carried over.

---

## Phased build plan

### Phase 1 — MVP (the core gate + queue)
**Goal:** stop jobs being booked before parts are ready, and stop customers falling through the cracks.

- Parts list capture on a job/quote
- Send parts order to a supplier contact (single channel — SMS or email, pick one to start)
- Manual or link-based confirmation (Ready / Partial / Unavailable) — **skip two-way SMS parsing for v1**, it's the highest-effort, most fragile part of the whole build
- Booking gate: tradie-level toggle (`require_parts_before_booking`), with override + reason field
- "Parts Pending" queue view, sortable by days-waiting
- Templated customer message for backorder + "it's arrived" update — auto-drafted, staff taps send

**Complexity:** Medium. Mostly CRUD + one integration (SMS/email send + inbound confirmation link). No routing, no AI, no complex scheduling logic.

### Phase 2 — Pickup reminder
**Goal:** tell the tradie what to grab, for all of tomorrow's booked jobs, not per-job.

- Daily 3pm job — aggregate parts across a tradie's jobs scheduled for the next day
- Group by supplier/branch so it's a flat, easy-to-read list ("Reece Newstead: valve, 2x fittings — for 8am and 1pm jobs")
- Push/SMS delivery

**Complexity:** Small–Medium, mostly aggregation logic — no new external integrations needed if Phase 1's messaging channel is reused.

### Phase 3 — Partial completion / follow-up jobs
**Goal:** support "start now, finish later" without losing track of the outstanding part.

- "Proceed with partial" action on a job with Partial parts status
- Auto-creates a linked follow-up job carrying the missing `job_parts` rows
- Follow-up job re-enters the normal parts/booking flow once the missing part is confirmed

**Complexity:** Medium. Mostly job-cloning logic + UI for the tradie's in-the-moment decision.

### Phase 4 — Route-aware reminder
**Goal:** tell the tradie to swing by a supplier on the way, based on proximity to tomorrow's jobs.

- Requires branch addresses geocoded (already captured in Phase 1's data model, just needs lat/lng)
- Compare each job stop's location to nearby supplier branches with ready parts
- Surface as a suggestion on the run sheet ("Reece Newstead is 2 min from your 8am job — parts are ready there")
- v4.5 stretch: actually insert the supplier stop into the run sheet timeline and adjust ETAs

**Complexity:** Large. This is genuinely a routing/geospatial problem, not just a data lookup — distance calculations, "is this worth a detour" thresholds, and (for the stretch goal) timeline recalculation. Worth treating as its own mini-project once Phases 1–3 are live and you've seen how tradies actually behave with the simpler version.

---

## Recommended build order & why

1. **Phase 1 first, on its own** — it delivers the actual pain-point fix (no more booking jobs before parts are ready) and is buildable without any geospatial or routing work. Ship this, use it for a few weeks, see how tradies actually respond to overrides and how often backorders happen.
2. **Phase 2 next** — cheap to add once Phase 1's messaging pipe exists, and gives an immediate quality-of-life win.
3. **Phase 3** — build once you have real data on how often partial-parts situations occur. If it's rare, it might not be worth automating yet — worth checking actual frequency before investing here.
4. **Phase 4 last, and treat it as optional** — it's the most expensive piece for what's likely a smaller, "nice to have" slice of the value. Don't let it hold up shipping the parts-gate fix, which is the thing actually costing you money/time today.

## Open questions to settle before building Phase 1
- Single messaging channel to start (SMS vs email) — which one do your suppliers actually respond to reliably?
- Confirmation link vs manual office entry — do you trust suppliers to tap a link, or does someone in your office need to be the one marking status based on a phone call?
- Auto-send customer messages, or always require a staff tap before sending?
