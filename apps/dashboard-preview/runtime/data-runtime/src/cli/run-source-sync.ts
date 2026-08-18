import "../load-local-env.ts";

import { executeSourceSync, formatExecutionPlan } from "../runtime/synchronization-service.ts";

function readFlag(flagName: string): string | null {
  const flag = `--${flagName}`;
  const flagIndex = process.argv.indexOf(flag);

  if (flagIndex === -1) {
    return null;
  }

  return process.argv[flagIndex + 1] ?? null;
}

const source = readFlag("source");
const mode = readFlag("mode");

if (!source || !mode) {
  throw new Error('Usage: npm run run:source-sync -- --source market-indexes --mode full');
}

const executionResult = await executeSourceSync({ source, mode });

console.log(formatExecutionPlan(executionResult));