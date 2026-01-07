import Link from "next/link";
import Header from "@/components/Header";
import { db } from "@/db";
import { editor } from "@/db/schema";

export default async function EditorsPage() {
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-100/40 via-transparent to-transparent" />
      <Header showSectionLinks={false} />

      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-10 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Editors you can build for</h1>
          <p className="text-muted-foreground mt-2">
            Pick any supported program/editor and ship an extension/plugin/widget. Check out the{" "}
            <Link href="/resources" className="text-carnival-blue hover:underline font-medium">
              Resources
            </Link>{" "}
            section for documentation and tutorials.
          </p>
        </div>

        <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-6">
          <div className="flex flex-wrap gap-3">
            {editors.map((e) => (
              <Link
                key={e.id}
                href="/resources"
                className="bg-amber-50/70 ring-1 ring-amber-200 text-amber-900 px-4 py-2 rounded-full text-sm font-semibold hover:bg-amber-100/70 transition-colors"
                title={e.description || e.name}
              >
                {e.name}
              </Link>
            ))}
            <span className="bg-amber-50/70 ring-1 ring-amber-200 text-amber-900 px-4 py-2 rounded-full text-sm font-semibold">
              Other
            </span>
          </div>
          <div className="mt-5 text-sm text-muted-foreground">
            Tip: in your project submission, include screenshots and clear install/run steps for that editor.
          </div>
        </div>
      </main>
    </div>
  );
}


