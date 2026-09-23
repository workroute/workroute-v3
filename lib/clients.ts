// §19 — shared types and helpers for client records.

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_suburb: string | null;
  address_postcode: string | null;
  notes: string | null;
  do_not_call: boolean;
  created_at: string;
  updated_at: string;
};

export function clientAddress(
  client: Pick<Client, "address_street" | "address_suburb" | "address_postcode">
): string {
  return [client.address_street, client.address_suburb, client.address_postcode]
    .filter(Boolean)
    .join(", ");
}
