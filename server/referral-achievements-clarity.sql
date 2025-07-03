-- Уточнение описаний реферальных достижений
-- Делает ясным что считаются только прямые рефералы

UPDATE achievements 
SET description = 'Refer your first direct player'
WHERE id = 'referral_1';

UPDATE achievements 
SET description = 'Refer 5 direct players'
WHERE id = 'referral_5';

UPDATE achievements 
SET description = 'Refer 10 direct players'
WHERE id = 'referral_10';

-- Опционально: можно изменить названия тоже
UPDATE achievements 
SET name = 'Direct Recruiter'
WHERE id = 'referral_1';

UPDATE achievements 
SET name = 'Direct Talent Scout'
WHERE id = 'referral_5';

UPDATE achievements 
SET name = 'Direct Community Builder'
WHERE id = 'referral_10'; 