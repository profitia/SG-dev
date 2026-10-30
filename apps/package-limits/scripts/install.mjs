import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { capabilities, metrics } from "../dist/catalog.js";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const l = fs.readFileSync(
    new URL("../migrations/001-limits.sql", import.meta.url),
    "utf8",
  ),
  i = fs.readFileSync(
    new URL("../migrations/002-identity-read.sql", import.meta.url),
    "utf8",
  );
const dashboardSource = fs.readFileSync(
  new URL("../migrations/003-dashboard-summary.sql", import.meta.url),
  "utf8",
);
export const dashboardDigest = hash(dashboardSource);
export const dashboardSql = dashboardSource.replaceAll(
  "__DASHBOARD_SCHEMA_DIGEST__",
  dashboardDigest,
);
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
export const seedSql =
  capabilities
    .map(
      ([id, name, description, products]) =>
        "INSERT INTO profitia_limits.capabilities VALUES(" +
        [
          quote(id),
          quote(name),
          quote(description),
          "ARRAY[" + products.map(quote).join(",") + "]",
        ].join(",") +
        ");",
    )
    .join("\n") +
  "\n" +
  metrics
    .map(
      ([id, name, unit, source, capability, description]) =>
        "INSERT INTO profitia_limits.metrics VALUES(" +
        [id, name, unit, description, source, capability].map(quote).join(",") +
        ");",
    )
    .join("\n");
export const limitsDigest = hash(l + "\n" + seedSql),
  identityDigest = hash(i);
export const limitsSql = l.replaceAll("__LIMITS_SCHEMA_DIGEST__", limitsDigest);
export const identitySql = i.replaceAll(
  "__IDENTITY_SCHEMA_DIGEST__",
  identityDigest,
);
// Neon control-plane role creation grants administrative neon_superuser rights.
// Create these ordinary logins with SQL; passwords are supplied privately later.
export const limitsLoginRolesSql = `CREATE ROLE profitia_limits_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE profitia_limits_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;`;
export const identityLoginRoleSql = `CREATE ROLE profitia_limits_identity_reader LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;`;
export const rolesSql = String.raw`DO $guard$ BEGIN
 IF current_database()<>'neondb' OR session_user IN('profitia_limits_runtime','profitia_limits_migrator') THEN RAISE EXCEPTION 'CONTROLLED_ADMIN_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='profitia_limits') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='profitia_limits_owner') THEN RAISE EXCEPTION 'EXISTING_INSTALLATION_REQUIRES_VERIFIED_REPLAY';END IF;
END $guard$;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE ROLE profitia_limits_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
DO $r$ BEGIN IF (SELECT count(*) FROM pg_roles WHERE rolname IN('profitia_limits_runtime','profitia_limits_migrator') AND rolcanlogin AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolinherit))<>2 OR EXISTS(SELECT 1 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE r.rolname IN('profitia_limits_runtime','profitia_limits_migrator')) THEN RAISE EXCEPTION 'SQL_CREATED_ORDINARY_LOGIN_REQUIRED';END IF; END $r$;
GRANT profitia_limits_owner TO profitia_limits_migrator;
GRANT CONNECT ON DATABASE neondb TO profitia_limits_runtime,profitia_limits_migrator;
GRANT CREATE ON DATABASE neondb TO profitia_limits_owner;`;
export const identityPrefix = String.raw`DO $guard$ BEGIN
 IF current_database()<>'platform_private' OR session_user='profitia_limits_identity_reader' OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='profitia_limits_identity_read') THEN RAISE EXCEPTION 'EXACT_EMPTY_ADAPTER_REQUIRED';END IF;
END $guard$;
DO $r$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='profitia_limits_identity_reader' AND rolcanlogin AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolinherit)) OR EXISTS(SELECT 1 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE r.rolname='profitia_limits_identity_reader') THEN RAISE EXCEPTION 'SQL_CREATED_ORDINARY_READER_REQUIRED';END IF; END $r$;
GRANT CONNECT ON DATABASE platform_private TO profitia_limits_identity_reader;
CREATE SCHEMA profitia_limits_identity_read AUTHORIZATION profitia_access_owner;
SET LOCAL ROLE profitia_access_owner;`;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--verify") {
    const which = process.argv[3];
    if (process.argv[4] !== "--snapshot" || !process.argv[5])
      throw Error("READ_ONLY_SNAPSHOT_REQUIRED");
    console.log(
      JSON.stringify(
        verifyInstallation(
          JSON.parse(fs.readFileSync(process.argv[5], "utf8")),
          which,
        ),
      ),
    );
  } else if (process.argv[2] === "--verification-sql")
    console.log(verificationSql(process.argv[3]));
  else
    console.log(
      JSON.stringify(
        {
          mode: "REVIEWED_PLAN_ONLY_NO_CONNECTION",
          limitsDigest,
          identityDigest,
          dashboardDigest,
          limits: {
            loginRolesSql: limitsLoginRolesSql,
            rolesSql,
            migrationSql:
              "SET LOCAL ROLE profitia_limits_owner;\n" +
              limitsSql +
              "\n" +
              seedSql +
              "\n" +
              dashboardSql,
            dashboardMigrationSql:
              "SET LOCAL ROLE profitia_limits_owner;\n" + dashboardSql,
            postInstallSql:
              "REVOKE CREATE ON DATABASE neondb FROM profitia_limits_owner;",
            verificationSql: verificationSql("limits"),
          },
          identity: {
            loginRoleSql: identityLoginRoleSql,
            migrationSql: identityPrefix + "\n" + identitySql,
            verificationSql: verificationSql("identity"),
          },
          replay:
            "Verify source functions, receipt, owner, FORCE RLS, ordinary role, memberships and ACLs. ALREADY_INSTALLED_VERIFIED_SKIP performs no mutation. A mismatch stops; no DROP/reset/key rotation.",
        },
        null,
        2,
      ),
    );
}

export function expectedFunctions(which) {
  const sql =
    which === "limits"
      ? limitsSql + "\n" + dashboardSql
      : which === "identity"
        ? identitySql
        : null;
  if (!sql) throw Error("UNKNOWN_INSTALLATION");
  const result = [];
  for (const m of sql.matchAll(
    /CREATE FUNCTION\s+([a-z_]+)\(([^)]*)\)([\s\S]*?)AS \$fn\$([\s\S]*?)\$fn\$;/g,
  )) {
    const args = m[2].trim()
      ? m[2]
          .split(",")
          .map((x) =>
            x
              .trim()
              .split(/\s+/)
              .slice(1)
              .join(" ")
              .replaceAll("timestamptz", "timestamp with time zone"),
          )
      : [];
    const search = /SET search_path=([a-z_,]+)\s*$/.exec(m[3].trim());
    if (!search) throw Error("FUNCTION_SEARCH_PATH_REQUIRED");
    result.push({
      name: m[1],
      args,
      body: m[4],
      securityDefiner: /SECURITY DEFINER/.test(m[3]),
      searchPath: "search_path=" + search[1].split(",").join(", "),
    });
  }
  if (
    !result.length ||
    new Set(result.map((x) => x.name)).size !== result.length
  )
    throw Error("CLOSED_FUNCTION_LAYOUT_REQUIRED");
  return result;
}
export function verificationSql(which) {
  if (!["limits", "identity"].includes(which))
    throw Error("UNKNOWN_INSTALLATION");
  const schema =
      which === "limits" ? "profitia_limits" : "profitia_limits_identity_read",
    runtime =
      which === "limits"
        ? "profitia_limits_runtime"
        : "profitia_limits_identity_reader",
    owner =
      which === "limits" ? "profitia_limits_owner" : "profitia_access_owner";
  return (
    "SELECT jsonb_build_object(" +
    (which === "limits"
      ? "'dashboardDigest',(SELECT schema_digest FROM profitia_limits.dashboard_installation WHERE singleton),"
      : "") +
    "'schemaDigest',(SELECT schema_digest FROM " +
    schema +
    ".installation WHERE singleton),'schemaOwner',(SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='" +
    schema +
    "'),'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',coalesce((SELECT jsonb_agg(format_type(t,NULL)) FROM unnest(p.proargtypes) t),'[]'::jsonb),'body',p.prosrc,'securityDefiner',p.prosecdef,'searchPath',p.proconfig[1],'owner',pg_get_userbyid(p.proowner))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='" +
    schema +
    "'),'allTablesForceRls',(SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='" +
    owner +
    "') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='" +
    schema +
    "' AND c.relkind='r'),'runtimeTableAccess',(SELECT coalesce(bool_or(has_table_privilege('" +
    runtime +
    "',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),false) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='" +
    schema +
    "' AND c.relkind='r'),'schemaCreate',has_schema_privilege('" +
    runtime +
    "','" +
    schema +
    "','CREATE'),'ordinaryRole',(SELECT rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit) FROM pg_roles WHERE rolname='" +
    runtime +
    "'),'memberships',(SELECT count(*) FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.member WHERE r.rolname='" +
    runtime +
    "'),'runtimeFunctions',(SELECT jsonb_agg(p.proname ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='" +
    schema +
    "' AND has_function_privilege('" +
    runtime +
    "',p.oid,'EXECUTE')),'publicExecute',(SELECT coalesce(bool_or(a.grantee=0 AND a.privilege_type='EXECUTE'),false) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='" +
    schema +
    "')) AS snapshot"
  );
}
export function verifyInstallation(snapshot, which) {
  if (snapshot === null) return { action: "INITIALIZE_EMPTY_NAMESPACE" };
  const expected = expectedFunctions(which),
    owner =
      which === "limits" ? "profitia_limits_owner" : "profitia_access_owner",
    digest = which === "limits" ? limitsDigest : identityDigest;
  const allowed =
    which === "limits"
      ? ["api", "dashboard", "dashboard_health", "health"]
      : ["binding", "descriptor", "lock_organisation", "organisations"];
  if (
    snapshot.schemaDigest !== digest ||
    (which === "limits" && snapshot.dashboardDigest !== dashboardDigest) ||
    snapshot.schemaOwner !== owner ||
    snapshot.allTablesForceRls !== true ||
    snapshot.runtimeTableAccess !== false ||
    snapshot.schemaCreate !== false ||
    snapshot.ordinaryRole !== true ||
    Number(snapshot.memberships) !== 0 ||
    snapshot.publicExecute !== false ||
    JSON.stringify(snapshot.runtimeFunctions) !== JSON.stringify(allowed) ||
    snapshot.functions?.length !== expected.length
  )
    throw Error("INSTALLATION_CONFLICT_NO_MUTATION");
  for (const e of expected) {
    const a = snapshot.functions.find((x) => x.name === e.name);
    if (
      !a ||
      a.owner !== owner ||
      a.body !== e.body ||
      a.securityDefiner !== e.securityDefiner ||
      a.searchPath !== e.searchPath ||
      JSON.stringify(a.args) !== JSON.stringify(e.args)
    )
      throw Error("INSTALLED_FUNCTION_CONFLICT_NO_MUTATION");
  }
  return { action: "ALREADY_INSTALLED_VERIFIED_SKIP", schemaDigest: digest };
}
