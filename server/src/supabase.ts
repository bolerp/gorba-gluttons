import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded no matter the import order
dotenv.config();

// Создаем клиент Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Типы для наших данных
export interface Player {
  wallet_address: string;
  nickname?: string;
  total_score: number;
  base_score: number;
  referral_score: number;
  transaction_count: number;
  total_volume: number;
  referrer_wallet?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  signature: string;
  from_wallet: string;
  to_wallet: string;
  amount_lamports: number;
  stink_earned: number;
  block_time?: string;
  created_at?: string;
}

export interface PlayerAchievement {
  wallet_address: string;
  achievement_id: string;
  unlocked_at?: string;
}

// Вспомогательные функции для работы с базой данных
export async function getPlayer(walletAddress: string): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching player:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getPlayer:', error);
    return null;
  }
}

export async function createOrUpdatePlayer(player: Partial<Player>): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from('players')
      .upsert(
        {
          ...player,
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'wallet_address',
          ignoreDuplicates: false 
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating player:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createOrUpdatePlayer:', error);
    return null;
  }
}

export async function getLeaderboard(limit: number = 100): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    return [];
  }
}

export async function saveTransaction(transaction: Transaction): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert(transaction);

    if (error) {
      console.error('Error saving transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveTransaction:', error);
    return false;
  }
}

// Функция для подсчета Stink Score по новой формуле: UP = 50 + 400 × amount
export function calculateStinkScore(transactionCount: number, volumeInSol: number): number {
  const BASE_POINTS = 50;
  const VOLUME_MULTIPLIER = 400;
  
  return Math.floor(
    (transactionCount * BASE_POINTS) + 
    (volumeInSol * VOLUME_MULTIPLIER)
  );
} 