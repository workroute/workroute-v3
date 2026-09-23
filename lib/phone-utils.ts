// §34a — a caller ID from Vapi ("+61412345678") and however a tradie
// happens to type a number into a settings form ("0412 345 678") rarely
// match byte-for-byte. Comparing the last 9 digits (an Australian mobile
// number minus its leading 0/+61) is enough to match reliably without a
// full E.164 parsing library for what's a small, low-stakes list.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-9);
}
