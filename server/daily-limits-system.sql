-- Система дневных лимитов для Gorba-Gluttons
-- Лимиты: 0.25 GOR в день, 10 транзакций в день
-- Сброс в полночь UTC

-- Таблица для отслеживания дневного использования
CREATE TABLE IF NOT EXISTS daily_limits (
    wallet_address TEXT NOT NULL REFERENCES players(wallet_address),
    limit_date DATE NOT NULL,
    volume_spent DECIMAL(10,4) DEFAULT 0,
    transactions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (wallet_address, limit_date)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_daily_limits_wallet ON daily_limits(wallet_address);
CREATE INDEX IF NOT EXISTS idx_daily_limits_date ON daily_limits(limit_date);

-- Константы лимитов
CREATE OR REPLACE FUNCTION get_daily_limits() 
RETURNS TABLE(max_volume DECIMAL, max_transactions INTEGER) AS $$
BEGIN
    RETURN QUERY SELECT 0.25::DECIMAL, 10::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения использования за сегодня
CREATE OR REPLACE FUNCTION get_daily_usage(
    p_wallet_address TEXT
) RETURNS TABLE(
    volume_spent DECIMAL,
    transactions_count INTEGER,
    volume_left DECIMAL,
    transactions_left INTEGER
) AS $$
DECLARE
    today_date DATE;
    limits RECORD;
    usage RECORD;
BEGIN
    today_date := CURRENT_DATE;
    
    -- Получаем лимиты
    SELECT * INTO limits FROM get_daily_limits();
    
    -- Получаем текущее использование
    SELECT 
        COALESCE(dl.volume_spent, 0) as spent_volume,
        COALESCE(dl.transactions_count, 0) as spent_transactions
    INTO usage
    FROM daily_limits dl
    WHERE dl.wallet_address = p_wallet_address 
      AND dl.limit_date = today_date;
    
    -- Если записи нет, создаем с нулевыми значениями
    IF NOT FOUND THEN
        usage.spent_volume := 0;
        usage.spent_transactions := 0;
    END IF;
    
    RETURN QUERY SELECT
        usage.spent_volume,
        usage.spent_transactions,
        GREATEST(0, limits.max_volume - usage.spent_volume),
        GREATEST(0, limits.max_transactions - usage.spent_transactions);
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки возможности транзакции
CREATE OR REPLACE FUNCTION check_daily_limits(
    p_wallet_address TEXT,
    p_amount_gor DECIMAL
) RETURNS TABLE(
    can_transact BOOLEAN,
    reason TEXT,
    volume_left DECIMAL,
    transactions_left INTEGER
) AS $$
DECLARE
    usage RECORD;
BEGIN
    -- Получаем текущее использование
    SELECT * INTO usage FROM get_daily_usage(p_wallet_address);
    
    -- Проверяем лимит по объему
    IF usage.volume_left < p_amount_gor THEN
        RETURN QUERY SELECT 
            FALSE,
            'Daily volume limit exceeded',
            usage.volume_left,
            usage.transactions_left;
        RETURN;
    END IF;
    
    -- Проверяем лимит по количеству транзакций
    IF usage.transactions_left <= 0 THEN
        RETURN QUERY SELECT 
            FALSE,
            'Daily transaction limit exceeded',
            usage.volume_left,
            usage.transactions_left;
        RETURN;
    END IF;
    
    -- Все проверки пройдены
    RETURN QUERY SELECT 
        TRUE,
        'Transaction allowed',
        usage.volume_left - p_amount_gor,
        usage.transactions_left - 1;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления использования после транзакции
CREATE OR REPLACE FUNCTION update_daily_usage(
    p_wallet_address TEXT,
    p_amount_gor DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    today_date DATE;
BEGIN
    today_date := CURRENT_DATE;
    
    -- Обновляем или создаем запись
    INSERT INTO daily_limits (wallet_address, limit_date, volume_spent, transactions_count, updated_at)
    VALUES (p_wallet_address, today_date, p_amount_gor, 1, NOW())
    ON CONFLICT (wallet_address, limit_date)
    DO UPDATE SET
        volume_spent = daily_limits.volume_spent + p_amount_gor,
        transactions_count = daily_limits.transactions_count + 1,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для очистки старых записей (можно запускать раз в неделю)
CREATE OR REPLACE FUNCTION cleanup_old_daily_limits() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM daily_limits 
    WHERE limit_date < CURRENT_DATE - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql; 