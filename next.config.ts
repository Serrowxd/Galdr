import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.githubusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "*.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "secure.gravatar.com", pathname: "/**" },
      { protocol: "https", hostname: "*.gravatar.com", pathname: "/**" },
      { protocol: "https", hostname: "*.gitlab.com", pathname: "/**" },
      { protocol: "https", hostname: "gitlab.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
