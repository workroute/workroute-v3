import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkRoute",
    short_name: "WorkRoute",
    description: "AI receptionist, diary and run sheet for tradies and local services.",
    start_url: "/app",
    scope: "/app",
    display: "standalone",
    background_color: "#021f59",
    theme_color: "#021f59",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
