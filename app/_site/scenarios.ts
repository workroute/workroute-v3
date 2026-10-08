// Illustrative calls shown on the marketing site. They are examples of the
// kind of conversation Sarah has, not recordings. Every price is an estimate
// drawn from prices the business enters in setup, which is also how Sarah
// describes it on a real call.
export type Line = { who: "sarah" | "caller"; text: string };
export type Scenario = {
  id: string;
  tab: string;
  business: string;
  lines: Line[];
  booked: { when: string; what: string; extra: string };
};

export const HAIR: Scenario = {
  id: "hair",
  tab: "Hairdresser",
  business: "Chic Cuts",
  lines: [
    { who: "sarah", text: "Good morning, Chic Cuts. I'm Sarah, the AI office manager. How can I help?" },
    { who: "caller", text: "Hi, I'd like a cut and colour this week." },
    { who: "sarah", text: "Lovely. Can I grab your name and best number? And do you usually see Jess, Sam or Alex?" },
    { who: "caller", text: "Emma Clarke, 0412 345 678. Jess please." },
    { who: "sarah", text: "Thanks, Emma. I'll put Jess down as your preferred stylist. A cut and colour is about $185 and takes around two hours. Thursday at 10:30 is free. Shall I book it?" },
    { who: "caller", text: "Yes please!" },
  ],
  booked: { when: "Thu 10:30am", what: "Cut and colour", extra: "Preferred stylist: Jess · est. $185" },
};

export const LAWN: Scenario = {
  id: "lawn",
  tab: "Lawn care",
  business: "Steve's Mowing",
  lines: [
    { who: "sarah", text: "Good morning, Steve's Mowing. I'm Sarah, the AI office manager. How can I help?" },
    { who: "caller", text: "I need my lawns mowed please." },
    { who: "sarah", text: "No problem. Can I get your name and the address for the property?" },
    { who: "caller", text: "John, 24 Palm Street, Urangan." },
    { who: "sarah", text: "Thanks, John. For a medium lawn with edging that's about $60. It's an estimate, Steve will confirm once he's seen the property. Thursday morning suits the run. Want me to lock it in?" },
    { who: "caller", text: "Yes please." },
  ],
  booked: { when: "Thu morning", what: "Lawn mow, Urangan", extra: "Fits Steve's run · est. $60" },
};

export const CLEAN: Scenario = {
  id: "clean",
  tab: "Cleaning",
  business: "Sparkle Home Cleaning",
  lines: [
    { who: "sarah", text: "Hi, Sparkle Home Cleaning. I'm Sarah, the AI office manager. How can I help?" },
    { who: "caller", text: "Can I get a quote for a three-bedroom clean?" },
    { who: "sarah", text: "Of course. How many bathrooms are there?" },
    { who: "caller", text: "Two. We'd like it fortnightly please, with the oven done." },
    { who: "sarah", text: "A fortnightly clean with the oven is about $190. I can do Tuesdays at 9 and book your next five visits now. Shall I?" },
    { who: "caller", text: "That would be perfect." },
  ],
  booked: { when: "Tue 9:00am", what: "Fortnightly clean", extra: "Next 5 visits booked · est. $190" },
};

export const MASSAGE: Scenario = {
  id: "massage",
  tab: "Massage",
  business: "Still Point Massage",
  lines: [
    { who: "sarah", text: "Hello, Still Point Massage. I'm Sarah, the AI office manager. How can I help?" },
    { who: "caller", text: "I'd like a 60 minute remedial massage." },
    { who: "sarah", text: "Of course. Is there an injury or condition the therapist should know about? And would you like Sam or Ellie?" },
    { who: "caller", text: "Tight lower back from work. Sam, if possible." },
    { who: "sarah", text: "Noted, I'll pass that on. A 60 minute remedial session is $110. Friday at 4:00 is free. Shall I book it?" },
    { who: "caller", text: "Yes, thank you." },
  ],
  booked: { when: "Fri 4:00pm", what: "Remedial, 60 min", extra: "Preferred therapist: Sam · $110" },
};

export const POOL: Scenario = {
  id: "pool",
  tab: "Pool care",
  business: "Crystal Clear Pools",
  lines: [
    { who: "sarah", text: "Hi, Crystal Clear Pools. I'm Sarah, the AI office manager. How can I help?" },
    { who: "caller", text: "My pool's gone a bit green and I need it sorted." },
    { who: "sarah", text: "No worries. Roughly how big is the pool: small, medium or large?" },
    { who: "caller", text: "Medium, and it's in-ground." },
    { who: "sarah", text: "Thanks. A green pool recovery on a medium in-ground pool is about $240. It's an estimate, Dave will confirm once he's seen it. Wednesday morning is free. Shall I book it?" },
    { who: "caller", text: "Yes please." },
  ],
  booked: { when: "Wed morning", what: "Green pool recovery", extra: "Medium in-ground · est. $240" },
};

export const MECHANIC: Scenario = {
  id: "mechanic",
  tab: "Mechanic",
  business: "Mobile Mick",
  lines: [
    { who: "sarah", text: "Hi, Mobile Mick. I'm Sarah, the AI office manager. How can I help?" },
    { who: "caller", text: "I need the brakes done on my Hilux." },
    { who: "sarah", text: "Sure thing. Can I get your name, and what year is it? Is it petrol or diesel?" },
    { who: "caller", text: "Dan. It's a 2019, diesel." },
    { who: "sarah", text: "Thanks, Dan. Brakes on a diesel ute come to about $290. It's an estimate, Mick will confirm once he's looked at it. Is there a flat spot where he can jack it up?" },
    { who: "caller", text: "Yep, the driveway. Friday morning works." },
  ],
  booked: { when: "Fri morning", what: "Brakes, 2019 Hilux", extra: "Diesel ute · est. $290" },
};

// The homepage tabs, in the order shown.
export const HOMEPAGE_SCENARIOS: Scenario[] = [HAIR, LAWN, CLEAN, MASSAGE];
