import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/', 
        destination: '/mainpage', 
        permanent: false, // <-- UBAH JADI FALSE
      },
    ];
  },
};

export default nextConfig;