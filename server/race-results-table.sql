-- Таблица для хранения результатов гонок (Race Mode)
CREATE TABLE IF NOT EXISTS race_results (
    id SERIAL PRIMARY KEY,
    race_id VARCHAR(50) NOT NULL UNIQUE,
    results JSONB NOT NULL, -- Массив результатов с позициями игроков
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Добавляем индексы для оптимизации
    INDEX idx_race_results_created_at (created_at),
    INDEX idx_race_results_race_id (race_id)
);

-- Комментарии к таблице
COMMENT ON TABLE race_results IS 'Результаты мультиплеерных гонок в Trash Tower Game';
COMMENT ON COLUMN race_results.race_id IS 'Уникальный идентификатор гонки';
COMMENT ON COLUMN race_results.results IS 'JSON массив с результатами: [{position, playerId, username, walletAddress, score, isAlive}]';

-- Пример структуры данных results:
/*
[
  {
    "position": 1,
    "playerId": "socket_id_1",
    "username": "Player1",
    "walletAddress": "ABC123...",
    "score": 15420,
    "isAlive": true
  },
  {
    "position": 2,
    "playerId": "socket_id_2", 
    "username": "Player2",
    "walletAddress": "DEF456...",
    "score": 12340,
    "isAlive": false
  }
]
*/ 