import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * /sitemap.xml — canonical, indexable public routes only.
 *
 * Deliberately excludes query-param variants (e.g. /play?map=world), private
 * routes, and dynamic per-user pages; those either canonicalize to a listed URL
 * or are noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/play`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/maps`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];
}
