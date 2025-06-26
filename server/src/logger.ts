import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Уровень логирования из переменных окружения
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // error, warn, info, debug

// Форматирование для консоли (цветное)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info: any) => {
    const { timestamp, level, message, ...meta } = info as any;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Форматирование для файлов (без цветов)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info: any) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

// Ротация файлов для всех логов
const allLogsRotate = new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '5m', // 5 мегабайт
  maxFiles: '14d', // храним 14 дней
  format: fileFormat,
  level: LOG_LEVEL
});

// Ротация файлов только для ошибок
const errorLogsRotate = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '5m',
  maxFiles: '30d', // ошибки храним дольше
  format: fileFormat,
  level: 'error'
});

// Создаем основной логгер
const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    // Консоль (только в development)
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat,
        level: LOG_LEVEL
      })
    ] : []),
    
    // Файлы (всегда)
    allLogsRotate,
    errorLogsRotate
  ],
});

// Специальные методы для игровых событий
export const gameLogger = {
  // Достижения (только важные)
  achievement: (walletAddress: string, achievements: string[]) => {
    if (achievements.length > 0) {
      logger.info(`🏆 ${achievements.length} achievements for ${walletAddress.slice(0,8)}...`, { 
        wallet: walletAddress.slice(0,8),
        achievements: achievements.length,
        names: achievements
      });
    }
  },

  // Рефералы
  referral: (action: string, data: any) => {
    logger.info(`🔄 ${action}`, data);
  },

  // Рефанды
  refund: (walletAddress: string, amount: number) => {
    logger.warn(`💰 Refund requested: ${amount} GOR`, { 
      wallet: walletAddress.slice(0,8),
      amount 
    });
  },

  // Критичные лимиты
  limitExhausted: (walletAddress: string) => {
    logger.warn(`🚨 Daily limits exhausted`, { 
      wallet: walletAddress.slice(0,8) 
    });
  },

  // Кормление (только статистика)
  feed: (walletAddress: string, amount: number, newScore: number) => {
    logger.debug(`🍽️ Feed`, { 
      wallet: walletAddress.slice(0,8),
      amount,
      newScore
    });
  },

  // Старт сервера
  startup: (port: number) => {
    logger.info(`🗑️ Gorba-Gluttons Server running on port ${port}`);
    logger.info(`📡 Health check: http://localhost:${port}/api/health`);
    logger.info(`🏆 Leaderboard: http://localhost:${port}/api/leaderboard`);
  }
};

export default logger; 