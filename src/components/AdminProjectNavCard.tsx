import Link from "next/link";
import { Banknote, ExternalLink, Gavel, ScrollText } from "lucide-react";

/**
 * The three admin surfaces for one project, always shown together so it is
 * obvious which link does what: the grant controls, the read-only frozen
 * review record, and the live review workspace (a second pass, which changes
 * the project's state — hence the distinct accent and the new tab).
 */
export type AdminProjectNavTarget = "grant" | "record" | "workspace";

type Accent = "emerald" | "blue" | "amber";

const ACCENT_CLASSES: Record<Accent, { icon: string; tag: string; hover: string }> = {
  emerald: {
    icon: "text-emerald-300",
    tag: "bg-emerald-500/15 text-emerald-300",
    hover: "hover:border-emerald-500/40",
  },
  blue: {
    icon: "text-carnival-blue",
    tag: "bg-carnival-blue/15 text-carnival-blue",
    hover: "hover:border-carnival-blue/40",
  },
  amber: {
    icon: "text-amber-300",
    tag: "bg-amber-500/15 text-amber-300",
    hover: "hover:border-amber-500/40",
  },
};

function NavTile({
  href,
  external,
  current,
  accent,
  icon,
  title,
  tag,
  description,
}: {
  href: string;
  external?: boolean;
  current?: boolean;
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  tag: string;
  description: string;
}) {
  const accentClasses = ACCENT_CLASSES[accent];
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={current ? "text-muted-foreground" : accentClasses.icon}>{icon}</span>
        <span className="text-foreground font-semibold truncate">{title}</span>
        {external ? (
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{description}</div>
      <span
        className={[
          "mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          current ? "bg-muted-foreground/15 text-muted-foreground" : accentClasses.tag,
        ].join(" ")}
      >
        {current ? "You are here" : tag}
      </span>
    </>
  );

  const base =
    "flex flex-col rounded-[var(--radius-2xl)] border px-4 py-4 transition-colors bg-muted";

  if (current) {
    return (
      <div className={`${base} border-dashed border-border opacity-70`} aria-current="page">
        {body}
      </div>
    );
  }

  const className = `${base} border-border ${accentClasses.hover} hover:bg-muted/70`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export default function AdminProjectNavCard({
  projectId,
  current,
  joeFraudUrl,
}: {
  projectId: string;
  current: AdminProjectNavTarget;
  joeFraudUrl?: string | null;
}) {
  const id = encodeURIComponent(projectId);

  return (
    <div className="platform-surface-card p-6 space-y-3">
      <div>
        <div className="text-foreground font-semibold text-lg">Where to go</div>
        <div className="text-sm text-muted-foreground mt-1">
          Three separate surfaces for this project — reading the record never changes it,
          re-reviewing does.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NavTile
          href={`/admin/grants/${id}`}
          current={current === "grant"}
          accent="emerald"
          icon={<Banknote className="h-4 w-4 shrink-0" aria-hidden />}
          title="Grant page"
          tag="Grant controls"
          description="Hours justification editor, Airtable preview and push, grant the project."
        />
        <NavTile
          href={`/admin/grants/${id}/reviews`}
          current={current === "record"}
          accent="blue"
          icon={<ScrollText className="h-4 w-4 shrink-0" aria-hidden />}
          title="Review record"
          tag="Read-only"
          description="Frozen decisions: every review comment plus the per-devlog accepts, rejects and deflations."
        />
        <NavTile
          href={`/review/${id}`}
          external
          current={current === "workspace"}
          accent="amber"
          icon={<Gavel className="h-4 w-4 shrink-0" aria-hidden />}
          title="Review workspace"
          tag="Second pass"
          description="Re-review devlogs and hours. Submitting here writes a new review and can change the project's status."
        />
        {joeFraudUrl ? (
          <NavTile
            href={joeFraudUrl}
            external
            accent="blue"
            icon={<ExternalLink className="h-4 w-4 shrink-0" aria-hidden />}
            title="Hackatime (Joe.fraud)"
            tag="External"
            description="The creator's raw Hackatime activity across the project's considered range."
          />
        ) : null}
      </div>
    </div>
  );
}
