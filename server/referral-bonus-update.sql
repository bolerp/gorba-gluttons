-- Функция для принудительного пересчета и обновления реферальных бонусов
CREATE OR REPLACE FUNCTION recalculate_and_update_referral_bonus(p_wallet TEXT) 
RETURNS VOID AS $$
DECLARE
    new_referral_score INTEGER;
    old_total_score INTEGER;
    new_total_score INTEGER;
BEGIN
    -- Получаем текущий total_score
    SELECT total_score INTO old_total_score
    FROM players 
    WHERE wallet_address = p_wallet;
    
    -- Вычисляем новый реферальный бонус
    new_referral_score := calculate_referral_bonus(p_wallet);
    
    -- Обновляем referral_score и total_score
    UPDATE players 
    SET referral_score = new_referral_score,
        total_score = base_score + new_referral_score
    WHERE wallet_address = p_wallet
    RETURNING total_score INTO new_total_score;
    
    -- Если счет изменился значительно, можем добавить логирование
    IF ABS(new_total_score - COALESCE(old_total_score, 0)) > 0 THEN
        RAISE NOTICE 'Updated referral bonus for %: % -> %', p_wallet, old_total_score, new_total_score;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Функция для пересчета всех реферальных бонусов в системе
CREATE OR REPLACE FUNCTION recalculate_all_referral_bonuses() 
RETURNS VOID AS $$
DECLARE
    player_record RECORD;
BEGIN
    -- Обновляем всех игроков у которых есть рефералы
    FOR player_record IN 
        SELECT DISTINCT referrer_level1 as wallet
        FROM referral_chain 
        WHERE referrer_level1 IS NOT NULL
        UNION
        SELECT DISTINCT referrer_level2 as wallet
        FROM referral_chain 
        WHERE referrer_level2 IS NOT NULL
    LOOP
        PERFORM recalculate_and_update_referral_bonus(player_record.wallet);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Функция для полного пересчета всей реферальной цепочки при добавлении нового игрока
CREATE OR REPLACE FUNCTION update_referral_chain_bonuses(p_new_referee_wallet TEXT)
RETURNS VOID AS $$
DECLARE
    level1_referrer TEXT;
    level2_referrer TEXT;
BEGIN
    -- Получаем рефереров всех уровней для нового игрока
    SELECT referrer_level1, referrer_level2 INTO level1_referrer, level2_referrer
    FROM referral_chain 
    WHERE referee_wallet = p_new_referee_wallet;
    
    -- Пересчитываем бонусы для реферера 1-го уровня
    IF level1_referrer IS NOT NULL THEN
        PERFORM recalculate_and_update_referral_bonus(level1_referrer);
        RAISE NOTICE 'Updated level 1 referrer: %', level1_referrer;
    END IF;
    
    -- Пересчитываем бонусы для реферера 2-го уровня  
    IF level2_referrer IS NOT NULL THEN
        PERFORM recalculate_and_update_referral_bonus(level2_referrer);
        RAISE NOTICE 'Updated level 2 referrer: %', level2_referrer;
    END IF;
END;
$$ LANGUAGE plpgsql; 