"use client"

import { ReactNode, useMemo } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack"

interface Props {
  children: ReactNode
}

export default function WalletContextProvider({ children }: Props) {
  // RPC endpoint (Gorbagana)
  const endpoint = process.env.NEXT_PUBLIC_GORBAGANA_RPC_URL || "https://gorchain.wstf.io"

  // Initialise wallet list (only Backpack for now)
  const wallets = useMemo(() => [new BackpackWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
} 