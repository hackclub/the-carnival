import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import Header from "@/components/Header";
import { db } from "@/db";
import { editor } from "@/db/schema";

export default async function EditorsPage() {
  // Prevent build-time prerender from attempting a DB connection in Docker builds.
  noStore();

  const editors = await db
    .select({
      id: editor.id,
      name: editor.name,
      slug: editor.slug,
      description: editor.description,
    })
    .from(editor)
    .orderBy(editor.name);

  return (
    <div className="platform-shell-bg relative min-h-screen overflow-hidden">
      <div className="carnival-paper-grid pointer-events-none absolute inset-0 opacity-30" />
      <Header showSectionLinks={false} />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 md:px-10">
        <div className="platform-page-heading mb-8 px-6 py-5">
          <h1 className="text-3xl font-bold uppercase leading-none tracking-[0.06em] text-foreground md:text-4xl">Editors you can build for</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-muted-foreground md:text-base">
            Pick any supported program/editor and ship an extension/plugin/widget. Check out the{" "}
            <Link href="/resources" className="font-bold text-[var(--platform-ink)] underline decoration-[3px] underline-offset-4 hover:text-[var(--platform-accent-strong)]">
              Resources
            </Link>{" "}
            section for documentation and tutorials.
          </p>
        </div>

        <div className="platform-surface-card p-6">
          <div className="flex flex-wrap gap-3">
            {editors.map((e) => (
              <Link
                key={e.id}
                href="/resources"
                className="rounded-[var(--carnival-squircle-radius)] border border-border bg-[#fff0cf] px-4 py-2 text-sm font-bold text-[var(--platform-ink)] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc]"
                title={e.description || e.name}
              >
                {e.name}
              </Link>
            ))}
            <span className="rounded-[var(--carnival-squircle-radius)] border border-border bg-[#fff0cf] px-4 py-2 text-sm font-bold text-[var(--platform-ink)]">
              Other
            </span>
          </div>
          <div className="mt-5 text-sm font-bold leading-6 text-muted-foreground">
            Tip: in your project submission, include screenshots and clear install/run steps for that editor.
          </div>
        </div>
      </main>
    </div>
  );
}
