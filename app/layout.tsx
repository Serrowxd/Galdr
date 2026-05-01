import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import { JetBrains_Mono } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { UsernameOnboardingModal } from "@/components/UsernameOnboardingModal";
import "./globals.css";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "800"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Galdr | Agent Instruction Registry",
  description:
    "A brutalist registry for Markdown-based AI agent instruction staves.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider ui={ui}>
      <html lang="en">
        <body className={jetBrainsMono.variable}>
          <NavBar />
          <UsernameOnboardingModal />
          <main className="app-shell">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
