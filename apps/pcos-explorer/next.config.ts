import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Transpile @sg/pcos-contracts (local monorepo package, no npm publish)
  transpilePackages: ["@sg/pcos-contracts"],
};

export default nextConfig;
