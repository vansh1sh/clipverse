import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Ensure this app is the Turbopack root (avoids wrong root when parent dir has a lockfile)
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
