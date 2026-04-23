/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', '@react-pdf/renderer'],
  },
}
module.exports = nextConfig
