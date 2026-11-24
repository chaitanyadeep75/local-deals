import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    // All images are already-hosted deal photos from Supabase storage — skip
    // Next's server-side re-fetch/resize step (which breaks on networks doing
    // TLS interception, e.g. corporate proxies) and serve them directly.
    unoptimized: true,
  },
};

export default nextConfig;
