const milestoneItems = [
  "Vercly provider adapter is now isolated behind a local technical boundary.",
  "PostgreSQL and Prisma now back the local verification history boundary.",
  "Polling, orchestration, and PDF export remain out of scope for this runtime baseline.",
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">SG-dev runtime boundary</p>
        <h1>Vercly</h1>
        <p className="lead">Internal company verification dashboard.</p>
        <p className="supporting">
          This scaffold establishes the minimal Next.js runtime surface for the
          future Vercly application. External API integration and persistence
          will be added in subsequent sprints.
        </p>
      </section>

      <section className="panel-grid" aria-label="Runtime status panels">
        <article className="panel">
          <h2>Current scope</h2>
          <p>
            Base runtime shell, app-local Prisma persistence boundary, and a
            lightweight health endpoint for smoke checks.
          </p>
        </article>

        <article className="panel">
          <h2>Developer checks</h2>
          <p>
            The runtime exposes <a href="/api/health">/api/health</a> for a
            minimal readiness response and
            <a href="/api/dev/persistence-smoke"> /api/dev/persistence-smoke</a>{" "}
            for a dev-only persistence round-trip.
          </p>
          <p>
            Provider readiness is exposed at
            <a href="/api/dev/vercly-provider-readiness">
              {" "}/api/dev/vercly-provider-readiness
            </a>
            .
          </p>
        </article>
      </section>

      <section className="panel roadmap">
        <h2>Deferred by design</h2>
        <ul>
          {milestoneItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}