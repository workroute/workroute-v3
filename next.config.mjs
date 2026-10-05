/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Short, easy-to-type address for the owner's shareable QR code page.
  async rewrites() {
    return [{ source: "/qr", destination: "/qr.html" }];
  },
  // Old WordPress pages that Google still lists send visitors to the new homepage.
  async redirects() {
    return [{ source: "/elementor-2618", destination: "/", permanent: true }];
  },
  // So phones open the owner's contact card as "Add to contacts".
  async headers() {
    return [
      {
        source: "/steve.vcf",
        headers: [
          { key: "Content-Type", value: "text/vcard; charset=utf-8" },
          { key: "Content-Disposition", value: 'inline; filename="Steve Pfister.vcf"' },
        ],
      },
    ];
  },
};

export default nextConfig;
