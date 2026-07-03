import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { StructuredData } from "@/components/structured-data";
import { SITE_KEYWORDS, SITE_NAME, SITE_URL, TWITTER_HANDLE } from "@/lib/seo";

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
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
};

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
      <body className="min-h-full">
        <StructuredData />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
