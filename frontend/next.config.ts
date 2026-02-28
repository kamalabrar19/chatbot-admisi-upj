import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SITE_NAME: "Admisi UPJ Assistant",
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-UA-Compatible", value: "IE=edge" },
      ],
    },
  ],
};

export default nextConfig;
