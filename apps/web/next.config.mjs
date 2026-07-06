/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@muso/logic", "@muso/ai", "@muso/pdf"],
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
  webpack: (config) => {
    // supabase-js probes process.version behind a typeof guard; Next's edge
    // analyzer flags any reference. Runtime-safe (Supabase's official Next.js
    // pattern), so silence this one known warning to keep deploy logs clean.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@supabase/, message: /A Node\.js API is used/ },
    ];
    return config;
  },
};

export default nextConfig;
