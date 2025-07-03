# 🗑️ Gorba-Gluttons Server

Backend для игры Gorba-Gluttons - простой и надежный сервер на Node.js + Supabase.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка Supabase

1. Создайте новый проект на [supabase.com](https://supabase.com)
2. Перейдите в SQL Editor 
3. Выполните скрипт из файла `supabase-schema.sql`
4. Скопируйте URL проекта и Service Role Key

### 3. Настройка переменных окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Заполните переменные:
```env
PORT=3001
SUPABASE_URL=https://ваш-проект.supabase.co
SUPABASE_SERVICE_KEY=ваш-service-role-key
GORBAGANA_RPC_URL=https://rpc.gorbagana.wtf
TRASH_CAN_ADDRESS=адрес-мусорного-кошелька
FRONTEND_URL=http://localhost:3000
```

### 4. Запуск сервера

Для разработки:
```bash
npm run dev
```

Для продакшена:
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Базовые
- `GET /` - Информация о сервере
- `GET /api/health` - Проверка здоровья

### Игровые
- `GET /api/leaderboard` - Лидерборд
- `GET /api/stats` - Статистика игры  
- `GET /api/player/:walletAddress` - Данные игрока
- `POST /api/player` - Создать/обновить игрока
- `POST /api/feed` - Записать транзакцию кормления

## 🛠 Архитектура

```
src/
├── index.ts          # Основной файл сервера
├── routes.ts         # API роуты
├── supabase.ts       # Работа с базой данных
└── types.ts          # TypeScript типы (будущее)
```

## 📊 Система очков

**Формула Stink Score:**
```
Stink = (Количество транзакций × 100) + (Объем в SOL × 1000)
```

**Пример:**
- 5 транзакций по 0.1 SOL = (5 × 100) + (0.5 × 1000) = 1000 очков

## 🔒 Безопасность

### Row Level Security (RLS)
В `supabase-schema.sql` есть политики безопасности. Для разработки они закомментированы, для продакшена - раскомментируйте.

### Переменные окружения
Никогда не коммитьте файл `.env`! Используйте только `env.example`.

## 🐛 Отладка

### Проверка подключения к Supabase
```bash
curl http://localhost:3001/api/health
```

### Проверка лидерборда
```bash
curl http://localhost:3001/api/leaderboard
```

### Тестирование API
```bash
# Создать игрока
curl -X POST http://localhost:3001/api/player \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "test123", "nickname": "TestPlayer"}'

# Записать кормление
curl -X POST http://localhost:3001/api/feed \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "test123", "transactionSignature": "sig123", "amountSol": 0.1}'
```

## 🔄 Следующие шаги

1. ✅ Базовый сервер
2. ✅ Supabase интеграция  
3. ✅ API эндпоинты
4. 🔲 Реферальная система
5. 🔲 Достижения
6. 🔲 Блокчейн индексатор
7. 🔲 Real-time обновления

## 📝 Система логирования

Сервер использует продвинутую систему логирования с автоматической ротацией файлов:

### Настройки
- `LOG_LEVEL` - уровень логирования (error, warn, info, debug)
- `NODE_ENV` - режим работы (development показывает логи в консоли)

### Файлы логов
- `logs/application-YYYY-MM-DD.log` - все логи (макс 5MB, 14 дней)
- `logs/error-YYYY-MM-DD.log` - только ошибки (макс 5MB, 30 дней)

### Уровни логирования
- **ERROR** - критические ошибки (база данных, API)
- **WARN** - предупреждения (исчерпание лимитов, некритичные ошибки)
- **INFO** - важные события (достижения, рефанды, старт сервера)
- **DEBUG** - детальная отладка (проверка достижений, кормления)

### Оптимизации против спама
- Лимиты логируются только при критичном состоянии (≤0.05 GOR, ≤2 транзакции)
- Предупреждения о лимитах не чаще раза в час на кошелек
- Адреса кошельков сокращены до 8 символов для конфиденциальности
- Автоматическая ротация файлов по размеру (5MB) и времени

## 🚨 Возможные проблемы

### "Missing Supabase configuration"
- Проверьте файл `.env`
- Убедитесь что переменные `SUPABASE_URL` и `SUPABASE_SERVICE_KEY` заполнены

### "Error fetching leaderboard" 
- Убедитесь что SQL схема выполнена в Supabase
- Проверьте что таблица `players` создана

### CORS ошибки
- Обновите `FRONTEND_URL` в `.env`
- Проверьте что фронтенд запущен на правильном порту

---

🗑️ **Добро пожаловать в мусорную экосистему Gorbagana!** 