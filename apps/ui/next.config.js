/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.API_URL || 'http://api.saasobserve-system.svc.cluster.local:8080'}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
