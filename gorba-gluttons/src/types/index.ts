export interface Player {
  rank: number
  address: string
  stinkScore: number
  baseScore: number
  referralScore: number
  garbagePatchSize: number
  nickname?: string
  totalVolume?: number
  transactionCount?: number
}

export interface GameStats {
  totalPlayers: number
  totalTransactions: number
  totalStink: number
  currentKing: Player | null
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon?: string
  category: string
  threshold: number
  unlocked: boolean
  unlocked_at?: string
}

export interface LeaderboardPeriod {
  id: 'all-time' | 'weekly' | 'daily'
  label: string
}

export interface WalletState {
  connected: boolean
  address: string | null
  balance: number
}

export interface FeedEvent {
  wallet: string
  nickname?: string
  amount_sol: number
  fed_at: string
}

export interface Referral {
  wallet: string
  nickname?: string
  base_score: number
  total_score: number
  bonus_earned: number
  level: number
}

export interface ReferralStats {
  stats: {
    level1_count: number
    level2_count: number
    total_bonus: number
  }
  referrals: Referral[]
  bonus: number
} 