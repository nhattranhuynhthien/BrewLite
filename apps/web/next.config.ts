import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: '/images/ca-phe-sua.jpg',
        destination: '/img/menu/ca-phe-sua-da.png',
      },
      {
        source: '/images/americano.jpg',
        destination: '/img/menu/americano.png',
      },
      {
        source: '/images/cappuccino.jpg',
        destination: '/img/menu/cappuccino.png',
      },
      {
        source: '/images/tra-dao.jpg',
        destination: '/img/menu/tra-dao.png',
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
