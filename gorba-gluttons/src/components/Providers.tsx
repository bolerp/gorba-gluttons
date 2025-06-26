"use client";

import dynamic from "next/dynamic";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import React from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider = dynamic(() => import("@/components/WalletContextProvider"), {
  ssr: false,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletContextProvider>
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletContextProvider>
  );
} 