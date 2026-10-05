import type { Metadata } from "next";
import LegalPage from "../_site/legal";
import { TERMS_HTML } from "../_site/legal-content";

export const metadata: Metadata = {
  title: "Terms and Conditions | WorkRoute",
  description: "The terms that apply when you use WorkRoute.",
  alternates: { canonical: "/terms-and-conditions" },
};

export default function TermsPage() {
  return <LegalPage html={TERMS_HTML} />;
}
