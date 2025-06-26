-- Двухуровневая реферальная система для Gorba-Gluttons
-- Выполните этот скрипт в Supabase SQL Editor

-- Создаем таблицу для отслеживания реферальных цепочек
CREATE TABLE IF NOT EXISTS referral_chain (
    id SERIAL PRIMARY KEY,
    referee_wallet TEXT NOT NULL REFERENCES players(wallet_address),
    referrer_level1 TEXT REFERENCES players(wallet_address), -- Прямой реферер (30%)
    referrer_level2 TEXT REFERENCES players(wallet_address), -- Реферер реферера (10%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(referee_wallet)
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_referral_chain_referee ON referral_chain(referee_wallet);
CREATE INDEX IF NOT EXISTS idx_referral_chain_level1 ON referral_chain(referrer_level1);
CREATE INDEX IF NOT EXISTS idx_referral_chain_level2 ON referral_chain(referrer_level2);

-- Функция для регистрации нового реферала с автоматическим построением цепочки
CREATE OR REPLACE FUNCTION register_referral(
    p_referee_wallet TEXT,
    p_referrer_wallet TEXT
) RETURNS VOID AS $$
DECLARE
    level2_referrer TEXT;
BEGIN
    -- Находим реферера второго уровня (реферера нашего реферера)
    SELECT referrer_level1 INTO level2_referrer
    FROM referral_chain 
    WHERE referee_wallet = p_referrer_wallet;
    
    -- Вставляем новую запись
    INSERT INTO referral_chain (referee_wallet, referrer_level1, referrer_level2)
    VALUES (p_referee_wallet, p_referrer_wallet, level2_referrer)
    ON CONFLICT (referee_wallet) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Функция для пересчета реферальных бонусов игрока
CREATE OR REPLACE FUNCTION calculate_referral_bonus(p_wallet TEXT) 
RETURNS INTEGER AS $$
DECLARE
    level1_bonus INTEGER := 0;
    level2_bonus INTEGER := 0;
    total_bonus INTEGER := 0;
BEGIN
    -- Бонус с рефералов 1-го уровня (30%)
    SELECT COALESCE(SUM(p.base_score * 0.3), 0)::INTEGER INTO level1_bonus
    FROM referral_chain rc
    JOIN players p ON p.wallet_address = rc.referee_wallet
    WHERE rc.referrer_level1 = p_wallet;
    
    -- Бонус с рефералов 2-го уровня (10%)
    SELECT COALESCE(SUM(p.base_score * 0.1), 0)::INTEGER INTO level2_bonus
    FROM referral_chain rc
    JOIN players p ON p.wallet_address = rc.referee_wallet
    WHERE rc.referrer_level2 = p_wallet;
    
    total_bonus := level1_bonus + level2_bonus;
    
    RETURN total_bonus;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения статистики рефералов игрока
CREATE OR REPLACE FUNCTION get_referral_stats(p_wallet TEXT)
RETURNS TABLE(
    level1_count INTEGER,
    level2_count INTEGER,
    total_bonus INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(CASE WHEN rc.referrer_level1 = p_wallet THEN 1 END)::INTEGER as level1_count,
        COUNT(CASE WHEN rc.referrer_level2 = p_wallet THEN 1 END)::INTEGER as level2_count,
        calculate_referral_bonus(p_wallet) as total_bonus
    FROM referral_chain rc;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления referral_score при изменении base_score
CREATE OR REPLACE FUNCTION update_all_referral_scores() 
RETURNS TRIGGER AS $$
DECLARE
    affected_referrer TEXT;
BEGIN
    -- Обновляем реферальные очки для всех кто получает бонус с этого игрока
    FOR affected_referrer IN 
        SELECT DISTINCT referrer_level1 
        FROM referral_chain 
        WHERE referee_wallet = NEW.wallet_address
        UNION
        SELECT DISTINCT referrer_level2 
        FROM referral_chain 
        WHERE referee_wallet = NEW.wallet_address
    LOOP
        IF affected_referrer IS NOT NULL THEN
            UPDATE players 
            SET referral_score = calculate_referral_bonus(affected_referrer),
                total_score = base_score + calculate_referral_bonus(affected_referrer)
            WHERE wallet_address = affected_referrer;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер
DROP TRIGGER IF EXISTS trigger_update_referral_scores ON players;
CREATE TRIGGER trigger_update_referral_scores
    AFTER UPDATE OF base_score ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_all_referral_scores();

-- Примеры использования (можно удалить после тестирования):

-- Зарегистрировать реферала
-- SELECT register_referral('player3_wallet', 'player1_wallet');

-- Получить статистику рефералов
-- SELECT * FROM get_referral_stats('player1_wallet'); 