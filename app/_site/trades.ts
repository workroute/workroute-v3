import type { Scenario } from "./scenarios";
import { CLEAN, HAIR, LAWN, MASSAGE, MECHANIC, POOL } from "./scenarios";
import type { IconName } from "./ui";

// One entry per trade page (/for/<slug>). The "built-in questions" list on
// each page is read straight from lib/trade-questions.ts, so it can never
// drift from what the product really asks. Everything written here is a
// feature that exists today.
export type TradePage = {
  slug: string;
  name: string; // short name, e.g. "Pool care"
  tradeKey: string; // key in TRADE_QUESTIONS
  // A second trade shown on the same page (e.g. landscaping beside lawn care).
  also?: { label: string; tradeKey: string };
  icon: IconName;
  kind: "road" | "chair";
  title: string; // <title>
  description: string; // meta description
  h1a: string;
  h1b: string;
  lead: string;
  scenario: Scenario;
  benefits: { icon: IconName; title: string; text: string }[];
  features: string[];
  faq: { q: string; a: string }[];
  guides?: string[]; // slugs of /guides pages worth linking from this trade page
};

export const TRADE_PAGES: TradePage[] = [
  {
    slug: "lawn-care",
    name: "Lawn care / Landscaping",
    tradeKey: "Lawn Mowing",
    also: { label: "Landscaping projects", tradeKey: "Landscaping" },
    icon: "leaf",
    kind: "road",
    title: "AI receptionist for lawn care, mowing and landscaping businesses | WorkRoute",
    description: "Sarah answers the phone while you mow or landscape, quotes a real price from your lawn-size rates and books the job into a run planned around real driving time. Landscaping projects get a site visit booked for a quote.",
    h1a: "You mow the lawns.",
    h1b: "Sarah runs the office.",
    lead: "Sarah answers every call while you're on the mower, quotes a price from your own rates and books the job into your run.",
    scenario: LAWN,
    benefits: [
      { icon: "phone", title: "Catch every call", text: "The phone rings while the mower's running. Sarah picks up, so the job doesn't go to the next number on Google." },
      { icon: "dollar", title: "Quote on the spot", text: "She prices by lawn size, grass height and extras like edging, using the rates you set." },
      { icon: "route", title: "A run that makes sense", text: "Jobs are slotted around real driving time, not just an empty gap in the diary." },
    ],
    features: [
      "Recurring visits booked weeks ahead for your regulars",
      "Smart Route plans the day's run using real driving time",
      "On My Way texts the customer a calculated ETA, and Delay sends a quick update",
      "Voice job notes turn into a job record and a numbered invoice",
      "A 3pm daily brief of tomorrow's jobs and the weather",
      "Landscaping projects have their own built-in questions: soft or hard landscaping, new build or renovation, access, slope, budget and timeline",
    ],
    faq: [
      { q: "Can she handle landscaping jobs too?", a: "Yes. Landscaping has its own built-in questions: soft or hard landscaping, new build or renovation, machine or wheelbarrow access, level or sloped ground, budget range and timeline. Every project is different, so most landscapers mark these as 'requires quote'. Sarah then books a site visit and tells the caller you'll confirm the price in person." },
      { q: "Can she price different lawn sizes and extras?", a: "Yes. She asks about lawn size, how overgrown it is and any extras, then quotes from the prices you've set. It's always explained as an estimate that may change once you see the property." },
    ],
  },
  {
    slug: "cleaning",
    name: "Home cleaning",
    tradeKey: "Home Cleaning",
    icon: "sparkle",
    kind: "road",
    title: "AI receptionist for home cleaning businesses | WorkRoute",
    description: "Sarah answers the phone while you clean, quotes by bedrooms, bathrooms and extras, and books regular visits weeks ahead.",
    h1a: "You clean the homes.",
    h1b: "Sarah runs the office.",
    lead: "Sarah answers while your hands are full, quotes by home size and extras, and locks in regular clients for weeks ahead.",
    scenario: CLEAN,
    benefits: [
      { icon: "phone", title: "Never miss an enquiry", text: "Most people ring a few cleaners and book the first one who answers. Sarah makes sure that's you." },
      { icon: "dollar", title: "Quotes by home size", text: "Bedrooms, bathrooms, levels and the type of clean (general, deep or end of lease), plus extras like the oven." },
      { icon: "refresh", title: "Regulars booked ahead", text: "A weekly, fortnightly or monthly client gets their next visits booked in one go." },
    ],
    features: [
      "Built-in questions for pets indoors, entry method and who supplies the products",
      "Recurring visits booked ahead, skipping any day that clashes",
      "Returning clients recognised by number, with their usual service",
      "Numbered invoices, unpaid-invoice chasing and Google review requests",
      "Win-back calls to past clients you haven't seen for a while",
    ],
    faq: [
      { q: "Can she handle end-of-lease and deep cleans?", a: "Yes. Clean type is one of the questions she asks and prices, so a general clean, a deep clean and an end of lease can each have their own price." },
    ],
  },
  {
    slug: "pool-care",
    name: "Pool care",
    tradeKey: "Pool Cleaning",
    icon: "wave",
    kind: "road",
    title: "AI receptionist for pool cleaning and pool care businesses | WorkRoute",
    description: "Sarah answers the phone while you're at a pool, quotes by pool size, type and condition, and books regular services into your run.",
    h1a: "You look after the pools.",
    h1b: "Sarah runs the office.",
    lead: "Sarah picks up while you're elbow-deep in a filter, quotes by pool size, type and condition, and books regulars into your run.",
    scenario: POOL,
    benefits: [
      { icon: "phone", title: "Pick up the green-pool panic calls", text: "The urgent calls come when you're at another pool. Sarah answers and books them in." },
      { icon: "dollar", title: "Price the condition, not just the size", text: "A routine clean, a cloudy pool and a green recovery are different jobs. Each can have its own price." },
      { icon: "refresh", title: "Regular services on autopilot", text: "Weekly and fortnightly clients are booked ahead, so your run fills itself." },
    ],
    features: [
      "Built-in questions for pool size, chlorine, saltwater or mineral, and above-ground or in-ground",
      "Add-ons like a filter clean, equipment check or acid wash",
      "Notes any access issues and known equipment problems for you to see before you arrive",
      "Smart Route plans the day around real driving time",
      "Numbered invoices, unpaid-invoice chasing and Google review requests",
    ],
    faq: [
      { q: "Can she tell a routine clean from a green pool?", a: "Yes. She asks about the pool's current condition (clean, cloudy or green) and prices each from your own price list." },
    ],
  },
  {
    slug: "mechanics",
    name: "Mobile mechanics",
    tradeKey: "Mobile Mechanic",
    icon: "wrench",
    kind: "road",
    title: "AI receptionist for mobile mechanics | WorkRoute",
    description: "Sarah answers while you're under a car, prices by job, brand tier, fuel and vehicle type, and books the visit.",
    h1a: "You fix the cars.",
    h1b: "Sarah runs the office.",
    lead: "Sarah answers while you're under a car, works out what the job is and what vehicle it's for, and quotes from your own price list.",
    scenario: MECHANIC,
    benefits: [
      { icon: "phone", title: "Answer from under the car", text: "Callers want to know it can be done and roughly what it costs. Sarah tells them and books it." },
      { icon: "dollar", title: "Your price for each job", text: "Set a price and time for a logbook service, brakes, battery, air-conditioning or a pre-purchase inspection." },
      { icon: "wrench", title: "Quote the car, not just the job", text: "Brand tier, fuel type and vehicle type each add what you decide, so a diesel European costs more than a petrol hatch." },
    ],
    features: [
      "Sarah works out the brand tier (standard, European or luxury) from the make, and ute, 4WD or car from the model",
      "Prices by fuel type (petrol, diesel or hybrid) and cylinders when your prices depend on them",
      "Anything you'd rather price in person, like diagnosing a fault, is booked as a visit with the price confirmed on the day",
      "Built-in questions for a flat spot to jack the car up, and how you'll get the keys",
      "Smart Route, On My Way texts, voice job notes and numbered invoices",
    ],
    faq: [
      { q: "How does she price different car brands?", a: "She works out whether the make is standard, European or luxury and performance, and adds the extra you've set for that tier. She also works out whether it's a car, SUV or 4WD, or a ute or van, and can price petrol and diesel differently." },
      { q: "What about jobs she can't price?", a: "Mark them as 'requires quote' on your price list, like diagnosing a fault. Sarah books it as a visit and tells the caller you'll confirm the price in person." },
    ],
  },
  {
    slug: "hairdressers",
    name: "Hairdressers and barbers",
    tradeKey: "Hairdressing",
    icon: "scissors",
    kind: "chair",
    title: "AI receptionist for hairdressers and barbers | WorkRoute",
    description: "Sarah answers the phone while you're mid-cut, books men's, women's and kids' cuts and colour, handles several chairs and fills cancellations.",
    guides: ["missed-calls-cost-hair-salon", "ai-receptionist-for-hair-salons", "fill-last-minute-salon-cancellations"],
    h1a: "You do the hair.",
    h1b: "Sarah answers the phone.",
    lead: "No more stopping mid-cut to answer the phone. Sarah books the appointment, notes the preferred stylist and texts the client a confirmation.",
    scenario: HAIR,
    benefits: [
      { icon: "phone", title: "Nobody stops cutting", text: "In a busy salon someone always has to drop what they're doing to answer. Now nobody does." },
      { icon: "dollar", title: "A price for every service", text: "Men's, women's and kids' cuts, colour, foils and treatments, each with a price and a time." },
      { icon: "users", title: "Your regulars, your way", text: "Clients can ask for a preferred stylist, and you can rebook a regular in two taps." },
    ],
    features: [
      "Several chairs at once. Set how many people can work and Sarah books up to that many",
      "A cancellation? Sarah offers the time to clients booked later in the week, and the first to tap gets it",
      "Walk-ins in one tap, and Book again for regulars after their cut",
      "A shareable booking page for Instagram, your door or your website",
      "No addresses, no travel and no route, because clients come to you",
    ],
    faq: [
      { q: "Does each stylist get their own calendar?", a: "Not yet. You say how many people can work at once, and clients can ask for a preferred stylist. Separate calendars for each person are something we're looking at." },
      { q: "Does it work with Fresha, Timely or Square?", a: "Not yet. WorkRoute has its own diary, and Sarah books straight into it." },
    ],
  },
  {
    slug: "massage",
    name: "Massage and wellness",
    tradeKey: "Massage",
    icon: "heart",
    kind: "chair",
    title: "AI receptionist for massage therapists and wellness clinics | WorkRoute",
    description: "Sarah answers while you're with a client, books by session length and therapist, and notes any injuries or health conditions.",
    h1a: "You look after your clients.",
    h1b: "Sarah answers the phone.",
    lead: "Sarah answers while you're with a client, books the right session length and notes any injuries, so you stay present.",
    scenario: MASSAGE,
    benefits: [
      { icon: "phone", title: "Never interrupt a session", text: "The phone rings mid-treatment. Sarah takes the booking so you don't have to." },
      { icon: "clock", title: "The right amount of time", text: "30, 60 and 90 minute sessions, each with its own price, so the diary is blocked out properly." },
      { icon: "heart", title: "Notes before they arrive", text: "She asks about injuries or health conditions, and records a preferred therapist." },
    ],
    features: [
      "Several treatment rooms or therapists at once, with a limit you set",
      "A cancellation? Sarah offers the time to clients booked later in the week",
      "A confirmation text to every client, and a booking page they can use themselves",
      "Book again in two taps for regulars, and walk-ins in one",
      "No addresses and no travel, because clients come to you",
    ],
    faq: [
      { q: "Does she ask about injuries or health conditions?", a: "Yes. She asks, and the note is saved on the booking so you see it before the session." },
      { q: "Does each therapist get their own calendar?", a: "Not yet. You set how many people can work at once, and clients can ask for a preferred therapist." },
    ],
  },
];

export function findTradePage(slug: string): TradePage | undefined {
  return TRADE_PAGES.find((t) => t.slug === slug);
}
