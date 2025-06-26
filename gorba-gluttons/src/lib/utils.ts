import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility for formatting numbers with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

// Generate random stink score for demo purposes
export function generateRandomStink(): number {
  return Math.floor(Math.random() * 10000) + 100
}

// Mock data for leaderboard
export function getMockLeaderboard() {
  const names = [
    "TrashKing420",
    "GarbageGoblin",
    "StinkMaster",
    "DumpsterDiver",
    "WasteWarrior",
    "FilthFiend",
    "MuckMonster",
    "SludgeSurfer",
    "GrimeGuru",
    "RefuseRanger"
  ]
  
  return names.map((name, index) => ({
    rank: index + 1,
    address: name,
    stinkScore: generateRandomStink() - (index * 500),
    baseScore: Math.floor((generateRandomStink() - (index * 500)) * 0.7),
    referralScore: Math.floor((generateRandomStink() - (index * 500)) * 0.3),
    garbagePatchSize: Math.floor(Math.random() * 50) + 1
  }))
} 