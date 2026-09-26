import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'shouldve-walked.vercel.app' }],
        destination: 'https://justwalk.fareeha.sh/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
