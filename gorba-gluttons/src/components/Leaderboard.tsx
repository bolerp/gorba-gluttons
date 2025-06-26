"use client"

import { motion } from "framer-motion"
import { Crown, Trophy, Medal, Users, Share2 } from "lucide-react"
import { useState } from "react"
import { Player, LeaderboardPeriod } from "@/types"
import { formatNumber } from "@/lib/utils"

interface LeaderboardProps {
  players: Player[]
  currentPlayer?: Player
  referralCount?: number
  onOpenReferrals?: () => void
  onToast?: (msg: string) => void
}

const periods: LeaderboardPeriod[] = [
  { id: 'all-time', label: 'All Time' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'daily', label: 'Daily' }
]

export default function Leaderboard({ players, currentPlayer, referralCount = 0, onOpenReferrals, onToast }: LeaderboardProps) {
  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod['id']>('all-time')

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Trophy className="w-6 h-6 text-gray-400" />
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-gray-400 font-bold">
            #{rank}
          </span>
        )
    }
  }

  const inviteFriends = (player: Player) => {
    onOpenReferrals?.()
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 shadow-2xl overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Crown className="w-8 h-8 text-yellow-400" />
          <h2 className="text-2xl font-bold text-white">King of the Heap</h2>
        </div>
        <div className="text-sm text-gray-400">
          {players.length} Trash Collectors
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-800/50 rounded-lg p-1">
        {periods.map((period) => (
          <button
            key={period.id}
            onClick={() => setActivePeriod(period.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              activePeriod === period.id
                ? 'bg-lime-500 text-black shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Current Player Highlight */}
      {currentPlayer && (
        <motion.div
          className="bg-gradient-to-r from-lime-500/20 to-green-500/20 border border-lime-500/30 rounded-lg p-4 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getRankDisplay(currentPlayer.rank)}
              </div>
              <div>
                <div className="text-lime-400 font-bold">{currentPlayer.nickname ?? 'You'}</div>
                {currentPlayer.nickname && currentPlayer.address && (
                  <div className="text-xs text-gray-500">{currentPlayer.address.substring(0,4)}…{currentPlayer.address.slice(-4)}</div>
                )}
                <div className="text-sm text-gray-400">
                  {formatNumber(currentPlayer.stinkScore)} STINK
                </div>
              </div>
            </div>
            {onOpenReferrals && (
              <button
                onClick={() => inviteFriends(currentPlayer)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-lime-500 to-green-500 text-black rounded-lg hover:from-lime-400 hover:to-green-400 transition-colors duration-200 font-medium"
              >
                <Users className="w-4 h-4" />
                <span>Invite friends ({referralCount})</span>
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {players.map((player, index) => (
          <motion.div
            key={player.address}
            className={`flex items-center justify-between p-4 rounded-lg transition-colors duration-200 ${
              player.rank <= 3
                ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 hover:from-yellow-500/20 hover:to-amber-500/20'
                : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/60'
            }`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <div className="flex items-center space-x-4">
              {/* Rank */}
              <div className="flex items-center justify-center w-8 mr-2">
                {getRankDisplay(player.rank)}
              </div>

              {/* Player Info */}
              <div className="flex-1">
                <div className="text-white font-medium truncate max-w-[120px]">
                  {player.nickname ?? (player.address ? player.address.substring(0, 8) + "…" : "Unknown")}
                </div>
                {player.nickname && player.address && (
                  <div className="text-xs text-gray-500">{player.address.substring(0,4)}…{player.address.slice(-4)}</div>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                  <span>Base: {formatNumber(player.baseScore)}</span>
                  <span>{formatNumber(player.referralScore)}</span>
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{player.garbagePatchSize}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Score */}
            <div className="text-right">
              <div className="text-lime-400 font-bold text-lg">
                {formatNumber(player.stinkScore)}
              </div>
              <div className="text-xs text-gray-400">STINK</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="text-center text-sm text-gray-400">
          Rankings update in real-time • Season 1: Slime Season
        </div>
      </div>
    </div>
  )
} 