import { Router } from 'express';
import { 
  getPlayer, 
  createOrUpdatePlayer, 
  getLeaderboard, 
  saveTransaction,
  calculateStinkScore,
  supabase,
  type Player 
} from './supabase';
import { PublicKey } from '@solana/web3.js';
// @ts-ignore
import nacl from 'tweetnacl';
import logger, { gameLogger } from './logger';

const router = Router();

// Map для отслеживания последних предупреждений о лимитах
const limitWarnings = new Map<string, number>();

// Получить лидерборд
router.get('/leaderboard', async (req, res) => {
  try {
    const players = await getLeaderboard();
    
    // Получаем количество рефералов для каждого игрока
    const walletAddresses = players.map(p => p.wallet_address);
    const { data: referralCounts, error: refError } = await supabase
      .from('referral_chain')
      .select('referrer_level1')
      .in('referrer_level1', walletAddresses);

    if (refError) {
      logger.error('Error fetching referral counts', { error: refError });
    }

    // Подсчитываем количество рефералов для каждого игрока
    const referralCountMap = new Map();
    (referralCounts || []).forEach((ref: any) => {
      const count = referralCountMap.get(ref.referrer_level1) || 0;
      referralCountMap.set(ref.referrer_level1, count + 1);
    });
    
    // Форматируем данные для фронтенда
    const formattedLeaderboard = players.map((player, index) => ({
      rank: index + 1,
      address: player.wallet_address,
      nickname: player.nickname,
      stinkScore: player.total_score,
      baseScore: player.base_score,
      referralScore: player.referral_score,
      garbagePatchSize: referralCountMap.get(player.wallet_address) || 0
    }));

    res.json(formattedLeaderboard);
  } catch (error) {
    logger.error('Error in /leaderboard', { error });
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Получить статистику игры
router.get('/stats', async (req, res) => {
  try {
    const players = await getLeaderboard();
    const currentKing = players.length > 0 ? players[0] : null;
    
    const stats = {
      totalPlayers: players.length,
      totalTransactions: players.reduce((sum, p) => sum + p.transaction_count, 0),
      totalStink: players.reduce((sum, p) => sum + p.total_score, 0),
      currentKing: currentKing ? {
        wallet: currentKing.wallet_address,
        total_score: currentKing.total_score,
        nickname: currentKing.nickname
      } : null
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error in /stats', { error });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Получить информацию об игроке
router.get('/player/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const player = await getPlayer(walletAddress);
    
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json({
      address: player.wallet_address,
      nickname: player.nickname,
      stinkScore: player.total_score,
      baseScore: player.base_score,
      referralScore: player.referral_score,
      transactionCount: player.transaction_count,
      totalVolume: player.total_volume
    });
  } catch (error) {
    logger.error('Error in /player', { error });
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
});

// Создать или обновить игрока
router.post('/player', async (req, res) => {
  try {
    const { walletAddress, nickname, signature } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address is required' });
      return;
    }

    // Если предоставлен никнейм, проверяем подпись
    if (nickname) {
      if (!signature) {
        res.status(400).json({ error: 'Signature is required for nickname registration' });
        return;
      }

      const message = `REGISTER_NICKNAME_${nickname}`;
      if (!verifySignature(message, signature, walletAddress)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Получаем существующего игрока или создаем нового
    let player = await getPlayer(walletAddress);
    
    if (!player) {
      // Создаем нового игрока
      player = await createOrUpdatePlayer({
        wallet_address: walletAddress,
        nickname: nickname || undefined,
        total_score: 0,
        base_score: 0,
        referral_score: 0,
        transaction_count: 0,
        total_volume: 0
      });
    } else if (nickname && nickname !== player.nickname) {
      // Обновляем никнейм если он изменился и подпись верна
      player = await createOrUpdatePlayer({
        ...player,
        nickname
      });
    }

    if (!player) {
      res.status(500).json({ error: 'Failed to create/update player' });
      return;
    }

    res.json({
      address: player.wallet_address,
      nickname: player.nickname,
      stinkScore: player.total_score,
      baseScore: player.base_score,
      referralScore: player.referral_score
    });
  } catch (error) {
    logger.error('Error in POST /player', { error });
    res.status(500).json({ error: 'Failed to create/update player' });
  }
});

// Записать транзакцию кормления
router.post('/feed', async (req, res) => {
  try {
    const { 
      walletAddress, 
      transactionSignature, 
      amountSol 
    } = req.body;
    
    if (!walletAddress || !transactionSignature || !amountSol) {
      res.status(400).json({ 
        error: 'Wallet address, transaction signature, and amount are required' 
      });
      return;
    }

    // 🚦 ПРОВЕРЯЕМ ДНЕВНЫЕ ЛИМИТЫ ПЕРЕД ТРАНЗАКЦИЕЙ
    const { data: limitCheck, error: limitError } = await supabase.rpc('check_daily_limits', {
      p_wallet_address: walletAddress,
      p_amount_gor: amountSol
    });

    if (limitError) {
      logger.error('Error checking daily limits', { error: limitError });
      res.status(500).json({ error: 'Failed to check daily limits' });
      return;
    }

    const limits = limitCheck?.[0];
    if (!limits?.can_transact) {
      res.status(400).json({ 
        error: limits?.reason || 'Daily limit exceeded',
        dailyLeft: parseFloat(limits?.volume_left || '0'),
        txLeft: parseInt(limits?.transactions_left || '0')
      });
      return;
    }

    // Получаем игрока
    let player = await getPlayer(walletAddress);
    
    if (!player) {
      // Создаем нового игрока если его нет
      player = await createOrUpdatePlayer({
        wallet_address: walletAddress,
        total_score: 0,
        base_score: 0,
        referral_score: 0,
        transaction_count: 0,
        total_volume: 0
      });
    }

    if (!player) {
      res.status(500).json({ error: 'Failed to create player' });
      return;
    }

    // Подсчитываем очки за эту транзакцию
    const stinkEarned = calculateStinkScore(1, amountSol);
    
    // Обновляем игрока
    const updatedPlayer = await createOrUpdatePlayer({
      ...player,
      total_score: player.total_score + stinkEarned,
      base_score: player.base_score + stinkEarned,
      transaction_count: player.transaction_count + 1,
      total_volume: player.total_volume + amountSol
    });

    // Сохраняем транзакцию
    await saveTransaction({
      signature: transactionSignature,
      from_wallet: walletAddress,
      to_wallet: process.env.TRASH_CAN_ADDRESS || 'unknown',
      amount_lamports: Math.floor(amountSol * 1000000000), // Convert to lamports
      stink_earned: stinkEarned
    });

    // Проверяем whale достижения для этой транзакции
    let whaleAchievements: any[] = [];
    if (amountSol >= 0.25) {
      const whaleId = amountSol >= 1 ? 'whale_1' : amountSol >= 0.5 ? 'whale_05' : 'whale_025';
      const { data: whaleCheck, error: whaleError } = await supabase
        .from('player_achievements')
        .select('achievement_id')
        .eq('wallet_address', walletAddress)
        .eq('achievement_id', whaleId);

      if (!whaleError && (!whaleCheck || whaleCheck.length === 0)) {
        const { error: insertError } = await supabase
          .from('player_achievements')
          .insert({ wallet_address: walletAddress, achievement_id: whaleId });

        if (!insertError) {
          const { data: whaleAchievement } = await supabase
            .from('achievements')
            .select('*')
            .eq('id', whaleId)
            .single();

          if (whaleAchievement) {
            whaleAchievements.push(whaleAchievement);
          }
        }
      }
    }

    // Проверяем остальные достижения
    // Логируем проверку достижений только в debug режиме
          logger.debug(`Checking achievements for ${walletAddress.slice(0,8)}`, { 
        transactionCount: player.transaction_count + 1 
      });
    const { data: newAchievements, error: achievementError } = await supabase.rpc('check_and_unlock_achievements', {
      p_wallet_address: walletAddress
    });

    if (achievementError) {
      logger.error('Error checking achievements', { error: achievementError });
    } else if (newAchievements && newAchievements.length > 0) {
      gameLogger.achievement(walletAddress, newAchievements);
    }

    // 📊 ОБНОВЛЯЕМ ДНЕВНЫЕ ЛИМИТЫ ПОСЛЕ УСПЕШНОЙ ТРАНЗАКЦИИ
    const { error: updateLimitError } = await supabase.rpc('update_daily_usage', {
      p_wallet_address: walletAddress,
      p_amount_gor: amountSol
    });

    if (updateLimitError) {
      logger.error('Error updating daily limits', { error: updateLimitError });
      // Не прерываем выполнение, это не критично
    }

    // Получаем обновленные лимиты для ответа
    const { data: updatedLimits } = await supabase.rpc('get_daily_usage', {
      p_wallet_address: walletAddress
    });

    const newLimits = updatedLimits?.[0];

    const allNewAchievements = [...whaleAchievements, ...(newAchievements || [])];

    // Логируем исчерпание лимитов только если очень мало осталось и не чаще раза в час
    if ((parseFloat(newLimits?.volume_left || '0') <= 0.05 || parseInt(newLimits?.transactions_left || '0') <= 2) && shouldLogLimit(walletAddress)) {
      gameLogger.limitExhausted(walletAddress);
    }

    res.json({
      success: true,
      stinkEarned,
      newScore: updatedPlayer?.total_score || 0,
      message: 'Feed successful! The monster is happy! 🗑️',
      newAchievements: allNewAchievements,
      // Отправляем обновленные лимиты
      dailyLeft: parseFloat(newLimits?.volume_left || '0'),
      txLeft: parseInt(newLimits?.transactions_left || '0')
    });
  } catch (error) {
    logger.error('Error in POST /feed', { error });
    res.status(500).json({ error: 'Failed to process feed' });
  }
});

// Получить недавние транзакции для ActivityFeed
router.get('/feeds', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Получаем последние транзакции из базы данных
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('signature, from_wallet, amount_lamports, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching transactions', { error });
      res.status(500).json({ error: 'Failed to fetch transactions' });
      return;
    }

    if (!transactions || transactions.length === 0) {
      res.json([]);
      return;
    }

    // Получаем nicknames для кошельков отдельным запросом
    const wallets = transactions.map(tx => tx.from_wallet);
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('wallet_address, nickname')
      .in('wallet_address', wallets);

    if (playersError) {
      logger.warn('Error fetching players for feeds', { error: playersError });
    }

    // Создаем map для быстрого поиска nickname по wallet
    const nicknameMap = new Map();
    (players || []).forEach((player: any) => {
      nicknameMap.set(player.wallet_address, player.nickname);
    });

    // Форматируем данные для фронтенда
    const feeds = transactions.map((tx: any) => ({
      wallet: tx.from_wallet,
      nickname: nicknameMap.get(tx.from_wallet),
      amount_sol: tx.amount_lamports / 1000000000, // Convert lamports to SOL
      fed_at: tx.created_at
    }));

    res.json(feeds);
  } catch (error) {
    logger.error('Error in /feeds', { error });
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
});

// Регистрация реферала (двухуровневая система)
router.post('/register-referral', async (req, res) => {
  try {
    const { refereeAddress, referrerAddress, signature } = req.body;
    
    if (!refereeAddress || !referrerAddress) {
      res.status(400).json({ error: 'Referee and referrer addresses are required' });
      return;
    }

    if (!signature) {
      res.status(400).json({ error: 'Signature is required for referral registration' });
      return;
    }

    // Проверяем подпись
    const message = `REF_LINK_${referrerAddress}`;
    if (!verifySignature(message, signature, refereeAddress)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Вызываем функцию PostgreSQL для регистрации реферала
    const { error } = await supabase.rpc('register_referral', {
      p_referee_wallet: refereeAddress,
      p_referrer_wallet: referrerAddress
    });

    if (error) {
      logger.error('Error registering referral', { error });
      res.status(500).json({ error: 'Failed to register referral' });
      return;
    }

    // Пересчитываем бонусы для всей реферальной цепочки
    gameLogger.referral('Updating referral chain bonuses', { referee: refereeAddress.slice(0,8) });
    const { error: updateError } = await supabase.rpc('update_referral_chain_bonuses', {
      p_new_referee_wallet: refereeAddress
    });

    if (updateError) {
      logger.warn('Error updating referral chain bonuses', { error: updateError });
    }

    // Проверяем достижения для обоих уровней рефереров
    const { data: referralChain, error: chainError } = await supabase
      .from('referral_chain')
      .select('referrer_level1, referrer_level2')
      .eq('referee_wallet', refereeAddress)
      .single();

    if (!chainError && referralChain) {
      // Проверяем достижения реферера 1-го уровня
      if (referralChain.referrer_level1) {
        logger.debug('Checking achievements for level 1 referrer', { 
          referrer: referralChain.referrer_level1.slice(0,8) 
        });
        const { data: level1Achievements, error: level1Error } = await supabase.rpc('check_and_unlock_achievements', {
          p_wallet_address: referralChain.referrer_level1
        });

        if (level1Error) {
          logger.error('Error checking level 1 referrer achievements', { error: level1Error });
        } else if (level1Achievements && level1Achievements.length > 0) {
          gameLogger.achievement(referralChain.referrer_level1, level1Achievements);
        }
      }

      // Проверяем достижения реферера 2-го уровня
      if (referralChain.referrer_level2) {
        logger.debug('Checking achievements for level 2 referrer', { 
          referrer: referralChain.referrer_level2.slice(0,8) 
        });
        const { data: level2Achievements, error: level2Error } = await supabase.rpc('check_and_unlock_achievements', {
          p_wallet_address: referralChain.referrer_level2
        });

        if (level2Error) {
          logger.error('Error checking level 2 referrer achievements', { error: level2Error });
        } else if (level2Achievements && level2Achievements.length > 0) {
          gameLogger.achievement(referralChain.referrer_level2, level2Achievements);
        }
      }
    }

    res.json({ success: true, message: 'Referral registered successfully' });
  } catch (error) {
    logger.error('Error in /register-referral', { error });
    res.status(500).json({ error: 'Failed to register referral' });
  }
});

// Получить статистику рефералов игрока
router.get('/referrals/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Получаем статистику рефералов
    const { data: stats, error: statsError } = await supabase.rpc('get_referral_stats', {
      p_wallet: walletAddress
    });

    if (statsError) {
      logger.error('Error getting referral stats', { error: statsError });
      res.status(500).json({ error: 'Failed to get referral stats' });
      return;
    }

    // Получаем детали рефералов 1-го уровня
    const { data: level1Referrals, error: level1Error } = await supabase
      .from('referral_chain')
      .select(`
        referee_wallet,
        players!referral_chain_referee_wallet_fkey(nickname, base_score, total_score)
      `)
      .eq('referrer_level1', walletAddress);

    // Получаем детали рефералов 2-го уровня  
    const { data: level2Referrals, error: level2Error } = await supabase
      .from('referral_chain')
      .select(`
        referee_wallet,
        players!referral_chain_referee_wallet_fkey(nickname, base_score, total_score)
      `)
      .eq('referrer_level2', walletAddress);

    if (level1Error || level2Error) {
      logger.error('Error getting referral details', { error: level1Error || level2Error });
    }

    // Формируем список рефералов с бонусами и сортируем по убыванию бонуса
    const referrals = [
      ...(level1Referrals || []).map((ref: any) => {
        const baseScore = ref.players?.base_score || 0;
        const bonus = Math.floor(baseScore * 0.3); // 30% от base_score
        return {
          wallet: ref.referee_wallet,
          nickname: ref.players?.nickname,
          base_score: baseScore,
          total_score: ref.players?.total_score || 0,
          bonus_earned: bonus,
          level: 1
        };
      }),
      ...(level2Referrals || []).map((ref: any) => {
        const baseScore = ref.players?.base_score || 0;
        const bonus = Math.floor(baseScore * 0.1); // 10% от base_score
        return {
          wallet: ref.referee_wallet,
          nickname: ref.players?.nickname,
          base_score: baseScore,
          total_score: ref.players?.total_score || 0,
          bonus_earned: bonus,
          level: 2
        };
      })
    ].sort((a, b) => b.bonus_earned - a.bonus_earned); // Сортируем по убыванию бонуса

    const response = {
      stats: stats?.[0] || { level1_count: 0, level2_count: 0, total_bonus: 0 },
      level1_referrals: level1Referrals || [],
      level2_referrals: level2Referrals || [],
      referrals,
      bonus: stats?.[0]?.total_bonus || 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Error in /referrals', { error });
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

// Получить достижения игрока
router.get('/achievements/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Получаем все доступные достижения
    const { data: allAchievements, error: allError } = await supabase
      .from('achievements')
      .select('*')
      .order('category, threshold');

    if (allError) {
      logger.error('Error fetching all achievements', { error: allError });
      res.status(500).json({ error: 'Failed to fetch achievements' });
      return;
    }

    // Получаем разблокированные достижения игрока
    const { data: unlockedAchievements, error: unlockedError } = await supabase
      .from('player_achievements')
      .select('achievement_id, unlocked_at')
      .eq('wallet_address', walletAddress);

    if (unlockedError) {
      logger.error('Error fetching unlocked achievements', { error: unlockedError });
      res.status(500).json({ error: 'Failed to fetch unlocked achievements' });
      return;
    }

    // Создаем set для быстрого поиска
    const unlockedSet = new Set((unlockedAchievements || []).map(a => a.achievement_id));

    // Формируем ответ с информацией о прогрессе
    const achievements = (allAchievements || []).map(achievement => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      threshold: achievement.threshold,
      unlocked: unlockedSet.has(achievement.id),
      unlocked_at: unlockedAchievements?.find(u => u.achievement_id === achievement.id)?.unlocked_at
    }));

    res.json({ achievements });
  } catch (error) {
    logger.error('Error in /achievements', { error });
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// Принудительная проверка достижений
router.post('/check-achievements/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // console.log(`🎯 Manual achievement check requested for: ${walletAddress.slice(0,8)}...`);
    
    // Проверяем достижения
    const { data: newAchievements, error: achievementError } = await supabase.rpc('check_and_unlock_achievements', {
      p_wallet_address: walletAddress
    });

    if (achievementError) {
      logger.error('Error checking achievements', { error: achievementError });
      res.status(500).json({ error: 'Failed to check achievements' });
      return;
    }

    res.json({ 
      success: true,
      newAchievements: newAchievements || [],
      message: `Checked achievements for ${walletAddress}`
    });
  } catch (error) {
    logger.error('Error in /check-achievements', { error });
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

// Получить дневные лимиты игрока
router.get('/daily-left/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const { data, error } = await supabase.rpc('get_daily_usage', {
      p_wallet_address: walletAddress
    });

    if (error) {
      logger.error('Error getting daily usage', { error });
      res.status(500).json({ error: 'Failed to get daily limits' });
      return;
    }

    const usage = data?.[0];
    if (!usage) {
      res.json({ 
        dailyLeft: 0.25,
        txLeft: 10,
        todayCount: 0,
        todayVolume: 0
      });
      return;
    }

    // Рассчитываем остатки вручную для отладки
    const spentVolume = parseFloat(usage.volume_spent || '0');
    const spentCount = parseInt(usage.transactions_count || '0');
    const maxVolume = 0.25;
    const maxTransactions = 10;
    
    const dailyLeft = Math.max(0, maxVolume - spentVolume);
    const txLeft = Math.max(0, maxTransactions - spentCount);
    
    // Логируем только когда лимиты полностью исчерпаны (раз в час на кошелек)
    if (dailyLeft === 0 && txLeft === 0) {
      const now = Date.now();
      if (!limitWarnings.has(walletAddress) || now - limitWarnings.get(walletAddress)! > 3600000) {
        limitWarnings.set(walletAddress, now);
        console.log(`🚨 Daily limits exhausted for ${walletAddress.slice(0,8)}...`);
      }
    }
    
    // Логируем исчерпание лимитов только если очень мало осталось и не чаще раза в час
    if ((dailyLeft <= 0.05 || txLeft <= 2) && shouldLogLimit(walletAddress)) {
      gameLogger.limitExhausted(walletAddress);
    }
    
    res.json({
      dailyLeft: dailyLeft,
      txLeft: txLeft,
      todayCount: spentCount,
      todayVolume: spentVolume
    });
  } catch (error) {
    logger.error('Error in /daily-left', { error });
    res.status(500).json({ error: 'Failed to get daily limits' });
  }
});

// Проверить возможность запроса рефанда
router.get('/refund-available/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const { data, error } = await supabase.rpc('can_request_refund', {
      p_wallet_address: walletAddress
    });

    if (error) {
      logger.error('Error checking refund availability', { error });
      res.status(500).json({ 
        error: 'Failed to check refund availability',
        available: false,
        reason: 'Database error'
      });
      return;
    }

    const result = data?.[0];
    if (!result) {
      res.json({ 
        available: false,
        amount: 0,
        reason: "No data available"
      });
      return;
    }

    res.json({
      available: result.can_request,
      yesterdayVolume: parseFloat(result.yesterday_volume || '0'),
      potentialRefund: parseFloat(result.potential_refund || '0'),
      reason: result.reason,
      lastRequestDate: result.last_request_date,
      lastRequestStatus: result.last_request_status,
      lastRequestAmount: parseFloat(result.last_request_amount || '0')
    });
  } catch (error) {
    logger.error('Error in /refund-available', { error });
    res.status(500).json({ 
      error: 'Failed to check refund availability',
      available: false,
      reason: 'Server error'
    });
  }
});

// Запросить рефанд
router.post('/request-refund', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address is required' });
      return;
    }

    if (!signature) {
      res.status(400).json({ error: 'Signature is required' });
      return;
    }

    // Проверяем подпись
    const message = `REQUEST_REFUND_${new Date().toISOString().split('T')[0]}`;
    if (!verifySignature(message, signature, walletAddress)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Вызываем функцию создания запроса рефанда
    const { data, error } = await supabase.rpc('request_refund', {
      p_wallet_address: walletAddress
    });

    if (error) {
      logger.error('Error requesting refund', { error });
      res.status(500).json({ error: 'Failed to process refund request' });
      return;
    }

    const result = data?.[0];
    if (!result) {
      res.status(500).json({ error: 'No result from refund request' });
      return;
    }

    if (result.success) {
      gameLogger.refund(walletAddress, result.refund_amount);
    }

    res.json({
      success: result.success,
      message: result.message,
      yesterdayVolume: parseFloat(result.yesterday_volume || '0'),
      refundAmount: parseFloat(result.refund_amount || '0'),
      calculationDate: result.calculation_date
    });
  } catch (error) {
    logger.error('Error in /request-refund', { error });
    res.status(500).json({ error: 'Failed to process refund request' });
  }
});

// Получить список запросов рефанда (для просмотра в базе)
router.get('/refund-requests', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    
    const { data: requests, error } = await supabase
      .from('refund_requests')
      .select(`
        id,
        wallet_address,
        requested_at,
        calculation_date,
        yesterday_volume,
        refund_amount,
        status,
        processed_at,
        notes,
        players!refund_requests_wallet_address_fkey(nickname)
      `)
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) {
      logger.error('Error fetching refund requests', { error });
      res.status(500).json({ error: 'Failed to fetch refund requests' });
      return;
    }

    const formattedRequests = (requests || []).map((req: any) => ({
      id: req.id,
      walletAddress: req.wallet_address,
      nickname: req.players?.nickname,
      requestedAt: req.requested_at,
      calculationDate: req.calculation_date,
      yesterdayVolume: parseFloat(req.yesterday_volume),
      refundAmount: parseFloat(req.refund_amount),
      status: req.status,
      processedAt: req.processed_at,
      notes: req.notes
    }));

    res.json({ requests: formattedRequests });
  } catch (error) {
    logger.error('Error in /refund-requests', { error });
    res.status(500).json({ error: 'Failed to fetch refund requests' });
  }
});

// Функция для проверки подписи
function verifySignature(message: string, signature: string, publicKey: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, 'base64');
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}

// Функция для проверки, нужно ли логировать предупреждение о лимитах
function shouldLogLimit(walletAddress: string): boolean {
  const now = Date.now();
  const lastWarning = limitWarnings.get(walletAddress);
  
  // Логируем не чаще раза в час (3600000 мс)
  if (!lastWarning || now - lastWarning > 3600000) {
    limitWarnings.set(walletAddress, now);
    return true;
  }
  
  return false;
}

export default router; 