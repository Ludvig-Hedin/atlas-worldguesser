import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * /robots.txt — allow crawling of public marketing/play routes, keep private
 * and dynamic app routes (rooms, replays, profiles, in-game views) out of the
 * index to avoid thin/duplicate content and wasted crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/room/",
          "/replay/",
          "/friends",
          "/profile/",
          "/maps/new",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
