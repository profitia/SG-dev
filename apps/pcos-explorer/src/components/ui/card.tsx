import { clsx } from "clsx";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-4 flex items-center justify-between gap-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={clsx(
        "text-sm font-semibold tracking-[0.01em] text-foreground",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function CardMeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={clsx("text-xs leading-5 text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p
        className={clsx(
          "mt-3 text-3xl font-semibold tabular-nums tracking-tight",
          accent
            ? "text-[hsl(var(--pcos-accent))]"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {sub}
        </p>
      )}
    </Card>
  );
}
