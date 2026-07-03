import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { StructuredData } from "@/components/structured-data";
import { SITE_KEYWORDS, SITE_NAME, SITE_URL, TWITTER_HANDLE } from "@/lib/seo";
import { convexUrl } from "@/lib/env";

// Warm up the connections to third-party origins the game needs moments after
// first paint (Street View panoramas, the Convex realtime socket) so their
// DNS+TLS handshake isn't on the critical path when a round actually loads —
// most noticeable on slow/high-latency connections.
const CONVEX_ORIGIN = convexUrl ? new URL(convexUrl).origin : null;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE_DEFAULT = "Atlas — Free Geography Guessing Game";
const DESCRIPTION =
  "Play Atlas, a free online map guessing game and GeoGuessr alternative. You're dropped into a random Street View anywhere on Earth — read the clues and guess the location by dropping a pin on the map.";

export const metadata: Metadata = {
  title: {
    default: TITLE_DEFAULT,
    template: "%s · Atlas",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: "Ludvig Hedin" }],
  creator: "Ludvig Hedin",
  publisher: SITE_NAME,
  category: "games",
  metadataBase: new URL(SITE_URL),
  // No `alternates` here: metadata is inherited by pages that don't define it,
  // so a root canonical of "/" would make every noindex page (profile, rooms,
  // replays…) canonicalize to the homepage. The home canonical lives in page.tsx.
  openGraph: {
    title: TITLE_DEFAULT,
    description:
      "A free geography guessing game — dropped into a random Street View, guess where you are on the map.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE_DEFAULT,
    description:
      "A free geography guessing game and GeoGuessr alternative. Guess the location from Street View.",
    creator: TWITTER_HANDLE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Sets the theme class on <html> before first paint so there is no light/dark
 * flash. Reads the same localStorage key the PreferencesProvider owns; falls
 * back to the OS preference for "system" and to dark on any error.
 */
const NO_FLASH_THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('atlas:prefs:v1');var t=s?JSON.parse(s).theme:null;if(t!=='light'&&t!=='dark'&&t!=='system')t='system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){var el=document.documentElement;el.classList.add('dark');el.style.colorScheme='dark';}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        {CONVEX_ORIGIN && <link rel="preconnect" href={CONVEX_ORIGIN} />}
      </head>
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <StructuredData />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
