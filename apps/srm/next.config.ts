import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@profitia/srm-xray"],
  output: "standalone",
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/api/xray/kys/pdf": ["./src/server/assets/*.ttf"] },
};

export default nextConfig;
