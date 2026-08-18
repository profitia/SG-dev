import "../load-local-env.ts";

import { pathToFileURL } from "node:url";

import { PrismaExecutionLifecycleStore } from "../runtime/persistence/execution-lifecycle-store.ts";
import { runRecoverStaleCli, type RecoverStaleCliDependencies } from "./recover-stale-cli.ts";

export async function main(
  args: readonly string[] = process.argv.slice(2),
  dependencies: RecoverStaleCliDependencies = { createStore: () => new PrismaExecutionLifecycleStore() },
): Promise<number> {
  return await runRecoverStaleCli(args, dependencies);
}

if (isInvokedDirectly()) {
  const exitCode = await main();

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

function isInvokedDirectly(): boolean {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
}