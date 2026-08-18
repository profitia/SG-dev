import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadLocalEnv } from "./load-local-env.ts";

test("explicit shell environment is not overridden by local env file", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "sg-data-runtime-env-"));
  const envPath = join(tmpDir, ".env.local");
  const originalValue = process.env["DATA_RUNTIME_NEON_API_KEY"];
  const originalOrg = process.env["DATA_RUNTIME_ORGANIZATION_ID"];

  process.env["DATA_RUNTIME_NEON_API_KEY"] = "shell-token";
  process.env["DATA_RUNTIME_ORGANIZATION_ID"] = "shell-org";
  await writeFile(envPath, "DATA_RUNTIME_NEON_API_KEY=file-token\nDATA_RUNTIME_ORGANIZATION_ID=file-org\n", "utf8");

  try {
    loadLocalEnv(envPath);
    assert.equal(process.env["DATA_RUNTIME_NEON_API_KEY"], "shell-token");
    assert.equal(process.env["DATA_RUNTIME_ORGANIZATION_ID"], "shell-org");
  } finally {
    if (originalValue === undefined) {
      delete process.env["DATA_RUNTIME_NEON_API_KEY"];
    } else {
      process.env["DATA_RUNTIME_NEON_API_KEY"] = originalValue;
    }

    if (originalOrg === undefined) {
      delete process.env["DATA_RUNTIME_ORGANIZATION_ID"];
    } else {
      process.env["DATA_RUNTIME_ORGANIZATION_ID"] = originalOrg;
    }

    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("local env file populates values only when shell env is absent", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "sg-data-runtime-env-"));
  const envPath = join(tmpDir, ".env.local");
  const originalValue = process.env["DATA_RUNTIME_NEON_API_KEY"];

  delete process.env["DATA_RUNTIME_NEON_API_KEY"];
  await writeFile(envPath, "DATA_RUNTIME_NEON_API_KEY=file-token\n", "utf8");

  try {
    loadLocalEnv(envPath);
    assert.equal(process.env["DATA_RUNTIME_NEON_API_KEY"], "file-token");
  } finally {
    if (originalValue === undefined) {
      delete process.env["DATA_RUNTIME_NEON_API_KEY"];
    } else {
      process.env["DATA_RUNTIME_NEON_API_KEY"] = originalValue;
    }

    await rm(tmpDir, { recursive: true, force: true });
  }
});