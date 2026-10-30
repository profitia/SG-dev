import fs from "node:fs";
import { execFileSync } from "node:child_process";
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain", "--", "apps/package-limits"], {
    cwd: "../..",
    encoding: "utf8",
  }).trim() !== "";
if (
  process.env.RENDER &&
  (!/^[a-f0-9]{40}$/.test(process.env.LIMITS_EXPECTED_SOURCE_SHA ?? "") ||
    sha !== process.env.LIMITS_EXPECTED_SOURCE_SHA ||
    dirty)
)
  throw Error("EXACT_CLEAN_ACCEPTED_SOURCE_REQUIRED");
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc"], {
  stdio: "inherit",
});
fs.copyFileSync("src/styles.css", "dist/styles.css");
fs.writeFileSync("dist/source.json", JSON.stringify({ sha, dirty }));
console.log(
  "Package Limits executable and browser assets built; no database or provider call.",
);

const { limitsDigest, identityDigest, dashboardDigest } = await import(
  "./install.mjs"
);
fs.writeFileSync(
  "dist/schema.json",
  JSON.stringify({ limitsDigest, identityDigest, dashboardDigest }),
);
