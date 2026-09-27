/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Short, easy-to-type address for the owner's shareable QR code page.
  async rewrites() {
    return [{ source: "/qr", destination: "/qr.html" }];
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
