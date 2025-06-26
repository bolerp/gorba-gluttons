"use client"

import { motion } from "framer-motion"
import { Trash2, Zap } from "lucide-react"
import { useState, useEffect } from "react"

interface GorbaGluttonProps {
  onFeed: (amount: number) => void
  isFeeding: boolean
  stinkScore: number
  dailyLeft: number
  balance: number
  txLeft: number
  isAngry?: boolean
  isHappy?: boolean
}

export default function GorbaGlutton({ onFeed, isFeeding, stinkScore, dailyLeft, balance, txLeft, isAngry = false, isHappy = false }: GorbaGluttonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [amount, setAmount] = useState("0.1")
  const parsed = parseFloat(amount)
  const EPS = 1e-6
  const valid = txLeft > 0 && !isNaN(parsed) && parsed >= 0.01 && (txLeft > 1 ? parsed <= dailyLeft + EPS : Math.abs(parsed - dailyLeft) < EPS) && parsed <= balance + EPS

  // Dynamic trash pile selection based on personal stink score
  let trashSrc = "/trash-small.png";
  let pileClass = "w-128"; // base width ≈ 16rem
  if (stinkScore >= 2000) {
    trashSrc = "/trash-big.png";
    pileClass = "w-[28rem]"; // ≈ 448px
  } else if (stinkScore >= 500) {
    trashSrc = "/trash-medium.png";
    pileClass = "w-96"; // 24rem
  }

  useEffect(() => {
    if (txLeft === 1) {
      const maxAmt = Math.min(dailyLeft, balance);
      setAmount(maxAmt.toFixed(2));
    }
  }, [txLeft, dailyLeft, balance]);

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Monster Container */}
      <div className="relative" style={{ filter: "drop-shadow(0 0 10px rgba(132, 204, 22, 0.5))" }}>
        {/* Monster Image */}
        <motion.img
          src={
            isAngry
              ? "/monster-angry.png"
              : isHappy
              ? "/monster-happy.png"
              : isFeeding
              ? "/monster-hands.png"
              : "/monster-idle.png"
          }
          alt="Gorba Glutton"
          className="relative z-10 w-96 h-96 object-contain select-none cursor-pointer focus:outline-none border-none"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{
            y: isFeeding ? [0, -10, 0] : [0, -5, 0],
          }}
          transition={{ duration: isFeeding ? 0.5 : 3, repeat: Infinity, ease: "easeInOut" }}
          onClick={() => onFeed(parsed)}
        />

        {/* Trash pile on the floor */}
        <img
          src={trashSrc}
          alt="Trash pile"
          className={`absolute -bottom-4 left-1/2 -translate-x-1/2 ${pileClass} pointer-events-none select-none`}
        />
      </div>

      {/* Amount input + Feed Button */}
      <div className="flex items-center space-x-3">
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          readOnly={txLeft === 1}
          className="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none read-only:bg-gray-700 read-only:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => {
            const maxAmt = txLeft === 0 ? 0 : Math.min(dailyLeft, balance);
            setAmount(maxAmt.toFixed(2));
          }}
          className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
        >MAX</button>
        <motion.button
          className="relative px-6 py-3 bg-gradient-to-r from-lime-500 to-green-600 text-black font-bold text-lg rounded-lg shadow-lg border-2 border-lime-400 hover:from-lime-400 hover:to-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onFeed(parsed)}
          disabled={isFeeding || !valid}
          animate={{
            boxShadow: isHovered ? [
              "0 0 20px rgba(132, 204, 22, 0.5)",
              "0 0 30px rgba(132, 204, 22, 0.8)",
              "0 0 20px rgba(132, 204, 22, 0.5)"
            ] : "0 0 10px rgba(132, 204, 22, 0.3)"
          }}
          transition={{ duration: 1, repeat: Infinity }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          <div className="flex items-center space-x-2">
            {isFeeding ? (
              <>
                <Zap className="w-5 h-5 animate-spin" />
                <span>Feeding...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                <span>Feed</span>
              </>
            )}
          </div>
        </motion.button>
      </div>

      {/* Limits & balance */}
      <div className="text-xs text-gray-400 mt-1 space-y-0.5 flex flex-col">
        <span>Daily left: {dailyLeft.toFixed(2)} GOR</span>
        <span>Feeds left: {txLeft}</span>
        <span>Balance: {balance.toFixed(2)} GOR</span>
      </div>

      {/* Stink Score Display */}
      <motion.div
        className="text-center"
        animate={{ scale: isFeeding ? [1, 1.1, 1] : 1 }}
        transition={{ duration: 0.3, repeat: isFeeding ? 3 : 0 }}
      >
        <div className="text-sm text-gray-400 mb-1">Your STINK Score</div>
        <div className="text-3xl font-bold text-lime-400 glow-text">
          {stinkScore.toLocaleString()}
        </div>
      </motion.div>
    </div>
  )
} 