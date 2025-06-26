"use client"

import { motion } from "framer-motion"
import { Users, Activity, Zap, Crown } from "lucide-react"
import { GameStats as GameStatsType } from "@/types"
import { formatNumber } from "@/lib/utils"

interface GameStatsProps {
  stats: GameStatsType
}

export default function GameStats({ stats }: GameStatsProps) {
  const statItems = [
    {
      icon: Users,
      label: "Trash Collectors",
      value: formatNumber(stats.totalPlayers),
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20"
    },
    {
      icon: Activity,
      label: "Total Transactions",
      value: formatNumber(stats.totalTransactions),
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20"
    },
    {
      icon: Zap,
      label: "Total STINK",
      value: formatNumber(stats.totalStink),
      color: "text-lime-400",
      bgColor: "bg-lime-500/10",
      borderColor: "border-lime-500/20"
    },
    {
      icon: Crown,
      label: "Current King",
      value: stats.currentKing ? stats.currentKing.address.slice(0, 8) + "..." : "None",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20"
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          className={`${item.bgColor} ${item.borderColor} backdrop-blur-sm rounded-lg border p-4 shadow-lg`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          whileHover={{ scale: 1.05, y: -2 }}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 ${item.bgColor} rounded-lg`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <div className="text-sm text-gray-400">{item.label}</div>
              <div className={`text-lg font-bold ${item.color}`}>
                {item.value}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
} 