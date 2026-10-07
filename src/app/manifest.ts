import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DevMint",
    short_name: "DevMint",
    description: "Research, plan, build, staff and grow Roblox games.",
    start_url: "/home",
    display: "standalone",
    background_color: "#09090a",
    theme_color: "#09090a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
