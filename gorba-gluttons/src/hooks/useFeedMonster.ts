"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getTrashCanPubkey } from "@/lib/solana";
import { WalletError } from "@solana/wallet-adapter-base";

async function awaitSignatureConfirmation(
  connection: ReturnType<typeof useConnection>["connection"],
  signature: string,
  timeout = 30000
) {
  return new Promise<void>((resolve, reject) => {
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("Timeout while confirming transaction"));
    }, timeout);

    const poll = async () => {
      try {
        const { value } = await connection.getSignatureStatuses([signature], {
          searchTransactionHistory: true,
        });
        const status = value?.[0];

        if (!done) {
          if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
            done = true;
            clearTimeout(timer);
            resolve();
            return;
          }
          // continue polling
          setTimeout(poll, 2000);
        }
      } catch (err) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    };

    poll();
  });
}

interface FeedResult {
  signature: string;
  stink: number;
  newScore: number;
  newAchievements?: any[];
  dailyLeft?: number;
  txLeft?: number;
}

export function useFeedMonster() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [pending, setPending] = useState(false);

  const feed = useCallback(
    async (amount: number): Promise<FeedResult | null> => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      // Check balance
      const balance = await connection.getBalance(publicKey);
      const required = (amount + 0.0001) * LAMPORTS_PER_SOL; // amount + fee buffer
      if (balance < required) {
        throw new Error("Insufficient funds");
      }

      try {
        setPending(true);

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: getTrashCanPubkey(),
            lamports: Math.round(amount * LAMPORTS_PER_SOL),
          })
        );

        tx.feePayer = publicKey;

        // Fetch a fresh blockhash & its expiry info for each transaction
        const {
          blockhash,
          lastValidBlockHeight,
        } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;

        if (!sendTransaction) {
          throw new Error("Wallet does not support direct signing");
        }

        const signature = await sendTransaction(tx, connection);

        try {
          await awaitSignatureConfirmation(connection, signature);
        } catch (confirmErr) {
          console.warn("Signature confirmation via polling failed", confirmErr);
        }
        
        // --- NEW: Call our backend to record the feed ---
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const res = await fetch(`${api}/feed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            walletAddress: publicKey.toBase58(),
            transactionSignature: signature,
            amountSol: amount
          })
        });

        if (!res.ok) {
          throw new Error('Failed to record feed on server');
        }

        const data = await res.json();
        
        return { 
          signature, 
          stink: data.stinkEarned, 
          newScore: data.newScore,
          newAchievements: data.newAchievements || [],
          dailyLeft: data.dailyLeft,
          txLeft: data.txLeft
        };
      } catch (e: any) {
        if (e instanceof WalletError) {
          if (e.error.name === "WalletSendTransactionError" || e.error.name === "WalletSignTransactionError") {
            throw new Error("Transaction rejected");
          }
        }
        // Re-throw other errors (like insufficient funds)
        throw e;
      } finally {
        setPending(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { feed, pending };
} 