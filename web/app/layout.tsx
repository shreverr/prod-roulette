import type { Metadata } from "next";
import { Silkscreen, VT323 } from "next/font/google";
import "./globals.css";

const ui = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-ui" });
const mono = VT323({ weight: "400", subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Prod Roulette",
  description: "Buckshot Roulette, but you're gambling with production.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variables must land on :root — globals.css builds its font stacks there.
    <html lang="en" className={`${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
