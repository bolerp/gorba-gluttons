"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";

interface RefundInfo {
  available: boolean;
  yesterdayVolume: number;
  potentialRefund: number;
  reason: string;
  lastRequestDate?: string;
  lastRequestStatus?: string;
  lastRequestAmount?: number;
}

interface RefundState extends RefundInfo {
  loading: boolean;
  error: string | null;
  requestSuccess: boolean;
}

export default function useRefund(wallet?: string) {
  const [state, setState] = useState<RefundState>({
    available: false,
    yesterdayVolume: 0,
    potentialRefund: 0,
    reason: "",
    loading: false,
    error: null,
    requestSuccess: false
  });

  const { wallet: wa } = useWallet();

  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${api}/refund-available/${wallet}`);
      
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({
          ...prev,
          available: data.available,
          yesterdayVolume: data.yesterdayVolume || 0,
          potentialRefund: data.potentialRefund || 0,
          reason: data.reason || "",
          lastRequestDate: data.lastRequestDate,
          lastRequestStatus: data.lastRequestStatus,
          lastRequestAmount: data.lastRequestAmount,
          loading: false
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: "Failed to check refund availability" 
        }));
      }
    } catch (e) {
      console.error("refund availability error", e);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Network error" 
      }));
    }
  }, [wallet]);

  const requestRefund = useCallback(async () => {
    if (!wallet) return false;
    const signer = wa?.adapter as unknown as MessageSignerWalletAdapter | undefined;
    if (!signer?.signMessage) {
      setState(prev => ({ ...prev, error: "Wallet doesn't support message signing" }));
      return false;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Создаем сообщение для подписи
      const today = new Date().toISOString().split('T')[0];
      const message = `REQUEST_REFUND_${today}`;
      const messageBytes = new TextEncoder().encode(message);
      
      // Получаем подпись
      const signature = await signer.signMessage(messageBytes);
      const signatureB64 = Buffer.from(signature).toString("base64");

      const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${api}/request-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          walletAddress: wallet, 
          signature: signatureB64 
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            requestSuccess: true,
            available: false, // Больше нельзя запрашивать сегодня
            reason: "Refund requested successfully"
          }));
        return true;
        } else {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            error: data.message || "Refund request failed" 
          }));
          return false;
        }
      } else {
        const errorData = await res.json();
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: errorData.error || "Request failed" 
        }));
        return false;
      }
    } catch (e) {
      console.error("refund request error", e);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Failed to request refund" 
      }));
    return false;
    }
  }, [wallet, wa]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (!wallet) return;
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [wallet, refresh]);

  return {
    canClaim: state.available,
    amountGOR: state.potentialRefund.toFixed(4),
    yesterdayVolume: state.yesterdayVolume,
    reason: state.reason,
    loading: state.loading,
    error: state.error,
    requestSuccess: state.requestSuccess,
    lastRequestStatus: state.lastRequestStatus,
    lastRequestAmount: state.lastRequestAmount,
    lastRequestDate: state.lastRequestDate,
    claim: requestRefund,
    refresh,
  } as const;
} 