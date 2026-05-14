/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sql.js', 'bcryptjs'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({ 'sql.js': 'commonjs sql.js', bcryptjs: 'commonjs bcryptjs' });
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.hdslb.com' },
      { protocol: 'https', hostname: '**.bilibili.com' },
    ],
  },
};
module.exports = nextConfig;
