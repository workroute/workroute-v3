import { createServiceRoleClient } from "@/lib/supabase/service-role";
import WidgetChat from "./widget-chat";

// §Website Widget — deliberately public, loaded inside an <iframe> on an
// arbitrary third-party site (public/widget.js injects it). No auth guard:
// there's no such thing as a signed-in visitor here, same reasoning as
// app/m/[token]/page.tsx. widget_key (an unguessable uuid, but meant to be
// public/visible in page source, unlike a Messenger token) is the whole
// identity boundary — see supabase/migrations/0016_website_widget.sql.
export default async function WidgetFramePage({ searchParams }: { searchParams: { key?: string; preview?: string } }) {
  const widgetKey = searchParams.key;

  const supabase = createServiceRoleClient();
  const { data: profile } = widgetKey
    ? await supabase.from("business_profiles").select("business_name, first_name").eq("widget_key", widgetKey).maybeSingle()
    : { data: null };

  if (!widgetKey || !profile) {
    return null;
  }

  // ?preview=1 is only ever passed from the settings page's own "Try it
  // now" iframe (app/app/(app)/settings/website-chat/website-chat-form.tsx)
  // — that embed isn't sized by public/widget.js's resize postMessage (it's
  // a fixed box in the settings page layout, not a real site's floating
  // launcher), so starting closed there would just render a giant bubble
  // filling the whole preview box instead of the actual chat window.
  return <WidgetChat widgetKey={widgetKey} businessName={profile.business_name} defaultOpen={searchParams.preview === "1"} />;
}
