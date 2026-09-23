import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewClientForm from "./new-client-form";

export default async function NewClientPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-rig-900">Add client</h1>
        <p className="mt-1 text-sm text-rig-700">
          For a regular you want on file before any job exists.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <NewClientForm businessId={user.id} />
        </div>
      </div>
    </main>
  );
}
