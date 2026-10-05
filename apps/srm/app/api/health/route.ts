export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "srm", environment: process.env.TARGET_ENVIRONMENT ?? "development" });
}
