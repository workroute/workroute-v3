import { createClient } from "@/lib/supabase/server";
import MessengerChat, { type ThreadRow } from "./messenger-chat";
import PushPrompt from "./push-prompt";

// §Messenger — deliberately public. No auth.getUser() guard here: there is
// no such thing as a signed-in customer, and this route must stay reachable
// unauthenticated. The token itself (an unguessable uuid) is the entire
// security boundary — see messenger_get_thread in the 0007 migration.
export default async function MessengerPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data } = await supabase.rpc("messenger_get_thread", { p_token: params.token });
  const thread = data as ThreadRow | null;

  if (!thread) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-display font-semibold text-rig-900">Link not found</p>
          <p className="mt-2 text-sm text-rig-700">
            This link may be out of date. Please contact the business directly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center bg-paper-50 sm:items-center sm:p-6">
      {/* Full-screen on a phone (where this link actually gets opened from
          an SMS), a constrained "widget" card once there's room to spare. */}
      <div className="flex w-full max-w-md flex-col bg-white sm:h-[min(80vh,640px)] sm:overflow-hidden sm:rounded-lg sm:shadow-lg">
        <header className="border-b border-rig-900/10 bg-rig-900 px-4 py-4 sm:rounded-t-lg">
          <p className="font-display text-lg font-semibold text-paper-50">{thread.business_name}</p>
        </header>
        <PushPrompt token={params.token} />
        <MessengerChat token={params.token} initialThread={thread} />
      </div>
    </main>
  );
}
