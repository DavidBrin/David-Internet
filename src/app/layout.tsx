import type { Metadata, Viewport } from "next";
import "./globals.css";

/** Inline SVG favicon — no binary asset, no extra network request. */
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="7" fill="#4285F4"/>' +
  '<text x="16" y="23.5" font-family="Arial, Helvetica, sans-serif" font-size="22" ' +
  'font-weight="bold" fill="#ffffff" text-anchor="middle">D</text>' +
  "</svg>";

const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;

export const metadata: Metadata = {
  title: "David's Internet",
  description:
    "A search engine for a very small internet — the projects, replicas and experiments David has built.",
  icons: {
    icon: [{ url: FAVICON_DATA_URI, type: "image/svg+xml" }],
    shortcut: [{ url: FAVICON_DATA_URI, type: "image/svg+xml" }],
    apple: [{ url: FAVICON_DATA_URI, type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
