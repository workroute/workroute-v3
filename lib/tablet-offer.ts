// The free tablet offer shown at sign-up. If the wording or the tablet's value
// changes, bump TABLET_OFFER_VERSION so each acceptance records exactly which
// version of the offer that person agreed to.

export const TABLET_OFFER_VERSION = "2026-10-09";

export const TABLET_OFFER_VALUE = 174;

// How long the tablet takes to arrive. When it's posted, the business's free
// trial is moved to start this many days later.
export const TABLET_DELIVERY_DAYS = 5;

export const TABLET_OFFER_PARAGRAPHS = [
  "When you start WorkRoute, we'll set up a tablet for your front desk, already logged in and ready to use. It's yours to keep once you've been with WorkRoute for 6 months in a row.",
  "Until then, the tablet belongs to WorkRoute. If you cancel before the 6 months are up, please return it in good working condition within 14 days. We'll email you a prepaid return label. Please tap Sign out before you send it back, and we'll wipe it when it arrives.",
  `If it isn't returned, we may charge you for the tablet. That's $${TABLET_OFFER_VALUE}, reduced by one-sixth for each full month you've been with us.`,
  "Your subscription is still month-to-month and you can cancel at any time. This only covers what happens to the tablet.",
];
