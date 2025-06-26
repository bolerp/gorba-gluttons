import { Achievement } from "@/types";

// Достижения теперь загружаются с сервера, этот файл оставляем для совместимости
export const ACHIEVEMENTS: Omit<Achievement, "unlocked">[] = [];

// Функция для получения прогресса достижения
export function getAchievementProgress(achievement: Achievement, playerData: any): { current: number; max: number; percentage: number } {
  let current = 0;
  const max = achievement.threshold;

  switch (achievement.category) {
    case 'score':
      current = Math.min(playerData?.stinkScore || 0, max);
      break;
    case 'feeding':
      current = Math.min(playerData?.transactionCount || 0, max);
      break;
    case 'volume':
      // Для volume показываем фактический объем с десятичными знаками
      current = playerData?.totalVolume || 0;
      break;
    case 'referral':
      current = Math.min(playerData?.referralCount || 0, max);
      break;
    case 'ranking':
      // Для рангов - если игрок в топе, то достижение выполнено
      current = (playerData?.rank && playerData.rank <= max) ? max : 0;
      break;
    case 'whale':
      // Для whale достижений - проверяем максимальную транзакцию
      current = (playerData?.maxTransaction && playerData.maxTransaction >= max) ? max : 0;
      break;
    case 'milestone':
      // Для milestone достижений (early bird) - автоматически
      current = achievement.unlocked ? max : 0;
      break;
    default:
      current = achievement.unlocked ? max : 0;
  }

  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  
  return { current, max, percentage };
} 