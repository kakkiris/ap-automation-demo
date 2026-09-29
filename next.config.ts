import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep CLAUDE.md ours; next dev would otherwise append a generated block.
  agentRules: false,
};

export default nextConfig;
