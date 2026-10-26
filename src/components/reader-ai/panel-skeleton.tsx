/** Loading state for reader AI panels: shown while the panel's code or data loads. */
export function PanelSkeleton({ label, lines = 4, children }: { label: string; lines?: number; children?: React.ReactNode }) {
  return (
    <div role="status" aria-busy className="space-y-3 rounded-md border border-border bg-obsidian p-5">
      <p className="text-sm text-grey">{label}</p>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded-sm bg-obsidian-raised" style={{ inlineSize: `${92 - i * 11}%` }} />
      ))}
      {children}
    </div>
  );
}
