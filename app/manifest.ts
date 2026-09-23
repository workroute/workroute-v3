import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkRoute",
    short_name: "WorkRoute",
    description: "Job capture and run sheet for tradies — log the job before you forget it.",
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
