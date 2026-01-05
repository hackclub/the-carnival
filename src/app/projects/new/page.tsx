import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";

export default async function NewProjectPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/projects/new");
  }

  return (
    <AppShell title="Create project">
      <div className="bg-carnival-card/70 border border-white/10 rounded-2xl p-8">
        <div className="text-white font-semibold text-lg">Not wired yet</div>
        <div className="text-gray-400 mt-1">
          The UI is here, but we still need a create-project form + endpoint.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-full font-semibold transition-colors border border-white/10"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </AppShell>
  );
}


