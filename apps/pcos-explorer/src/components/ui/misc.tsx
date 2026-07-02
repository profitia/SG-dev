export function JsonViewer({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);

  return (
    <pre className="overflow-x-auto rounded-md bg-[hsl(var(--secondary))] p-3 font-mono text-[11px] text-[hsl(var(--foreground))] leading-relaxed max-h-64 overflow-y-auto">
      {json}
    </pre>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export function Divider() {
  return (
    <div className="h-px bg-border" />
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}
