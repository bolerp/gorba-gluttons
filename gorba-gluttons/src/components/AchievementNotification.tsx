"use client"

import { Achievement } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAudio } from "@/hooks/useAudio";

interface Props {
  achievements: Achievement[];
  onClose: () => void;
}

export default function AchievementNotification({ achievements, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const playSound = useAudio();

  useEffect(() => {
    if (achievements.length > 0) {
      // Играем звук достижения
      playSound('achievement-unlocked');
    }
  }, [achievements, playSound]);

  const currentAchievement = achievements[currentIndex];

  const handleNext = () => {
    if (currentIndex < achievements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!achievements.length || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="bg-gradient-to-br from-yellow-400/10 to-orange-500/10 border border-yellow-500/40 rounded-2xl p-8 max-w-md w-full backdrop-blur-lg"
          initial={{ scale: 0.5, rotateY: -90 }}
          animate={{ scale: 1, rotateY: 0 }}
          exit={{ scale: 0.5, rotateY: 90 }}
          transition={{ type: "spring", duration: 0.6 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <motion.div
                className="bg-yellow-500/20 p-3 rounded-full"
                animate={{ 
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              >
                <Trophy className="w-8 h-8 text-yellow-400" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white">Achievement Unlocked!</h2>
                {achievements.length > 1 && (
                  <p className="text-sm text-gray-400">
                    {currentIndex + 1} of {achievements.length}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Achievement Details */}
          <motion.div
            key={currentIndex}
            className="text-center mb-8"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-6xl mb-4">
              {currentAchievement.icon || '🏆'}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {currentAchievement.name}
            </h3>
            <p className="text-gray-300 leading-relaxed">
              {currentAchievement.description}
            </p>
          </motion.div>

          {/* Actions */}
          <div className="flex space-x-3">
            {achievements.length > 1 && currentIndex < achievements.length - 1 ? (
              <>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 px-4 py-3 bg-lime-500 hover:bg-lime-600 text-black font-medium rounded-lg transition-colors"
                >
                  Next Achievement
                </button>
              </>
            ) : (
              <button
                onClick={handleClose}
                className="w-full px-4 py-3 bg-lime-500 hover:bg-lime-600 text-black font-medium rounded-lg transition-colors"
              >
                Awesome!
              </button>
            )}
          </div>

          {/* Progress Dots */}
          {achievements.length > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              {achievements.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-yellow-400' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 