/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Short, easy-to-type address for the owner's shareable QR code page.
  async rewrites() {
    return [{ source: "/qr", destination: "/qr.html" }];
  },
};

export default nextConfig;
