export function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-[hsl(142_71%_45%)]"
      : pct >= 60
      ? "bg-[hsl(38_92%_50%)]"
      : "bg-[hsl(0_84%_60%)]";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
        {pct}%
      </span>
    </div>
  );
}

export function ScoreGauge({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const pct = Math.round(score);
  const color =
    pct >= 80
      ? "text-[hsl(142_71%_55%)]"
      : pct >= 60
      ? "text-[hsl(38_92%_55%)]"
      : "text-[hsl(0_84%_65%)]";

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
          <div
            className={`h-full rounded-full ${
              pct >= 80
                ? "bg-[hsl(142_71%_45%)]"
                : pct >= 60
                ? "bg-[hsl(38_92%_50%)]"
                : "bg-[hsl(0_84%_60%)]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`font-mono text-xs font-medium ${color}`}>
          {pct}
        </span>
      </div>
    </div>
  );
}
