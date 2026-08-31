import type { NextConfig } from 'next';

function apiUploadRemotePattern() {
  try {
    const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
    return {
      protocol: apiUrl.protocol.replace(':', '') as 'http' | 'https',
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      pathname: '/uploads/**'
    };
  } catch {
    return undefined;
  }
}

const uploadRemotePattern = apiUploadRemotePattern();

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      ...(uploadRemotePattern ? [uploadRemotePattern] : []),
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/uploads/**'
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '4000',
        pathname: '/uploads/**'
      }
    ]
  }
};

export default nextConfig;
