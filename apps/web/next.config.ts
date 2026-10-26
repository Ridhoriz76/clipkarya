import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clipkarya/core"],
  // Worker-only / Node-only libraries stay external to the server bundle.
  serverExternalPackages: ["bullmq", "ioredis"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
