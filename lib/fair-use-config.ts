// §fair-usage — the monthly call allowance a paying business's subscription
// includes. It's a safety rail, not a cut-off: Sarah always keeps answering.
// Change these two numbers and everything follows (the warning, Owner
// Overview, the website pricing and the sales chat), except the Terms text,
// which is in app/_site/legal-content.ts. Kept in its own file with no
// imports so the website pages can use it without pulling in server code.
export const FAIR_USE_CALLS_PER_MONTH = 100;
export const FAIR_USE_WARNING_AT = 0.8;
