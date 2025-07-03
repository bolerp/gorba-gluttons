-- Исправление функции get_daily_usage для правильного подсчета остатков

DROP FUNCTION IF EXISTS get_daily_usage(TEXT);

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
    max_volume DECIMAL := 0.25;
    max_transactions INTEGER := 10;
    current_volume DECIMAL := 0;
    current_count INTEGER := 0;
BEGIN
    today_date := CURRENT_DATE;
    
    -- Получаем текущее использование из таблицы daily_limits
    SELECT 
        COALESCE(dl.volume_spent, 0),
        COALESCE(dl.transactions_count, 0)
    INTO current_volume, current_count
    FROM daily_limits dl
    WHERE dl.wallet_address = p_wallet_address 
      AND dl.limit_date = today_date;
    
    -- Если записи нет, значит еще не тратил сегодня
    IF NOT FOUND THEN
        current_volume := 0;
        current_count := 0;
    END IF;
    
    -- Рассчитываем остатки
    RETURN QUERY SELECT
        current_volume as volume_spent,
        current_count as transactions_count,
        GREATEST(0, max_volume - current_volume) as volume_left,
        GREATEST(0, max_transactions - current_count) as transactions_left;
END;
$$ LANGUAGE plpgsql; 