#!/usr/bin/env node

import path from "node:path"

import { prepareExecutionHandoff } from "../src/lib/pmos/execution-handoff.ts"

type ParsedArgs = {
  inputPath: string | null
  outputPath?: string
  outputDir?: string
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  const parsed: ParsedArgs = { inputPath: null }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--input") {
      parsed.inputPath = args[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === "--output") {
      parsed.outputPath = args[index + 1] ?? undefined
      index += 1
      continue
    }
    if (arg === "--output-dir") {
      parsed.outputDir = args[index + 1] ?? undefined
      index += 1
    }
  }

  return parsed
}

function main(): void {
  const args = parseArgs()
  if (!args.inputPath) {
    console.error("[pmos-prepare-execution-handoff] ERROR: missing --input <path-to-execution-handoff-json>")
    process.exit(1)
  }

  try {
    const result = prepareExecutionHandoff({
      inputPath: path.resolve(args.inputPath),
      outputPath: args.outputPath,
      outputDir: args.outputDir,
    })
    console.log(`[pmos-prepare-execution-handoff] Prepared bootstrap input for ${result.bootstrapInput.metadata.taskId}`)
    console.log(result.outputPath)
  } catch (error) {
    console.error(`[pmos-prepare-execution-handoff] ERROR: ${(error as Error).message}`)
    process.exit(1)
  }
}

main()