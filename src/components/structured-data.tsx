import { SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * Site-wide JSON-LD structured data (rendered once in the root layout).
 *
 * Emits a `@graph` with:
 *  - WebSite   → brand + site search intent
 *  - VideoGame → the game itself (free, browser, geography genre) for rich
 *                results and AI answer engines
 *  - Organization → publisher / creator (E-E-A-T signal)
 *
 * JSON-LD only (never Microdata/RDFa). FAQPage is intentionally omitted —
 * Google restricts FAQ rich results to gov/health authority sites.
 */
export function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: ["Atlas Geo", "GeoAtlas"],
        description:
          "Atlas is a free geography guessing game. Drop into a random Street View anywhere on Earth and guess the location on the map.",
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "VideoGame",
        "@id": `${SITE_URL}/#game`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "A free online map guessing game and GeoGuessr alternative. You are dropped into a random street panorama somewhere in the world — read the clues, then drop a pin to guess where you are. Play the world, Europe, the USA, or country mode.",
        image: `${SITE_URL}/opengraph-image`,
        genre: ["Geography game", "Puzzle", "Educational game"],
        keywords:
          "map game, guess the location, geoguessr alternative, geography guessing game, street view game",
        applicationCategory: "GameApplication",
        operatingSystem: "Web browser",
        gamePlatform: ["Web browser", "Desktop", "Mobile"],
        playMode: ["SinglePlayer", "MultiPlayer"],
        inLanguage: "en",
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/opengraph-image`,
        founder: { "@type": "Person", name: "Ludvig Hedin" },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD is static and trusted; stringified server-side.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
