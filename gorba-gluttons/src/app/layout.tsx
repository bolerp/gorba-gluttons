import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import MobileBlocker from "@/components/MobileBlocker";
import WalletModalEnhancer from "@/components/WalletModalEnhancer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gorba-Gluttons | Feed the Beast, Rule the Heap",
  description: "Interactive trash feeding game on Gorbagana testnet. Feed Gorba-Glutton, generate Stink points, climb leaderboards and unlock achievements!",
  keywords: ["Gorbagana", "blockchain", "game", "interactive", "feeding", "testnet", "Web3", "Solana", "achievements"],
  metadataBase: new URL('https://gorba.xyz'),
  openGraph: {
    title: "Gorba-Gluttons | Feed the Beast, Rule the Heap",
    description: "Interactive trash feeding game on Gorbagana testnet. Feed Gorba-Glutton, generate Stink points, climb leaderboards and unlock achievements!",
    type: "website",
    url: "https://gorba.xyz",
    siteName: "Gorba-Gluttons",
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "Gorba-Gluttons - Feed the Beast, Rule the Heap",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@gorbaxyz",
    creator: "@gorbaxyz",
    title: "Gorba-Gluttons | Feed the Beast, Rule the Heap",
    description: "Interactive trash feeding game on Gorbagana testnet. Feed Gorba-Glutton, generate Stink points, climb leaderboards!",
    images: ["/banner.png"],
  },
  icons: {
    icon: "/favicon/favicon.ico",
    shortcut: "/favicon/favicon-96x96.png",
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} gradient-bg min-h-screen`}>
        <Providers>
          <WalletModalEnhancer />
          <div className="hidden md:block">{children}</div>
          <div className="block md:hidden">
            <MobileBlocker />
          </div>
        </Providers>
      </body>
    </html>
  );
}
