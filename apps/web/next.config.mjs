/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@muso/logic", "@muso/ai", "@muso/pdf"],
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
