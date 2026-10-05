import pg, { type PoolClient } from "pg";

export type DatabasePool = Pick<pg.Pool, "connect">;
let sharedPool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  const connectionString = process.env.SRM_APP_DATABASE_URL;
  if (!connectionString) throw new Error("SRM_APP_DATABASE_URL is required");
  sharedPool ??= new pg.Pool({ connectionString, max: 8 });
  return sharedPool;
}

export function assertOrganizationId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("A valid organization UUID is required");
  }
}

export async function withOrganization<T>(
  organizationId: string,
  action: (client: PoolClient) => Promise<T>,
  pool: DatabasePool = getPool(),
): Promise<T> {
  assertOrganizationId(organizationId);
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;
    const identity = await client.query<{
      database_name: string;
      bypass_rls: boolean;
      superuser: boolean;
      neon_superuser_member: boolean;
    }>(
      "SELECT current_database() AS database_name, r.rolbypassrls AS bypass_rls, " +
      "r.rolsuper AS superuser, pg_has_role(current_user, 'neon_superuser', 'member') AS neon_superuser_member " +
      "FROM pg_roles r WHERE r.rolname = current_user",
    );
    const role = identity.rows[0];
    if (role?.database_name !== "srm_app") throw new Error("SRM product database identity mismatch");
    if (role.bypass_rls || role.superuser || role.neon_superuser_member) {
      throw new Error("SRM application role must enforce row-level security");
    }
    await client.query("SELECT set_config('srm.organization_id', $1, true)", [organizationId]);
    const result = await action(client);
    await client.query("COMMIT");
    inTransaction = false;
    return result;
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
