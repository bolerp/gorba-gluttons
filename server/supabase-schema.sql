-- Gorba-Gluttons Database Schema
-- Выполните этот скрипт в Supabase SQL Editor

-- Включаем Row Level Security (можно отключить для разработки)
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Таблица игроков
CREATE TABLE IF NOT EXISTS players (
    wallet_address TEXT PRIMARY KEY,
    nickname TEXT,
    total_score INTEGER DEFAULT 0 NOT NULL,
    base_score INTEGER DEFAULT 0 NOT NULL,
    referral_score INTEGER DEFAULT 0 NOT NULL,
    transaction_count INTEGER DEFAULT 0 NOT NULL,
    total_volume DECIMAL DEFAULT 0 NOT NULL,
    referrer_wallet TEXT REFERENCES players(wallet_address),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица транзакций (для истории и аудита)
CREATE TABLE IF NOT EXISTS transactions (
    signature TEXT PRIMARY KEY,
    from_wallet TEXT NOT NULL,
    to_wallet TEXT NOT NULL,
    amount_lamports BIGINT NOT NULL,
    stink_earned INTEGER NOT NULL,
    block_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица достижений игроков
CREATE TABLE IF NOT EXISTS player_achievements (
    wallet_address TEXT NOT NULL REFERENCES players(wallet_address),
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (wallet_address, achievement_id)
);

-- Таблица определений достижений
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    category TEXT DEFAULT 'general',
    threshold INTEGER DEFAULT 1,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_players_total_score ON players(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions(from_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_player_achievements_wallet ON player_achievements(wallet_address);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at в таблице players
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Вставляем тестовые данные (можно удалить после тестирования)
INSERT INTO players (wallet_address, nickname, total_score, base_score, transaction_count, total_volume) 
VALUES 
    ('GarbAgeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'TrashKing', 5000, 5000, 25, 2.5),
    ('GarbAge2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'DumpsterDiver', 3500, 3500, 15, 1.8),
    ('GarbAge3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'WasteWizard', 2800, 2800, 12, 1.2)
ON CONFLICT (wallet_address) DO NOTHING;

-- Вставляем базовые достижения
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
    ('whale_1', 'Small Whale', 'Feed 1 GOR in a single transaction', '🐋', 'whale', 1),
    ('whale_5', 'Big Whale', 'Feed 5 GOR in a single transaction', '🐋', 'whale', 5),
    ('whale_10', 'Mega Whale', 'Feed 10 GOR in a single transaction', '🐋', 'whale', 10),
    ('volume_10', 'Volume Trader', 'Feed a total of 10 GOR', '📊', 'volume', 10),
    ('volume_50', 'High Volume', 'Feed a total of 50 GOR', '📈', 'volume', 50),
    ('volume_100', 'Volume King', 'Feed a total of 100 GOR', '💎', 'volume', 100),
    ('referral_1', 'Recruiter', 'Refer your first player', '👥', 'referral', 1),
    ('referral_5', 'Talent Scout', 'Refer 5 players', '🕵️', 'referral', 5),
    ('referral_10', 'Community Builder', 'Refer 10 players', '🏘️', 'referral', 10),
    ('top_10', 'Top 10', 'Reach top 10 on the leaderboard', '🥉', 'ranking', 10),
    ('top_3', 'Podium Finish', 'Reach top 3 on the leaderboard', '🥈', 'ranking', 3),
    ('king_of_heap', 'King of the Heap', 'Reach #1 on the leaderboard', '👑', 'ranking', 1)
ON CONFLICT (id) DO NOTHING;

-- Функция для проверки и разблокировки достижений
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
    
    -- Проверяем достижения по очкам
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
    
    -- Проверяем достижения по количеству транзакций
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
    
    -- Проверяем достижения по объему
    IF player_data.total_volume >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'volume_10'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_10');
        newly_unlocked := array_append(newly_unlocked, 'volume_10');
    END IF;
    
    IF player_data.total_volume >= 50 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'volume_50'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_50');
        newly_unlocked := array_append(newly_unlocked, 'volume_50');
    END IF;
    
    IF player_data.total_volume >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'volume_100'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'volume_100');
        newly_unlocked := array_append(newly_unlocked, 'volume_100');
    END IF;
    
    -- Проверяем достижения по рефералам
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
    
    -- Проверяем достижения по рангу
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
    
    -- Early bird достижение (первые 100 игроков)
    IF total_players <= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements WHERE wallet_address = p_wallet_address AND achievement_id = 'early_bird'
    ) THEN
        INSERT INTO player_achievements (wallet_address, achievement_id) VALUES (p_wallet_address, 'early_bird');
        newly_unlocked := array_append(newly_unlocked, 'early_bird');
    END IF;
    
    -- Возвращаем информацию о новых достижениях
    RETURN QUERY
    SELECT a.id, a.name, a.description, a.icon
    FROM achievements a
    WHERE a.id = ANY(newly_unlocked);
END;
$$ LANGUAGE plpgsql;

-- Политики Row Level Security (закомментированы для разработки)
-- Разкомментируйте для продакшена:

-- CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
-- CREATE POLICY "Players can update their own data" ON players FOR UPDATE USING (auth.jwt() ->> 'wallet_address' = wallet_address);
-- CREATE POLICY "Anyone can insert new players" ON players FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Transactions are viewable by everyone" ON transactions FOR SELECT USING (true);
-- CREATE POLICY "Only system can insert transactions" ON transactions FOR INSERT WITH CHECK (false); -- Только через service key

-- CREATE POLICY "Achievements are viewable by everyone" ON player_achievements FOR SELECT USING (true);
-- CREATE POLICY "Only system can manage achievements" ON player_achievements FOR ALL WITH CHECK (false); -- Только через service key 