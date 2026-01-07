export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl px-6 py-5">
        <div className="text-foreground font-semibold">Loading…</div>
        <div className="text-muted-foreground text-sm mt-1">Warming up the midway.</div>
      </div>
    </div>
  );
}


