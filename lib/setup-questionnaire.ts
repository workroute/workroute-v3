// §setup-questionnaire — the answers a tradie gives on app/setup so Steve can
// enter their pricing, hours and voice into Settings for them. Shared by the
// form (labels, hints), the endpoint (cleaning) and the email (layout).

export type SetupAnswers = {
  name: string;
  business: string;
  trade: string;
  mobile: string;
  email: string;
  area: string;
  pricing: string;
  callout: string;
  hours: string;
  wontDo: string;
  emergency: string;
  voice: string;
  pronunciations: string;
};

export type SetupField = {
  key: keyof SetupAnswers;
  label: string;
  hint?: string;
  required?: boolean;
  maxLength: number;
  kind?: "text" | "textarea" | "tel" | "email" | "trade" | "emergency";
  placeholder?: string;
};

export const EMERGENCY_CHOICES = [
  "Text me",
  "Ring me",
  "Just take the details and I'll sort it later",
] as const;

// In the order a tradie would say them on a call, matching the Settings
// screens Steve fills in afterwards.
export const SETUP_FIELDS: SetupField[] = [
  { key: "name", label: "Your first name", required: true, maxLength: 100, kind: "text" },
  { key: "business", label: "Business name", required: true, maxLength: 150, kind: "text", placeholder: "e.g. Doyle Electrical" },
  { key: "trade", label: "Your trade", required: true, maxLength: 80, kind: "trade" },
  {
    key: "mobile",
    label: "Your mobile number",
    hint: "This is where texts about new jobs will go.",
    required: true,
    maxLength: 30,
    kind: "tel",
  },
  { key: "email", label: "Your email (optional)", maxLength: 200, kind: "email" },
  {
    key: "area",
    label: "What suburbs or area do you work in?",
    maxLength: 400,
    kind: "textarea",
    placeholder: "e.g. Brisbane north side, Moreton Bay, up to Caboolture",
  },
  {
    key: "pricing",
    label: "What do you charge?",
    hint: "For each type of job, give a price or a starting price. Rough is fine.",
    maxLength: 2000,
    kind: "textarea",
    placeholder: "e.g. Standard lawn mow from $60, hedge trimming $50 an hour, green waste removal $40",
  },
  {
    key: "callout",
    label: "Do you charge a call-out fee or have a minimum?",
    maxLength: 400,
    kind: "textarea",
    placeholder: "e.g. $90 call-out, minimum one hour",
  },
  {
    key: "hours",
    label: "What days and hours do you work?",
    hint: "And whether you do after-hours or emergency jobs.",
    maxLength: 600,
    kind: "textarea",
    placeholder: "e.g. Mon to Fri 7 to 4, Saturday mornings, no Sundays",
  },
  {
    key: "wontDo",
    label: "Which jobs do you not do, or don't want?",
    maxLength: 600,
    kind: "textarea",
    placeholder: "e.g. No tree removal, nothing over two storeys",
  },
  { key: "emergency", label: "If it's an emergency, what should Sarah do?", maxLength: 100, kind: "emergency" },
  {
    key: "voice",
    label: "What name and voice do you like for your receptionist?",
    hint: "She's called Sarah unless you'd like another name. Say how you'd like her to answer the phone, too.",
    maxLength: 400,
    kind: "textarea",
    placeholder: "e.g. Keep Sarah, a friendly woman's voice. Answer as Doyle Electrical.",
  },
  {
    key: "pronunciations",
    label: "Any words she might get wrong?",
    hint: "Suburb names, your business name, or anything unusual.",
    maxLength: 600,
    kind: "textarea",
    placeholder: "e.g. Toowong is 'Too-wong', Samford is 'Sam-ford'",
  },
];

// Cleans whatever the browser sent into the exact shape above, trimmed and
// length-capped. Unknown keys are dropped and anything that isn't a string
// becomes empty.
export function sanitizeSetupAnswers(raw: unknown): SetupAnswers {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as SetupAnswers;
  for (const field of SETUP_FIELDS) {
    const value = source[field.key];
    out[field.key] = typeof value === "string" ? value.trim().slice(0, field.maxLength) : "";
  }
  return out;
}
