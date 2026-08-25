import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type and lint errors fail the build. The previous config suppressed both,
  // which hid 30+ real type errors from the deployed app.

  // A stray package-lock.json in the home directory makes Next infer the wrong
  // workspace root, which changes how build traces are collected.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
