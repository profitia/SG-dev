export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-6 px-6 py-5 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground lg:text-base">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </div>
  );
}
