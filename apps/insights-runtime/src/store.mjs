import { randomUUID } from "node:crypto";
import {
  command,
  assertContext,
  editionKey,
  digest,
  requireThat,
  canonical,
} from "../../../packages/insights-contracts/index.mjs";
export class PostgresReportStore {
  constructor(pool) {
    this.pool = pool;
  }
  async transaction(org, fn) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "SELECT set_config('insights.organisation_id',$1,true),set_config('statement_timeout','15000',true)",
        [org],
      );
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  async start(ctx, input, profile, trigger) {
    assertContext(ctx);
    const c = command(input),
      key = editionKey(ctx.organisationId, c),
      id = randomUUID();
    const j = {
      id,
      editionId: id,
      organisationId: ctx.organisationId,
      businessKey: key,
      command: c,
      profile: structuredClone(profile),
      author: {
        actorId: ctx.actorId,
        kind: ctx.actorKind,
        decisionId: ctx.decisionId,
      },
      trigger,
      status: "QUEUED",
      coverage: null,
      stages: {},
      calls: {},
      createdAt: new Date().toISOString(),
    };
    return this.transaction(ctx.organisationId, async (db) => {
      await db.query(
        `INSERT INTO insights_private.report_jobs(id,organisation_id,business_key,definition_id,period_start,period_end,revision,status,document) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [
          id,
          ctx.organisationId,
          key,
          c.definitionId,
          c.period.fromDate,
          c.period.throughDate,
          c.revision,
          j.status,
          j,
        ],
      );
      const row = (
        await db.query(
          "SELECT document FROM insights_private.report_jobs WHERE organisation_id=$1 AND business_key=$2",
          [ctx.organisationId, key],
        )
      ).rows[0];
      requireThat(
        row.document.command.profileVersion === c.profileVersion,
        "EDITION_PROFILE_CONFLICT",
      );
      return row.document;
    });
  }
  async get(org, id) {
    return this.transaction(
      org,
      async (db) =>
        (
          await db.query(
            "SELECT document FROM insights_private.report_jobs WHERE id=$1",
            [id],
          )
        ).rows[0]?.document ?? null,
    );
  }
  async list(org, { limit = 50, before = null } = {}) {
    return this.transaction(org, async (db) =>
      (
        await db.query(
          "SELECT document FROM insights_private.report_jobs WHERE ($1::timestamptz IS NULL OR created_at<$1) ORDER BY created_at DESC,id DESC LIMIT $2",
          [before, Math.min(100, Math.max(1, limit))],
        )
      ).rows.map((r) => r.document),
    );
  }
  async queued(org) {
    return this.transaction(
      org,
      async (db) =>
        (
          await db.query(
            "SELECT id FROM insights_private.report_jobs WHERE status IN ('QUEUED','RUNNING','FAILED','WAITING_AUTHORIZATION') AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 1",
          )
        ).rows[0]?.id ?? null,
    );
  }
  async claim(org, id, ttlMs = 900000) {
    const token = randomUUID();
    return this.transaction(org, async (db) => {
      const r = await db.query(
        `UPDATE insights_private.report_jobs SET lease_token=$2,lease_until=now()+($3::bigint*interval '1 millisecond'),version=version+1 WHERE id=$1 AND status NOT IN ('AWAITING_REVIEW','RECONCILIATION_REQUIRED') AND (lease_until IS NULL OR lease_until<now()) RETURNING document,version`,
        [id, token, ttlMs],
      );
      return r.rows[0]
        ? { token, version: Number(r.rows[0].version), job: r.rows[0].document }
        : null;
    });
  }
  async checkpoint(org, id, lease, document) {
    return this.transaction(org, async (db) => {
      const r = await db.query(
        `UPDATE insights_private.report_jobs SET document=$4,status=$5,version=version+1,updated_at=now(),lease_until=now()+interval '15 minutes' WHERE id=$1 AND lease_token=$2 AND version=$3 AND lease_until>now() RETURNING version`,
        [id, lease.token, lease.version, document, document.status],
      );
      requireThat(r.rows.length === 1, "LEASE_LOST");
      lease.version = Number(r.rows[0].version);
      return document;
    });
  }
  async finalize(org, id, lease, j, artifacts) {
    return this.transaction(org, async (db) => {
      const r = await db.query(
        "SELECT version FROM insights_private.report_jobs WHERE id=$1 AND lease_token=$2 AND lease_until>now() FOR UPDATE",
        [id, lease.token],
      );
      requireThat(
        r.rows.length === 1 && Number(r.rows[0].version) === lease.version,
        "LEASE_LOST",
      );
      for (const [kind, value] of Object.entries(artifacts)) {
        const bytes = Buffer.from(value);
        await db.query(
          "INSERT INTO insights_private.report_artifacts(job_id,organisation_id,kind,sha256,bytes) VALUES($1,$2,$3,$4,$5)",
          [id, org, kind, digest(bytes), bytes],
        );
      }
      await db.query(
        "UPDATE insights_private.report_jobs SET document=$2,status=$3,version=version+1,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",
        [id, j, j.status],
      );
      return j;
    });
  }
  async release(org, id, lease) {
    await this.transaction(org, (db) =>
      db.query(
        "UPDATE insights_private.report_jobs SET lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",
        [id, lease.token],
      ),
    );
  }
  async artifact(org, id, kind = "pdf") {
    return this.transaction(
      org,
      async (db) =>
        (
          await db.query(
            "SELECT bytes,sha256 FROM insights_private.report_artifacts WHERE job_id=$1 AND kind=$2",
            [id, kind],
          )
        ).rows[0] ?? null,
    );
  }
}
