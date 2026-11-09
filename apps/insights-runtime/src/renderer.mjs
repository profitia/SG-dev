import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  digest,
  requireThat,
} from "../../../packages/insights-contracts/index.mjs";
export function createRenderer({ python = "python3" } = {}) {
  return async (job, bundle, composed, gate) => {
    const root = new URL("../render/", import.meta.url),
      fonts = new URL("fonts/", root),
      manifest = JSON.parse(
        await readFile(new URL("manifest.json", fonts), "utf8"),
      );
    for (const [n, h] of Object.entries(manifest))
      requireThat(
        digest(await readFile(new URL(n, fonts))) === h,
        "RENDER_FONT_INTEGRITY",
      );
    const dir = await mkdtemp(join(tmpdir(), "insights-render-"));
    try {
      for (const [n, v] of Object.entries({
        bundle,
        narrative: composed.narrative,
        receipt: composed,
      }))
        await writeFile(join(dir, n + ".json"), JSON.stringify(v), {
          mode: 0o600,
        });
      const args = [
        fileURLToPath(new URL("report.py", root)),
        "--bundle",
        join(dir, "bundle.json"),
        "--narrative",
        join(dir, "narrative.json"),
        "--receipt",
        join(dir, "receipt.json"),
        "--output",
        join(dir, "output"),
        "--font",
        fileURLToPath(new URL("DejaVuSans.ttf", fonts)),
        "--bold",
        fileURLToPath(new URL("DejaVuSans-Bold.ttf", fonts)),
      ];
      await new Promise((resolve, reject) => {
        const c = spawn(python, args, {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, PYTHONHASHSEED: "0", TZ: "UTC" },
          signal: AbortSignal.timeout(60000),
        });
        let size = 0;
        c.stdout.on("data", (v) => {
          size += v.length;
          if (size > 65536) c.kill();
        });
        c.stderr.on("data", () => {});
        c.on("error", reject);
        c.on("exit", (code) =>
          code === 0
            ? resolve()
            : reject(
                Object.assign(Error("PDF_RENDER_FAILED"), {
                  code: "PDF_RENDER_FAILED",
                }),
              ),
        );
      });
      const d = join(dir, "output"),
        names = await readdir(d),
        pdf = await readFile(
          join(
            d,
            names.find((n) => n.endsWith(".pdf")),
          ),
        ),
        markdown = await readFile(
          join(
            d,
            names.find((n) => n.endsWith(".md") && !n.startsWith("ANEKS")),
          ),
        ),
        appendix = await readFile(join(d, "ANEKS_DANYCH_FORECAST_I_ZRODEL.md")),
        metadata = JSON.parse(
          await readFile(join(d, "RENDER_VALIDATION.json"), "utf8"),
        );
      requireThat(
        pdf.subarray(0, 5).toString() === "%PDF-" &&
          metadata.pages === 4 &&
          metadata.pdfSha256 === digest(pdf),
        "PDF_VALIDATION_FAILED",
      );
      return {
        artifacts: { pdf, markdown, appendix },
        metadata: {
          ...metadata,
          fontManifest: manifest,
          qualityStatus: gate.status,
          humanReviewRequired: true,
        },
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
