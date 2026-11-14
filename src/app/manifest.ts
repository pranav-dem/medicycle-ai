
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MediCycle - Medicine Management",
    short_name: "MediCycle",
    description: "Manage medicines, reminders and safe disposal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0fdf4",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/medicycle.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
