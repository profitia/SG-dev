import { clsx } from "clsx";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "muted"
  | "pcos";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default:
    "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  success:
    "bg-[hsl(142_71%_15%)] text-[hsl(142_71%_65%)] border border-[hsl(142_71%_25%)]",
  warning:
    "bg-[hsl(38_92%_15%)] text-[hsl(38_92%_65%)] border border-[hsl(38_92%_25%)]",
  error:
    "bg-[hsl(0_84%_15%)] text-[hsl(0_84%_65%)] border border-[hsl(0_84%_25%)]",
  muted: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  pcos: "bg-[hsl(38_92%_15%)] text-[hsl(38_92%_65%)] border border-[hsl(38_92%_25%)]",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant: BadgeVariant =
    status === "COMPLETED" || status === "PROMOTED"
      ? "success"
      : status === "RUNNING"
      ? "pcos"
      : status === "FAILED"
      ? "error"
      : status === "PENDING" || status === "CHECKPOINTED"
      ? "warning"
      : "muted";

  return <Badge variant={variant}>{status}</Badge>;
}
