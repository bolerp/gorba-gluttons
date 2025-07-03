-- ИСПРАВЛЕНИЕ функции достижений - устраняет SQL ошибку ambiguous column
-- Выполните этот скрипт в Supabase SQL Editor после основного

-- 🔧 Исправленная функция для проверки и разблокировки достижений
CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_wallet_address TEXT)
RETURNS TABLE(achievement_id TEXT, name TEXT, description TEXT, icon TEXT) AS $$
DECLARE
    player_data RECORD;
    referral_count INTEGER;
    player_rank INTEGER;
    total_players INTEGER;
    newly_unlocked TEXT[];
BEGIN
    -- Получаем данные игрока
    SELECT * INTO player_data FROM players WHERE wallet_address = p_wallet_address;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Получаем количество рефералов
    SELECT COUNT(*) INTO referral_count 
    FROM referral_chain 
    WHERE referrer_level1 = p_wallet_address;
    
    -- Получаем ранг игрока
    SELECT COUNT(*) + 1 INTO player_rank 
    FROM players 
    WHERE total_score > player_data.total_score;
    
    -- Получаем общее количество игроков
    SELECT COUNT(*) INTO total_players FROM players;
    
    newly_unlocked := ARRAY[]::TEXT[];
    
    -- 🎯 ДОСТИЖЕНИЯ ПО ОЧКАМ
    IF player_data.total_score >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'score_100'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_100');
        newly_unlocked := array_append(newly_unlocked, 'score_100');
    END IF;
    
    IF player_data.total_score >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'score_1000'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_1000');
        newly_unlocked := array_append(newly_unlocked, 'score_1000');
    END IF;
    
    IF player_data.total_score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'score_10000'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_10000');
        newly_unlocked := array_append(newly_unlocked, 'score_10000');
    END IF;
    
    IF player_data.total_score >= 50000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'score_50000'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'score_50000');
        newly_unlocked := array_append(newly_unlocked, 'score_50000');
    END IF;
    
    -- 🗑️ ДОСТИЖЕНИЯ ПО КОЛИЧЕСТВУ ТРАНЗАКЦИЙ
    IF player_data.transaction_count >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'first_feed'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'first_feed');
        newly_unlocked := array_append(newly_unlocked, 'first_feed');
    END IF;
    
    IF player_data.transaction_count >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'feeder_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'feeder_10');
        newly_unlocked := array_append(newly_unlocked, 'feeder_10');
    END IF;
    
    IF player_data.transaction_count >= 50 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'feeder_50'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'feeder_50');
        newly_unlocked := array_append(newly_unlocked, 'feeder_50');
    END IF;
    
    IF player_data.transaction_count >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'feeder_100'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'feeder_100');
        newly_unlocked := array_append(newly_unlocked, 'feeder_100');
    END IF;
    
    -- 💎 ДОСТИЖЕНИЯ ПО ОБЪЕМУ
    IF player_data.total_volume >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'volume_1'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_1');
        newly_unlocked := array_append(newly_unlocked, 'volume_1');
    END IF;
    
    IF player_data.total_volume >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'volume_5'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_5');
        newly_unlocked := array_append(newly_unlocked, 'volume_5');
    END IF;
    
    IF player_data.total_volume >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'volume_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_10');
        newly_unlocked := array_append(newly_unlocked, 'volume_10');
    END IF;
    
    -- 👥 ДОСТИЖЕНИЯ ПО РЕФЕРАЛАМ
    IF referral_count >= 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'referral_1'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_1');
        newly_unlocked := array_append(newly_unlocked, 'referral_1');
    END IF;
    
    IF referral_count >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'referral_5'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_5');
        newly_unlocked := array_append(newly_unlocked, 'referral_5');
    END IF;
    
    IF referral_count >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'referral_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'referral_10');
        newly_unlocked := array_append(newly_unlocked, 'referral_10');
    END IF;
    
    -- 🏆 ДОСТИЖЕНИЯ ПО РАНГУ
    IF player_rank <= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'top_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'top_10');
        newly_unlocked := array_append(newly_unlocked, 'top_10');
    END IF;
    
    IF player_rank <= 3 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'top_3'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'top_3');
        newly_unlocked := array_append(newly_unlocked, 'top_3');
    END IF;
    
    IF player_rank = 1 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'king_of_heap'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'king_of_heap');
        newly_unlocked := array_append(newly_unlocked, 'king_of_heap');
    END IF;
    
    -- 🐦 EARLY BIRD ДОСТИЖЕНИЕ (первые 100 игроков)
    IF total_players <= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'early_bird'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'early_bird');
        newly_unlocked := array_append(newly_unlocked, 'early_bird');
    END IF;
    
    -- 🎁 ИСПРАВЛЕНО: Возвращаем информацию о новых достижениях с правильными алиасами
    RETURN QUERY
    SELECT a.id AS achievement_id, a.name, a.description, a.icon
    FROM achievements a
    WHERE a.id = ANY(newly_unlocked);
END;
$$ LANGUAGE plpgsql;

-- ✅ ГОТОВО! Функция исправлена - больше не будет ошибки ambiguous column. 