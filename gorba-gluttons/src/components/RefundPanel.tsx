"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import useRefund from "@/hooks/useRefund";
import { useState } from "react";
import { Loader2, DollarSign, Calendar, AlertCircle } from "lucide-react";

export default function RefundPanel() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const { 
    canClaim, 
    amountGOR, 
    yesterdayVolume, 
    reason, 
    loading, 
    error, 
    requestSuccess,
    lastRequestStatus,
    lastRequestAmount,
    lastRequestDate,
    claim 
  } = useRefund(wallet);

  const [isRequesting, setIsRequesting] = useState(false);

  if (!wallet) return null;

  const handleRequest = async () => {
    setIsRequesting(true);
    await claim();
    setIsRequesting(false);
  };

  const isLoading = loading || isRequesting;

  return (
    <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-6 mt-6 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-lime-400" />
        <h3 className="text-lg font-semibold text-white">Daily Refund</h3>
      </div>

      {/* Статистика за вчера */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Yesterday&apos;s activity</span>
        </div>
        <div className="text-2xl font-bold text-white">
          {yesterdayVolume.toFixed(4)} <span className="text-sm text-gray-400">GOR spent</span>
        </div>
      </div>

      {/* Основная логика */}
      {isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-lime-400" />
          <p className="text-sm text-gray-300">Checking refund availability...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
          <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : requestSuccess ? (
        <div className="bg-lime-900/20 border border-lime-800 rounded-lg p-4 text-center">
          <div className="text-lime-400 mb-2">✅</div>
          <p className="text-sm text-lime-300 mb-2">
            Refund requested successfully!
          </p>
          <p className="text-lg font-bold text-lime-400">
            {amountGOR} GOR
          </p>
          <p className="text-xs text-gray-400 mt-2">
            You will receive the refund manually within 24 hours
          </p>
        </div>
      ) : canClaim ? (
        <div className="text-center">
          <div className="bg-lime-900/20 border border-lime-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-300 mb-2">Available for refund (90%):</p>
            <p className="text-2xl font-bold text-lime-400">{amountGOR} GOR</p>
          </div>
            <button
            onClick={handleRequest}
            disabled={isRequesting}
            className="w-full px-6 py-3 bg-lime-500 text-black font-semibold rounded-lg hover:bg-lime-400 disabled:opacity-50 transition-colors"
            >
            {isRequesting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Requesting...
              </span>
            ) : (
              "Request refund"
            )}
            </button>
          <p className="text-xs text-gray-400 mt-2">
            You can request refund once per day
          </p>
        </div>
      ) : lastRequestStatus ? (
        <div className={`rounded-lg p-4 text-center border ${
          lastRequestStatus === 'processed' 
            ? 'bg-green-900/20 border-green-800' 
            : lastRequestStatus === 'pending'
            ? 'bg-yellow-900/20 border-yellow-800'
            : 'bg-red-900/20 border-red-800'
        }`}>
          <div className="mb-2">
            {lastRequestStatus === 'processed' && '✅'}
            {lastRequestStatus === 'pending' && '🟡'}
            {lastRequestStatus === 'cancelled' && '❌'}
          </div>
          <p className={`text-sm font-medium mb-2 ${
            lastRequestStatus === 'processed' 
              ? 'text-green-300' 
              : lastRequestStatus === 'pending'
              ? 'text-yellow-300'
              : 'text-red-300'
          }`}>
            {lastRequestStatus === 'processed' && 'Refund Processed!'}
            {lastRequestStatus === 'pending' && 'Refund Pending'}
            {lastRequestStatus === 'cancelled' && 'Refund Cancelled'}
          </p>
          <p className="text-lg font-bold text-white mb-1">
            {lastRequestAmount?.toFixed(4)} GOR
          </p>
          <p className="text-xs text-gray-400">
            {lastRequestStatus === 'processed' && 'Refund has been sent to your wallet'}
            {lastRequestStatus === 'pending' && 'Your refund is being processed'}
            {lastRequestStatus === 'cancelled' && 'Refund request was cancelled'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
          <AlertCircle className="w-5 h-5 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{reason}</p>
          {yesterdayVolume === 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Make some transactions to be eligible for refunds
        </p>
      )}
        </div>
      )}

      {/* Информация о системе */}
      <div className="mt-4 p-3 bg-blue-900/10 border border-blue-800/30 rounded-lg">
        <p className="text-xs text-blue-300 leading-relaxed">
          💡 You can request a 90% refund of yesterday&apos;s GOR spending once per day. 
          Refunds are processed manually within 24 hours.
        </p>
      </div>
    </div>
  );
} 