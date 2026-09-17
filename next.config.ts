import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/samples/**/*"],
  },
};

export default nextConfig;
