import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "should i have walked.",
  description: "find out what you missed by taking a waymo instead of walking — a guilt trip for sf robotaxi riders",
  openGraph: {
    title: "should i have walked.",
    description: "find out what you missed by taking a waymo instead of walking",
    type: "website",
    locale: "en_US",
    siteName: "should i have walked.",
  },
  twitter: {
    card: "summary_large_image",
    title: "should i have walked.",
    description: "find out what you missed by taking a waymo instead of walking",
    creator: "@fareehasala",
  },
  metadataBase: new URL("https://shouldihavewalked.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
