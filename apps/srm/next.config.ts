import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@profitia/srm-xray"],
  output: "standalone",
};

export default nextConfig;
