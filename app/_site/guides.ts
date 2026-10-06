// Helpful guides for salon owners (and anyone who misses calls while working).
// Written to answer real searches, not to pad the site. Rules for this file:
//  - No invented statistics, studies, reviews or customer results.
//  - Worked examples are labelled as examples, and use round numbers.
//  - Only describe WorkRoute features that exist today, including their limits.
export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; title: string; text: string };

export type Guide = {
  slug: string;
  title: string; // <title> and Article headline
  description: string;
  h1: string;
  published: string; // YYYY-MM-DD
  readMinutes: number;
  blocks: Block[];
  faq: { q: string; a: string }[];
  related: string[]; // slugs of other guides
};

export const GUIDES: Guide[] = [
  {
    slug: "missed-calls-cost-hair-salon",
    title: "What do missed calls cost a hair salon?",
    description:
      "How to work out what unanswered calls cost your salon, with a simple worked example. Plus what you can do about it.",
    h1: "What do missed calls cost a hair salon?",
    published: "2026-10-06",
    readMinutes: 5,
    blocks: [
      { type: "p", text: "You're halfway through a colour, your hands are covered, and the salon phone starts ringing. By the time you're free, the caller has already rung the next salon on Google. Most people who can't get through don't leave a message. They just book somewhere else." },
      { type: "p", text: "It's easy to feel that cost without ever seeing it. Here's a simple way to put a rough number on it." },
      { type: "h2", text: "The four numbers you need" },
      { type: "ol", items: [
        "How many calls the salon gets in a week.",
        "How many of those go unanswered (voicemail, or nobody could get to the phone).",
        "How many of the unanswered calls were new clients, not existing clients or sales calls.",
        "How many of those new clients rang someone else instead of calling back.",
      ] },
      { type: "p", text: "Multiply them together and you have the number of new clients going elsewhere. Then multiply by what a new client is worth to you." },
      { type: "h2", text: "A worked example (made-up numbers, round for ease)" },
      { type: "p", text: "Say a salon gets 30 calls a week and misses one in four. That's about 7 missed calls. If half of those are new clients, that's about 4. If half of those ring another salon instead of trying again, about 2 new clients a week go elsewhere." },
      { type: "p", text: "To be cautious, assume only half of them would actually have booked. That's about 1 new client a week. If a visit is worth $95 and a regular comes 6 times a year, one new regular is worth around $570 a year." },
      { type: "note", title: "Use your own numbers", text: "This is an example, not a prediction. Every salon is different. The free WorkRoute missed-call calculator lets you put in your own calls, your own average visit and how often clients return, and shows what you get." },
      { type: "h2", text: "Why salons feel this more than most businesses" },
      { type: "ul", items: [
        "Hands are busy by definition. A stylist mid-cut can't stop without it showing.",
        "The calls tend to come when you're busiest, because that's when everyone else is booking too.",
        "A new client is often a regular for years, so the value of one lost call is bigger than one haircut.",
        "Friday and Saturday are usually the busiest days for the chair and for the phone.",
      ] },
      { type: "h2", text: "What you can do about it" },
      { type: "ul", items: [
        "Make sure the voicemail message tells people exactly what to do next, such as a booking link or a promise to call back by a certain time.",
        "Put an online booking link where people look first: your Facebook page, Instagram bio and Google listing.",
        "Block out a time each day for return calls, and stick to it.",
        "Hire a receptionist or use an answering service. This works, but it costs money, and a person isn't there at all hours.",
        "Use an AI receptionist that answers every call and books straight into your diary.",
      ] },
      { type: "h2", text: "Where an AI receptionist fits" },
      { type: "p", text: "WorkRoute's AI receptionist, Sarah, answers the phone on about the second ring, takes the client's name and number, asks what they'd like to book (and who they usually see), quotes a price from your own price list and books a time that's actually free. She can handle several stylists working at once, and the client gets a confirmation text." },
      { type: "p", text: "She isn't a replacement for the personal touch in the chair. She's there so the phone never takes a stylist away from the client in front of them. Anything she can't handle is flagged for you." },
    ],
    faq: [
      { q: "How many missed calls is normal for a salon?", a: "It varies a lot. The honest answer is to count your own for a week or two. Write down every call you couldn't answer, then use the missed-call calculator to see what it might be costing you." },
      { q: "Do clients really ring another salon if I don't answer?", a: "Many do, especially new clients who don't have a reason to wait. Existing clients are more likely to try again later. That's why the calculator separates the two." },
    ],
    related: ["ai-receptionist-for-hair-salons", "fill-last-minute-salon-cancellations"],
  },
  {
    slug: "ai-receptionist-for-hair-salons",
    title: "AI receptionist for hair salons: what it can and can't do",
    description:
      "An honest look at what an AI receptionist does for a hair salon, what it doesn't do yet, and how to tell if it's right for you.",
    h1: "AI receptionist for hair salons: what it can and can't do",
    published: "2026-10-06",
    readMinutes: 6,
    blocks: [
      { type: "p", text: "An AI receptionist answers the salon phone and books appointments without a person having to stop what they're doing. That's the idea. Whether it's right for your salon depends on the details, so here's an honest picture of what it can and can't do." },
      { type: "h2", text: "What it can do" },
      { type: "ul", items: [
        "Answer every call, day or night, on about the second ring, in an Australian voice.",
        "Take the client's name and number, and what they'd like to book.",
        "Ask if they'd like a particular stylist, and note it down.",
        "Quote a price from your own price list: men's, women's and kids' cuts, colour, foils and treatments, each with its own price and time.",
        "Book a time that's actually free in your diary. You say how many stylists can work at the same time, and it books up to that many.",
        "Send the client a confirmation text, and let you know about the booking.",
        "Recognise returning clients by their phone number.",
        "Flag anything unusual, like a complaint or a request to speak to a person, for you to deal with.",
      ] },
      { type: "h2", text: "What it can't do yet" },
      { type: "ul", items: [
        "It books into WorkRoute's own diary. It doesn't connect to Fresha, Timely, Square or other booking software yet.",
        "A preferred stylist is recorded as a preference. Each stylist doesn't have their own separate calendar yet.",
        "It doesn't take deposits or payments when someone books.",
        "It isn't a person. If a caller needs a human, it flags that for you rather than pretending.",
      ] },
      { type: "h2", text: "Is it right for your salon?" },
      { type: "p", text: "It tends to suit salons where:" },
      { type: "ul", items: [
        "Someone often stops what they're doing to answer the phone.",
        "You don't already have a full-time receptionist.",
        "You're happy using one diary to run bookings (or you're starting fresh).",
        "Most of your calls are simple: booking, changing a time, or asking about prices.",
      ] },
      { type: "p", text: "It's probably not right yet if your whole business runs on another booking system that you can't move away from, or if you need each stylist to have a separate online calendar." },
      { type: "h2", text: "How to find out for yourself" },
      { type: "ol", items: [
        "Ring the WorkRoute demo number, 07 3522 6422, and book a pretend appointment. You'll hear exactly what your clients would.",
        "Try the free 14-day trial and enter your own price list.",
        "Test it with a few friendly clients before telling everyone.",
      ] },
    ],
    faq: [
      { q: "Will clients know they're talking to an AI?", a: "Sarah says she's an AI if anyone asks, and never pretends to be a person. In practice most callers just want to book and get on with their day." },
      { q: "What if a call is too complicated for it?", a: "She flags it for you. A complaint, an unusual request or a caller who wants a person comes straight to you, and you get a notification for anything urgent." },
    ],
    related: ["missed-calls-cost-hair-salon", "answering-service-vs-ai-receptionist"],
  },
  {
    slug: "fill-last-minute-salon-cancellations",
    title: "How to fill last-minute cancellations in your hair salon",
    description:
      "Practical ways to refill a cancelled appointment, including offering the time to clients who are booked later, and how it can be automated.",
    h1: "How to fill last-minute cancellations in your hair salon",
    published: "2026-10-06",
    readMinutes: 5,
    blocks: [
      { type: "p", text: "A client cancels an hour before their colour. That's a chair and a stylist sitting idle, and unlike most costs, it can't be earned back later. The sooner you offer that time to someone, the better your chances of filling it." },
      { type: "h2", text: "Why a waiting list often doesn't work" },
      { type: "p", text: "Most people won't join a waiting list. They'd rather book something that's certain. And an old list full of vague wishes means a lot of messaging for very few takers." },
      { type: "h2", text: "A better idea: offer the time to people who are already booked later" },
      { type: "p", text: "You already have a list of people who want an appointment: everyone who's booked in the next week or two. Some of them would happily come earlier. A short, friendly offer to move up works better than a cold message to someone who never asked." },
      { type: "ol", items: [
        "Pick clients booked for the same kind of service and the same stylist, if they asked for one.",
        "Text a few of them at once, not one at a time, so you don't wait.",
        "Keep it short: the time on offer, the time they currently have, and an easy way to say yes.",
        "Make \"no thanks\" painless. Their original booking stays as it is if they ignore it.",
        "When someone says yes, their old time becomes free too, so offer that one on in turn.",
      ] },
      { type: "h2", text: "Rules of thumb that help" },
      { type: "ul", items: [
        "Only offer times far enough away for the client to get there, such as at least an hour and a half.",
        "Don't text at night. Keep it to sensible hours.",
        "Let people opt out of these offers.",
        "Don't offer a time to someone whose service takes longer than the gap.",
      ] },
      { type: "h2", text: "Doing it automatically" },
      { type: "p", text: "WorkRoute does exactly this. When you cancel an appointment in the diary, it can text up to three clients with later bookings who'd fit the gap, with a one-tap link to move up. The first person to tap gets it, their old time can be offered on, and you get a notification. It only sends between 7am and 8pm, only for times at least 90 minutes away, and people can switch these offers off." },
      { type: "note", title: "Currently for salons and massage", text: "This is built for appointment businesses using WorkRoute's diary. It works from the bookings in WorkRoute, so it doesn't see appointments kept in other booking software." },
    ],
    faq: [
      { q: "Won't clients be annoyed by the texts?", a: "They're an offer to move an existing booking earlier, and ignoring one changes nothing. Each text has a way to turn these offers off." },
      { q: "What if two people tap at the same moment?", a: "Only one can win. The system gives the time to the first person and tells the other it's gone." },
    ],
    related: ["ai-receptionist-for-hair-salons", "missed-calls-cost-hair-salon"],
  },
  {
    slug: "answering-service-vs-ai-receptionist",
    title: "Answering service, receptionist or AI: which is right for a small business?",
    description:
      "A plain comparison of a human answering service, a part-time receptionist and an AI receptionist, and who each one suits.",
    h1: "Answering service, receptionist or AI: which is right for a small business?",
    published: "2026-10-06",
    readMinutes: 5,
    blocks: [
      { type: "p", text: "If you can't answer the phone while you're working, you have three main options. Each is good at something different, and the right one depends on how your business takes bookings." },
      { type: "h2", text: "A human answering service" },
      { type: "ul", items: [
        "Real people answer for many businesses, usually from a script.",
        "Good for taking messages and passing them on.",
        "Usually can't see your diary, so booking tends to mean a callback later.",
        "Often charged per call or per minute, with extra for after-hours.",
      ] },
      { type: "h2", text: "A part-time or full-time receptionist" },
      { type: "ul", items: [
        "The best personal touch, and they can do other jobs around the place.",
        "The most expensive option, and they're only there during their hours.",
        "Sick days and holidays leave gaps.",
        "Worth it when you're busy enough to keep them occupied.",
      ] },
      { type: "h2", text: "An AI receptionist" },
      { type: "ul", items: [
        "Answers every call straight away, at any hour, and doesn't get tired.",
        "Works best when it can see your diary and prices, so it can book and quote instead of just taking a message.",
        "Handles routine calls well, but isn't a person. Unusual or emotional calls need to be passed to you.",
        "Typically cheaper than a person, and the cost can be fixed rather than per call.",
      ] },
      { type: "h2", text: "How to choose" },
      { type: "ol", items: [
        "Count your calls. If you get only a few a week, voicemail and a quick return call might be enough.",
        "Look at what callers want. If most want to book or ask a price, a service that can book is worth more than one that takes messages.",
        "Think about your busiest times. That's when calls go unanswered, so the answer needs to work then.",
        "Check the diary. A receptionist, human or AI, is far more useful if it can see when you're free.",
        "Try before you commit. A free trial, or ringing a demo line, tells you more than a brochure.",
      ] },
      { type: "h2", text: "Where WorkRoute fits" },
      { type: "p", text: "WorkRoute is an AI receptionist built for small businesses that take bookings by phone, from tradies to hairdressers. Sarah answers on about the second ring, quotes from your own price list and books into WorkRoute's diary. It has a free 14-day trial, and you can ring the demo line on 07 3522 6422 to hear her first." },
    ],
    faq: [
      { q: "Is an AI receptionist cheaper than a human one?", a: "Usually, because it doesn't need a wage, and the monthly cost is predictable. A person is still the better choice for complex calls or when you want a very personal touch." },
      { q: "Can I keep using my current booking software?", a: "It depends on the service. WorkRoute books into its own diary and doesn't connect to other booking software yet, so check this before you choose any receptionist, human or AI." },
    ],
    related: ["ai-receptionist-for-hair-salons", "missed-calls-cost-hair-salon"],
  },
];

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
