-- Обновление порогов достижений в соответствии с новой формулой очков
-- Старая формула: 100 + 1000 × amount
-- Новая формула: 50 + 400 × amount  
-- Пороги уменьшены примерно в 2.5 раза

-- Обновляем пороги достижений по очкам
UPDATE achievements SET 
    threshold = 50,
    description = 'Reach 50 STINK points'
WHERE id = 'score_100';

UPDATE achievements SET 
    threshold = 400,
    description = 'Reach 400 STINK points'
WHERE id = 'score_1000';

UPDATE achievements SET 
    threshold = 4000,
    description = 'Reach 4,000 STINK points'  
WHERE id = 'score_10000';

UPDATE achievements SET 
    threshold = 20000,
    description = 'Reach 20,000 STINK points'
WHERE id = 'score_50000';

-- Сначала удаляем старую функцию
DROP FUNCTION IF EXISTS check_and_unlock_achievements(TEXT);

-- Создаем новую функцию проверки достижений с новыми порогами
CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_wallet_address TEXT)
RETURNS TEXT[] AS $$
DECLARE
    newly_unlocked TEXT[] := ARRAY[]::TEXT[];
    player_data RECORD;
BEGIN
    -- Получаем данные игрока
    SELECT 
        p.total_score,
        p.transaction_count,
        p.total_volume,
        COALESCE(r.level1_count, 0) as referral_count,
        (SELECT MAX(t.amount_lamports::DECIMAL / 1000000000) 
         FROM transactions t 
         WHERE t.from_wallet = p_wallet_address) as max_transaction
    INTO player_data
    FROM players p
    LEFT JOIN (
        SELECT 
            referrer_level1,
            COUNT(*) as level1_count
        FROM referral_chain
        WHERE referrer_level1 = p_wallet_address
        GROUP BY referrer_level1
    ) r ON r.referrer_level1 = p_wallet_address
    WHERE p.wallet_address = p_wallet_address;

    -- Проверяем достижения по очкам (ОБНОВЛЕННЫЕ ПОРОГИ)
    IF player_data.total_score >= 50 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'score_100'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_100');
        newly_unlocked := array_append(newly_unlocked, 'score_100');
    END IF;
    
    IF player_data.total_score >= 400 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'score_1000'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_1000');
        newly_unlocked := array_append(newly_unlocked, 'score_1000');
    END IF;
    
    IF player_data.total_score >= 4000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'score_10000'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_10000');
        newly_unlocked := array_append(newly_unlocked, 'score_10000');
    END IF;
    
    IF player_data.total_score >= 20000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'score_50000'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_50000');
        newly_unlocked := array_append(newly_unlocked, 'score_50000');
    END IF;
    
    -- 🗑️ ДОСТИЖЕНИЯ ПО КОЛИЧЕСТВУ ТРАНЗАКЦИЙ (без изменений)
    IF player_data.transaction_count >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'first_feed'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'first_feed');
        newly_unlocked := array_append(newly_unlocked, 'first_feed');
    END IF;
    
    IF player_data.transaction_count >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'feeder_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'feeder_10');
        newly_unlocked := array_append(newly_unlocked, 'feeder_10');
    END IF;
    
    IF player_data.transaction_count >= 50 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'feeder_50'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'feeder_50');
        newly_unlocked := array_append(newly_unlocked, 'feeder_50');
    END IF;
    
    IF player_data.transaction_count >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'feeder_100'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'feeder_100');
        newly_unlocked := array_append(newly_unlocked, 'feeder_100');
    END IF;
    
    -- 🐋 ДОСТИЖЕНИЯ ПО ОБЪЕМУ ТРАНЗАКЦИЙ (без изменений)
    IF player_data.total_volume >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'volume_1'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_1');
        newly_unlocked := array_append(newly_unlocked, 'volume_1');
    END IF;
    
    IF player_data.total_volume >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'volume_5'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_5');
        newly_unlocked := array_append(newly_unlocked, 'volume_5');
    END IF;
    
    IF player_data.total_volume >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'volume_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_10');
        newly_unlocked := array_append(newly_unlocked, 'volume_10');
    END IF;
    
    -- 🐳 WHALE ДОСТИЖЕНИЯ (без изменений)
    IF player_data.max_transaction >= 0.25 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'whale_025'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'whale_025');
        newly_unlocked := array_append(newly_unlocked, 'whale_025');
    END IF;
    
    IF player_data.max_transaction >= 0.5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'whale_05'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'whale_05');
        newly_unlocked := array_append(newly_unlocked, 'whale_05');
    END IF;
    
    IF player_data.max_transaction >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'whale_1'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'whale_1');
        newly_unlocked := array_append(newly_unlocked, 'whale_1');
    END IF;
    
    -- 👥 REFERRAL ДОСТИЖЕНИЯ (без изменений)
    IF player_data.referral_count >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'referral_1'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_1');
        newly_unlocked := array_append(newly_unlocked, 'referral_1');
    END IF;
    
    IF player_data.referral_count >= 3 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'referral_3'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_3');
        newly_unlocked := array_append(newly_unlocked, 'referral_3');
    END IF;
    
    IF player_data.referral_count >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'referral_5'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_5');
        newly_unlocked := array_append(newly_unlocked, 'referral_5');
    END IF;
    
    IF player_data.referral_count >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa WHERE pa.wallet_address = p_wallet_address AND pa.achievement_id = 'referral_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_10');
        newly_unlocked := array_append(newly_unlocked, 'referral_10');
    END IF;

    RETURN newly_unlocked;
END;
$$ LANGUAGE plpgsql; 