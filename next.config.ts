import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "firebase-admin": "firebase-admin",
    },
  },
};

export default nextConfig;