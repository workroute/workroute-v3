import type { Metadata } from "next";
import LegalPage from "../_site/legal";
import { PRIVACY_HTML } from "../_site/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy | WorkRoute",
  description: "How WorkRoute collects, uses, stores and protects personal information.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return <LegalPage html={PRIVACY_HTML} />;
}
