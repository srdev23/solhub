import { createProxyMiddleware } from 'http-proxy-middleware';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },

  async rewrites() {
    return [
      {
        source: '/api/cors-proxy/:path*',
        destination: 'https://ipfs.io/ipfs/:path*', // Replace with your IPFS endpoint if different
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/api/cors-proxy/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Adjust this to restrict access if necessary
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mock the 'fs' module on the client side
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
