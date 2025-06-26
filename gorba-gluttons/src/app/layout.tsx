import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import MobileBlocker from "@/components/MobileBlocker";
import WalletModalEnhancer from "@/components/WalletModalEnhancer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gorba-Gluttons | Feed the Beast, Rule the Heap",
  description: "The ultimate trash game on Gorbagana network. Feed Gorba-Glutton, generate Stink, and become the King of the Heap!",
  keywords: ["Gorbagana", "blockchain", "game", "DeFi", "Web3", "Solana"],
  openGraph: {
    title: "Gorba-Gluttons | Feed the Beast, Rule the Heap",
    description: "The ultimate trash game on Gorbagana network. Feed Gorba-Glutton, generate Stink, and become the King of the Heap!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gorba-Gluttons | Feed the Beast, Rule the Heap",
    description: "The ultimate trash game on Gorbagana network. Feed Gorba-Glutton, generate Stink, and become the King of the Heap!",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
