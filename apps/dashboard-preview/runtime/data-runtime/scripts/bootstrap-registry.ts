import "../src/load-local-env.ts";

import {
  PrismaRegistryBootstrapStore,
  createRegistryBootstrapTargetIdentityVerifier,
  executeRegistryBootstrap,
  formatRegistryBootstrapFailure,
  formatRegistryBootstrapSummary,
  parseRegistryBootstrapMode,
  resolveRegistryBootstrapEnvironment,
} from "../src/runtime/registry-bootstrap.ts";

async function main(): Promise<void> {
  const environment = resolveRegistryBootstrapEnvironment();
  const mode = parseRegistryBootstrapMode();
  const store = new PrismaRegistryBootstrapStore(environment.databaseUrl ?? "");
  const summary = await executeRegistryBootstrap(
    { environment, mode },
    store,
    { targetIdentityVerifier: createRegistryBootstrapTargetIdentityVerifier(environment) },
  );

  console.log(formatRegistryBootstrapSummary(summary));
}

main().catch((error) => {
  console.error(formatRegistryBootstrapFailure(error));
  process.exit(1);
});