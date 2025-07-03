-- Achievements System Update для Gorba-Gluttons
-- Только НОВЫЕ таблицы и функции - безопасно для существующей БД
-- Выполните этот скрипт в Supabase SQL Editor

-- 🏆 Таблица определений достижений (НОВАЯ)
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    category TEXT DEFAULT 'general',
    threshold DECIMAL DEFAULT 1,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 📊 Добавляем индекс для достижений
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- 🎯 Вставляем базовые достижения (безопасно - ON CONFLICT DO NOTHING)
INSERT INTO achievements (id, name, description, icon, category, threshold) VALUES
    ('first_feed', 'First Bite', 'Feed the monster for the first time', '🍽️', 'feeding', 1),
    ('early_bird', 'Early Bird', 'Be among the first 100 players', '🐦', 'milestone', 100),
    ('score_100', 'Getting Started', 'Reach 100 STINK points', '💨', 'score', 100),
    ('score_1000', 'Stink Master', 'Reach 1,000 STINK points', '🔥', 'score', 1000),
    ('score_10000', 'Stink Lord', 'Reach 10,000 STINK points', '👑', 'score', 10000),
    ('score_50000', 'Stink Emperor', 'Reach 50,000 STINK points', '🏆', 'score', 50000),
    ('feeder_10', 'Regular Feeder', 'Complete 10 feeding transactions', '🗑️', 'feeding', 10),
    ('feeder_50', 'Dedicated Feeder', 'Complete 50 feeding transactions', '🚛', 'feeding', 50),
    ('feeder_100', 'Feeding Machine', 'Complete 100 feeding transactions', '🏭', 'feeding', 100),
    ('whale_025', 'Small Feeder', 'Feed 0.25 GOR in a single transaction', '🐋', 'whale', 0.25),
    ('whale_05', 'Medium Feeder', 'Feed 0.5 GOR in a single transaction', '🐋', 'whale', 0.5),
    ('whale_1', 'Big Feeder', 'Feed 1 GOR in a single transaction', '🐋', 'whale', 1),
    ('volume_1', 'Volume Starter', 'Feed a total of 1 GOR', '📊', 'volume', 1),
    ('volume_5', 'Volume Trader', 'Feed a total of 5 GOR', '📈', 'volume', 5),
    ('volume_10', 'Volume King', 'Feed a total of 10 GOR', '💎', 'volume', 10),
    ('referral_1', 'Recruiter', 'Refer your first player', '👥', 'referral', 1),
    ('referral_5', 'Talent Scout', 'Refer 5 players', '🕵️', 'referral', 5),
    ('referral_10', 'Community Builder', 'Refer 10 players', '🏘️', 'referral', 10),
    ('top_10', 'Top 10', 'Reach top 10 on the leaderboard', '🥉', 'ranking', 10),
    ('top_3', 'Podium Finish', 'Reach top 3 on the leaderboard', '🥈', 'ranking', 3),
    ('king_of_heap', 'King of the Heap', 'Reach #1 on the leaderboard', '👑', 'ranking', 1)
ON CONFLICT (id) DO NOTHING;

-- 🤖 Функция для автоматической проверки и разблокировки достижений
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
    
    -- 🎁 Возвращаем информацию о новых достижениях
    RETURN QUERY
    SELECT a.id AS achievement_id, a.name, a.description, a.icon
    FROM achievements a
    WHERE a.id = ANY(newly_unlocked);
END;
$$ LANGUAGE plpgsql;

-- ✅ ГОТОВО! Система достижений добавлена безопасно.
-- Этот скрипт не изменяет существующие таблицы, только добавляет новые. 