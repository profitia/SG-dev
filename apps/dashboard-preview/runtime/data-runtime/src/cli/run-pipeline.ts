import "../load-local-env.ts";

import { executePipelineRun, formatExecutionPlan } from "../runtime/synchronization-service.ts";

function readFlag(flagName: string): string | null {
  const flag = `--${flagName}`;
  const flagIndex = process.argv.indexOf(flag);

  if (flagIndex === -1) {
    return null;
  }

  return process.argv[flagIndex + 1] ?? null;
}

const source = readFlag("source");
const pipeline = readFlag("pipeline");
const mode = readFlag("mode");

if (!source || !pipeline || !mode) {
  throw new Error('Usage: npm run run:pipeline -- --source market-indexes --pipeline dashboard --mode full');
}

const executionResult = await executePipelineRun({ source, pipeline, mode });

console.log(formatExecutionPlan(executionResult));