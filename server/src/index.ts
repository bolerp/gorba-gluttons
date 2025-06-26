import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes';
import { gameLogger } from './logger';

// Загружаем переменные окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const whitelist = [
  'http://localhost:3000',
  'https://gorba.xyz',
  'https://www.gorba.xyz'
];

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Базовые роуты
app.get('/', (req, res) => {
  res.json({ 
    message: 'Gorba-Gluttons Server is running! 🗑️',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      leaderboard: '/api/leaderboard',
      stats: '/api/stats',
      player: '/api/player/:walletAddress',
      feed: 'POST /api/feed'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'gorba-gluttons-server',
    version: '1.0.0',
    environment: {
      supabase: !!process.env.SUPABASE_URL,
      gorbagana_rpc: !!process.env.GORBAGANA_RPC_URL,
      trash_can: !!process.env.TRASH_CAN_ADDRESS
    }
  });
});

// API роуты
app.use('/api', apiRoutes);

// Запускаем сервер
app.listen(PORT, () => {
  gameLogger.startup(Number(PORT));
});

export default app; 