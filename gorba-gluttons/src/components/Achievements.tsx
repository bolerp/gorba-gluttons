"use client"

import { Achievement } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, Crown, Trophy, Medal, Zap, Users, TrendingUp, DollarSign } from "lucide-react";
import { getAchievementProgress } from "@/lib/achievements";
import { useState } from "react";

interface Props {
  achievements: Achievement[];
  playerData?: any;
  onNewAchievement?: (achievement: Achievement) => void;
}

// Иконки для категорий
const categoryIcons: Record<string, React.ComponentType<any>> = {
  score: TrendingUp,
  feeding: Zap,
  volume: DollarSign,
  referral: Users,
  ranking: Crown,
  whale: Trophy,
  milestone: Medal,
  general: Zap
};

// Цвета для категорий
const categoryColors: Record<string, string> = {
  score: "text-lime-400 border-lime-500/40 bg-lime-500/10",
  feeding: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  volume: "text-blue-400 border-blue-500/40 bg-blue-500/10",
  referral: "text-purple-400 border-purple-500/40 bg-purple-500/10",
  ranking: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  whale: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
  milestone: "text-pink-400 border-pink-500/40 bg-pink-500/10",
  general: "text-gray-400 border-gray-500/40 bg-gray-500/10"
};

export default function Achievements({ achievements, playerData, onNewAchievement }: Props) {
  const [filter, setFilter] = useState<string>('all');
  
  if (!achievements.length) return null;

  // Группируем достижения по категориям
  const categories = Array.from(new Set(achievements.map(a => a.category)));
  const filteredAchievements = filter === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === filter);

  // Статистика
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);

  return (
        <motion.div
      className="mt-8 bg-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-700 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span>Achievements</span>
          </h2>
          <p className="text-sm text-gray-400">
            {unlockedCount}/{totalCount} unlocked ({completionPercentage}%)
          </p>
        </div>
        
        {/* Progress Circle */}
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="rgb(55 65 81)"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="rgb(132 204 22)"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${completionPercentage * 1.759} 175.9`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'bg-lime-500 text-black'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All ({totalCount})
        </button>
        {categories.map(category => {
          const count = achievements.filter(a => a.category === category).length;
          const unlocked = achievements.filter(a => a.category === category && a.unlocked).length;
          return (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                filter === category
                  ? 'bg-lime-500 text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {category} ({unlocked}/{count})
            </button>
          );
        })}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredAchievements.map((achievement, idx) => {
            const progress = getAchievementProgress(achievement, playerData);
            const IconComponent = categoryIcons[achievement.category] || Zap;
            const isUnlocked = achievement.unlocked;
            
            return (
              <motion.div
                key={achievement.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, delay: idx * 0.02 }}
                className={`relative p-4 rounded-lg border backdrop-blur-sm transition-all duration-300 hover:scale-105 ${
                  isUnlocked 
                    ? categoryColors[achievement.category] || categoryColors.general
                    : "border-gray-700/50 bg-gray-800/30"
                }`}
        >
                {/* Achievement Icon and Status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-black/20' : 'bg-gray-700/50'}`}>
                      {achievement.icon ? (
                        <span className="text-lg">{achievement.icon}</span>
                      ) : (
                        <IconComponent className={`w-4 h-4 ${isUnlocked ? 'text-current' : 'text-gray-500'}`} />
                      )}
                    </div>
                    {isUnlocked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                      >
                        <Check className="w-5 h-5 text-lime-400" />
                      </motion.div>
                    )}
                  </div>
                  {!isUnlocked && <Lock className="w-4 h-4 text-gray-500" />}
                </div>

                {/* Achievement Info */}
                <div className="mb-3">
                  <h3 className={`font-bold text-sm mb-1 ${isUnlocked ? 'text-white' : 'text-gray-300'}`}>
                    {achievement.name}
                  </h3>
                  <p className={`text-xs leading-relaxed ${isUnlocked ? 'text-gray-200' : 'text-gray-400'}`}>
                    {achievement.description}
                  </p>
                </div>

                {/* Progress Bar */}
                {!isUnlocked && progress.max > 1 && 
                 achievement.category !== 'whale' && 
                 achievement.category !== 'ranking' && 
                 achievement.category !== 'milestone' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>
                        {achievement.category === 'volume' 
                          ? `${progress.current.toFixed(2)}/${progress.max} GOR`
                          : `${progress.current}/${progress.max}`
                        }
                      </span>
                      <span>{Math.round(progress.percentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-lime-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percentage}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </div>
                  </div>
                )}

                {/* Unlock Date */}
                {isUnlocked && achievement.unlocked_at && (
                  <div className="text-xs text-gray-400 mt-2">
                    Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
          </div>
                )}
        </motion.div>
            );
          })}
        </AnimatePresence>
    </div>
    </motion.div>
  );
} 