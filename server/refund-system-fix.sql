-- Patch to fix ambiguous column reference in refund functions

-- Drop existing functions first
DROP FUNCTION IF EXISTS request_refund(TEXT);
DROP FUNCTION IF EXISTS can_request_refund(TEXT);

-- Fix request_refund function
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
    refund_amt DECIMAL;
    existing_request RECORD;
BEGIN
    yesterday_date := CURRENT_DATE - INTERVAL '1 day';

    -- Check existing request
    SELECT * INTO existing_request
    FROM refund_requests r
    WHERE r.wallet_address = p_wallet_address
      AND r.calculation_date = yesterday_date;

    IF FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            'You already requested refund for yesterday',
            existing_request.yesterday_volume,
            existing_request.refund_amount,
            existing_request.calculation_date;
        RETURN;
    END IF;

    -- Calculate yesterday volume
    daily_volume := calculate_daily_volume(p_wallet_address, yesterday_date);

    IF daily_volume <= 0 THEN
        RETURN QUERY SELECT
            FALSE,
            'No transactions found for yesterday',
            daily_volume,
            0::DECIMAL,
            yesterday_date;
        RETURN;
    END IF;

    refund_amt := ROUND(daily_volume * 0.9, 4);

    INSERT INTO refund_requests (wallet_address, calculation_date, yesterday_volume, refund_amount)
    VALUES (p_wallet_address, yesterday_date, daily_volume, refund_amt);

    RETURN QUERY SELECT TRUE, 'Refund request created successfully', daily_volume, refund_amt, yesterday_date;
END;
$$ LANGUAGE plpgsql;

-- Fix can_request_refund with status info
CREATE OR REPLACE FUNCTION can_request_refund(
    p_wallet_address TEXT
) RETURNS TABLE(
    can_request BOOLEAN,
    reason TEXT,
    yesterday_volume DECIMAL,
    potential_refund DECIMAL,
    last_request_date DATE,
    last_request_status TEXT,
    last_request_amount DECIMAL
) AS $$
DECLARE
    yesterday_date DATE;
    daily_volume DECIMAL;
    existing_request RECORD;
BEGIN
    yesterday_date := CURRENT_DATE - INTERVAL '1 day';

    SELECT r.calculation_date, r.status, r.refund_amount INTO existing_request
    FROM refund_requests r
    WHERE r.wallet_address = p_wallet_address
      AND r.calculation_date = yesterday_date;

    daily_volume := calculate_daily_volume(p_wallet_address, yesterday_date);

    IF existing_request.calculation_date IS NOT NULL THEN
        RETURN QUERY SELECT 
            FALSE, 
            'Already requested for yesterday', 
            daily_volume, 
            0::DECIMAL, 
            existing_request.calculation_date,
            existing_request.status,
            existing_request.refund_amount;
    ELSIF daily_volume <= 0 THEN
        RETURN QUERY SELECT 
            FALSE, 
            'No transactions yesterday', 
            daily_volume, 
            0::DECIMAL, 
            NULL::DATE,
            NULL::TEXT,
            NULL::DECIMAL;
    ELSE
        RETURN QUERY SELECT 
            TRUE, 
            'Can request refund', 
            daily_volume, 
            ROUND(daily_volume * 0.9, 4), 
            NULL::DATE,
            NULL::TEXT,
            NULL::DECIMAL;
    END IF;
END;
$$ LANGUAGE plpgsql; 