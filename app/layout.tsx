import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/NavBar";
import { UsernameOnboardingModal } from "@/components/UsernameOnboardingModal";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-app",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-app",
});

export const metadata: Metadata = {
  title: "Galdr — Open agent registry",
  description:
    "Skills for your agents. Built by the community. Download staves — markdown skill bundles for Claude, Codex, and any agent that reads instructions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e1e1e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetBrainsMono.variable}`}>
        <NavBar />
        <UsernameOnboardingModal />
        <main className="app-shell">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
