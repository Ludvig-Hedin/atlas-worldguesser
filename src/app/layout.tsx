import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Atlas — Guess the World",
    template: "%s · Atlas",
  },
  description:
    "A fast, beautiful geography guessing game. Drop into a random street, read the clues, and pin your guess on the map.",
  applicationName: "Atlas",
  authors: [{ name: "Ludvig Hedin" }],
  metadataBase: new URL("https://geoatlas.xyz"),
  openGraph: {
    title: "Atlas — Guess the World",
    description: "Drop into a random street and guess where you are.",
    url: "https://geoatlas.xyz",
    siteName: "Atlas",
    type: "website",
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
