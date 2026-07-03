import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

/**
 * Web app manifest — installability + richer mobile search presence.
 *
 * Icons currently reuse favicon.ico. TODO: add 192px/512px maskable PNGs for a
 * full PWA install prompt (see BACKLOG).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Geography Guessing Game`,
    short_name: SITE_NAME,
    description:
      "A free geography guessing game. Drop into a random Street View and guess the location on the map.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    categories: ["games", "education", "entertainment"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
