import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "product-images.s3.cardmarket.com",
      },
      {
        protocol: "https",
        hostname: "tcgplayer-cdn.tcgplayer.com",
      },
    ],
  },
};

export default nextConfig;
