-- Пересчет всех очков игроков по новой формуле
-- Старая формула: (transaction_count * 100) + (total_volume * 1000)
-- Новая формула: (transaction_count * 50) + (total_volume * 400)

-- Создаем функцию для пересчета очков по новой формуле
CREATE OR REPLACE FUNCTION recalculate_player_scores_new_formula()
RETURNS TEXT AS $$
DECLARE
    player_record RECORD;
    new_base_score INTEGER;
    new_total_score INTEGER;
    updated_count INTEGER := 0;
BEGIN
    -- Проходим по всем игрокам
    FOR player_record IN 
        SELECT wallet_address, transaction_count, total_volume, referral_score
        FROM players
    LOOP
        -- Рассчитываем новый base_score по новой формуле
        new_base_score := (player_record.transaction_count * 50) + 
                         (player_record.total_volume * 400);
        
        -- Рассчитываем новый total_score (base + referral)
        new_total_score := new_base_score + COALESCE(player_record.referral_score, 0);
        
        -- Обновляем игрока
        UPDATE players 
        SET 
            base_score = new_base_score,
            total_score = new_total_score,
            updated_at = NOW()
        WHERE wallet_address = player_record.wallet_address;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN 'Updated ' || updated_count || ' players with new score formula';
END;
$$ LANGUAGE plpgsql;

-- Также пересчитываем stink_earned в таблице транзакций
CREATE OR REPLACE FUNCTION recalculate_transaction_scores()
RETURNS TEXT AS $$
DECLARE
    transaction_record RECORD;
    new_stink_earned INTEGER;
    updated_count INTEGER := 0;
BEGIN
    -- Проходим по всем транзакциям
    FOR transaction_record IN 
        SELECT signature, amount_lamports
        FROM transactions
    LOOP
        -- Рассчитываем новый stink_earned по новой формуле
        -- 50 очков за транзакцию + 400 * amount_in_sol
        new_stink_earned := 50 + (400 * (transaction_record.amount_lamports::DECIMAL / 1000000000));
        
        -- Обновляем транзакцию
        UPDATE transactions 
        SET stink_earned = new_stink_earned
        WHERE signature = transaction_record.signature;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN 'Updated ' || updated_count || ' transactions with new stink_earned values';
END;
$$ LANGUAGE plpgsql;

-- Выполняем пересчет
SELECT recalculate_player_scores_new_formula();
SELECT recalculate_transaction_scores();

-- Проверяем результат
SELECT 
    'Before update' as status,
    COUNT(*) as player_count,
    SUM(total_score) as total_scores,
    AVG(total_score) as avg_score
FROM players
WHERE updated_at < NOW() - INTERVAL '1 minute'

UNION ALL

SELECT 
    'After update' as status,
    COUNT(*) as player_count,
    SUM(total_score) as total_scores,
    AVG(total_score) as avg_score
FROM players
WHERE updated_at >= NOW() - INTERVAL '1 minute';

-- Удаляем временные функции
DROP FUNCTION IF EXISTS recalculate_player_scores_new_formula();
DROP FUNCTION IF EXISTS recalculate_transaction_scores(); 