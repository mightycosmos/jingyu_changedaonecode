import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  experimental: {
    turbo: {},
    // Increase max request body size for client -> route handlers (e.g. audio uploads)
    // Default is 10MB, which breaks larger recordings.
    middlewareClientMaxBodySize: "100mb",
  },
};

export default nextConfig;

