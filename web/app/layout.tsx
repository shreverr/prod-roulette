import type { Metadata } from "next";
import { Silkscreen, VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const ui = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-ui" });
const mono = VT323({ weight: "400", subsets: ["latin"], variable: "--font-mono" });

const description = "Buckshot Roulette, but you're gambling with production.";

export const metadata: Metadata = {
  // Absolute URLs for the card. Set NEXT_PUBLIC_SITE_URL wherever this is deployed.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "Prod Roulette",
  description,
  openGraph: {
    type: "website",
    siteName: "Prod Roulette",
    title: "Prod Roulette",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Prod Roulette",
    description,
    creator: "@Shreverrr",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variables must land on :root — globals.css builds its font stacks there.
    <html lang="en" className={`${ui.variable} ${mono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
