/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app uses plain <img> tags, never next/image. Disabling the built-in
  // optimizer makes /_next/image return 404, closing the image optimizer
  // advisories that are only patched in Next 15.5.24+.
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', '@react-pdf/renderer'],
  },
}
module.exports = nextConfig
