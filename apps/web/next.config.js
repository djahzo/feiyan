/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.hdslb.com' },
      { protocol: 'https', hostname: '**.bilibili.com' },
    ],
  },
};
module.exports = nextConfig;
