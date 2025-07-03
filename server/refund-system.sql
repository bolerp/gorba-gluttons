-- Система рефанда для Gorba-Gluttons
-- Позволяет игрокам запрашивать возврат 90% от потраченного вчера GOR

-- Таблица запросов на рефанд
CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES players(wallet_address),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculation_date DATE NOT NULL, -- За какой день считали (вчера)
    yesterday_volume DECIMAL(10,4) NOT NULL, -- Сколько потратил вчера GOR
    refund_amount DECIMAL(10,4) NOT NULL, -- 90% от yesterday_volume
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT, -- Заметки администратора
    
    -- Один запрос в день на игрока
    UNIQUE(wallet_address, calculation_date)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_refund_requests_wallet ON refund_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_date ON refund_requests(calculation_date);

-- Функция для расчета объема транзакций за определенный день
CREATE OR REPLACE FUNCTION calculate_daily_volume(
    p_wallet_address TEXT,
    p_date DATE
) RETURNS DECIMAL AS $$
DECLARE
    daily_volume DECIMAL := 0;
BEGIN
    -- Суммируем все транзакции игрока за указанный день
    SELECT COALESCE(SUM(amount_lamports / 1000000000.0), 0) INTO daily_volume
    FROM transactions
    WHERE from_wallet = p_wallet_address
      AND DATE(created_at) = p_date;
    
    RETURN daily_volume;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания запроса на рефанд
CREATE OR REPLACE FUNCTION request_refund(
    p_wallet_address TEXT
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    yesterday_volume DECIMAL,
    refund_amount DECIMAL,
    calculation_date DATE
) AS $$
DECLARE
    yesterday_date DATE;
    daily_volume DECIMAL;
    refund_amount DECIMAL;
    existing_request RECORD;
BEGIN
    -- Определяем вчерашний день
    yesterday_date := CURRENT_DATE - INTERVAL '1 day';
    
    -- Проверяем, нет ли уже запроса за вчерашний день
    SELECT * INTO existing_request
    FROM refund_requests 
    WHERE wallet_address = p_wallet_address 
      AND calculation_date = yesterday_date;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            FALSE as success,
            'You already requested refund for yesterday' as message,
            existing_request.yesterday_volume,
            existing_request.refund_amount,
            existing_request.calculation_date;
        RETURN;
    END IF;
    
    -- Рассчитываем объем за вчера
    daily_volume := calculate_daily_volume(p_wallet_address, yesterday_date);
    
    -- Проверяем что есть что возвращать
    IF daily_volume <= 0 THEN
        RETURN QUERY SELECT 
            FALSE as success,
            'No transactions found for yesterday' as message,
            daily_volume,
            0::DECIMAL,
            yesterday_date;
        RETURN;
    END IF;
    
    -- Рассчитываем сумму рефанда (90%)
    refund_amount := ROUND(daily_volume * 0.9, 4);
    
    -- Создаем запрос на рефанд
    INSERT INTO refund_requests (
        wallet_address,
        calculation_date,
        yesterday_volume,
        refund_amount
    ) VALUES (
        p_wallet_address,
        yesterday_date,
        daily_volume,
        refund_amount
    );
    
    RETURN QUERY SELECT 
        TRUE as success,
        'Refund request created successfully' as message,
        daily_volume,
        refund_amount,
        yesterday_date;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки возможности запроса рефанда
CREATE OR REPLACE FUNCTION can_request_refund(
    p_wallet_address TEXT
) RETURNS TABLE(
    can_request BOOLEAN,
    reason TEXT,
    yesterday_volume DECIMAL,
    potential_refund DECIMAL,
    last_request_date DATE
) AS $$
DECLARE
    yesterday_date DATE;
    daily_volume DECIMAL;
    existing_request DATE;
BEGIN
    yesterday_date := CURRENT_DATE - INTERVAL '1 day';
    
    -- Проверяем последний запрос
    SELECT calculation_date INTO existing_request
    FROM refund_requests 
    WHERE wallet_address = p_wallet_address 
      AND calculation_date = yesterday_date;
    
    -- Рассчитываем объем за вчера
    daily_volume := calculate_daily_volume(p_wallet_address, yesterday_date);
    
    IF existing_request IS NOT NULL THEN
        RETURN QUERY SELECT 
            FALSE,
            'Already requested for yesterday',
            daily_volume,
            0::DECIMAL,
            existing_request;
    ELSIF daily_volume <= 0 THEN
        RETURN QUERY SELECT 
            FALSE,
            'No transactions yesterday',
            daily_volume,
            0::DECIMAL,
            existing_request;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            'Can request refund',
            daily_volume,
            ROUND(daily_volume * 0.9, 4),
            existing_request;
    END IF;
END;
$$ LANGUAGE plpgsql; 