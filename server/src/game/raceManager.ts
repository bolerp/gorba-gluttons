import { Server as SocketIOServer, Socket } from 'socket.io';
import { supabase } from '../supabase';
import { verifyPayment, ENTRY_FEE_LAMPORTS, sendPrizes } from '../blockchain';

// Types for race system
interface Player {
  id: string;
  socket: Socket;
  walletAddress: string;
  username: string;
  position: PlayerPosition;
  isAlive: boolean;
  score: number;
  finished: boolean;
  arena: string;
}

interface PlayerPosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Race {
  id: string;
  players: Map<string, Player>;
  status: 'waiting' | 'starting' | 'active' | 'finished';
  startTime: number;
  duration: number; // Race duration in milliseconds
  maxPlayers: number;
  mode: 'race' | 'survival';
  seed: string;
  bankLamports: number; // prize pool collected from entry fees
}

class RaceManager {
  private io: SocketIOServer;
  private waitingPlayers: Map<string, Player[]> = new Map(); // Separate queues by arena type
  private activeRaces: Map<string, Race> = new Map();
  private raceIdCounter = 0;
  private startTimers: Map<string, NodeJS.Timeout> = new Map(); // Separate timers by arena type
  private usedPaymentSignatures: Set<string> = new Set();

  // Game configuration
  private static readonly MIN_PLAYERS = 2;  // Минимум для старта таймера
  private static readonly MAX_PLAYERS = 4;  // Максимум игроков
  private static readonly WAITING_TIME = 15; // Секунд ожидания дополнительных игроков
  private static readonly COUNTDOWN_TIME = 3; // Секунд обратного отсчета
  private static readonly RACE_DURATION = 60; // Секунд на гонку

  // Entry fee per arena (lamports)
  private static readonly ENTRY_FEE_MAP: Record<string, number> = {
    bronze: ENTRY_FEE_LAMPORTS,
    silver: ENTRY_FEE_LAMPORTS * 2,   // 0.1 GOR if bronze = 0.05
    gold: ENTRY_FEE_LAMPORTS * 5      // 0.25 GOR
  };

  constructor(io: SocketIOServer) {
    this.io = io;
    
    // Initialize arena queues
    this.waitingPlayers.set('bronze', []);
    this.waitingPlayers.set('silver', []);
    this.waitingPlayers.set('gold', []);
    
    this.setupSocketHandlers();
    console.log('🏁 Race Manager initialized with arena separation');
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🎮 Player connected: ${socket.id}`);

      // Handle player joining race queue (requires on-chain payment)
      socket.on('join-race', async (data: { walletAddress: string; username?: string; arena?: string; paymentSig: string }) => {
        await this.handleJoinRace(socket, data);
      });

      // Handle player position updates during race
      socket.on('player-position', (position: PlayerPosition) => {
        this.handlePlayerPosition(socket, position);
      });

      // Handle player score updates
      socket.on('player-score', (score: number) => {
        this.handlePlayerScore(socket, score);
      });

      // Handle player death/game over
      socket.on('player-died', () => {
        this.handlePlayerDied(socket);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handlePlayerDisconnect(socket);
      });

      // Handle leave race
      socket.on('leave-race', () => {
        this.handleLeaveRace(socket);
      });

      // Handle room stats request
      socket.on('get-room-stats', () => {
        const stats = this.getRaceStats();
        socket.emit('room-stats', stats);
      });
    });
  }

  private async handleJoinRace(socket: Socket, data: { walletAddress: string; username?: string; arena?: string; paymentSig?: string }) {
    try {
      // 1. Validate payment signature
      const { walletAddress, paymentSig } = data;
      const arena = data.arena || 'bronze';
      if (!paymentSig) {
        socket.emit('race-error', { message: 'Entry fee payment signature required' });
        return;
      }

      if (this.usedPaymentSignatures.has(paymentSig)) {
        socket.emit('race-error', { message: 'Payment signature already used' });
        return;
      }

      const isValidPayment = await verifyPayment(paymentSig, walletAddress);
      if (!isValidPayment) {
        socket.emit('race-error', { message: 'Invalid or insufficient entry fee payment' });
        return;
      }

      // Cache signature so it cannot be reused
      this.usedPaymentSignatures.add(paymentSig);

      // Remove player from existing races/queue
      this.removePlayerFromAll(socket.id);

      const player: Player = {
        id: socket.id,
        socket,
        walletAddress: data.walletAddress,
        username: data.username || 'Anonymous',
        position: { x: 225, y: 500, vx: 0, vy: 0 },
        isAlive: true,
        score: 0,
        finished: false,
        arena
      };

      const queue = this.waitingPlayers.get(arena) || [];
      queue.push(player);
      this.waitingPlayers.set(arena, queue);
      
      console.log(`🏁 Player ${data.walletAddress.slice(0,8)} joined ${arena} arena queue. Queue: ${queue.length}/${RaceManager.MAX_PLAYERS}`);

      // Уведомляем игрока о присоединении к очереди
      socket.emit('race-queue-joined', {
        position: queue.length,
        totalPlayers: queue.length,
        maxPlayers: RaceManager.MAX_PLAYERS,
        arena: arena
      });

      // Обновляем позиции всех игроков в очереди
      this.broadcastQueueUpdate(arena);

      // Рассылаем обновленную статистику всем
      this.broadcastRoomStats();

      // Try to start a race if we have enough players
      this.tryStartRace(arena);

    } catch (error) {
      console.error('❌ Error handling join race:', error);
      socket.emit('race-error', { message: 'Failed to join race' });
    }
  }

  private tryStartRace(arena: string) {
    const queue = this.waitingPlayers.get(arena) || [];
    
    // Достигли максимума — стартуем сразу
    if (queue.length >= RaceManager.MAX_PLAYERS) {
      this.clearWaitingTimer(arena);
      const racePlayers = queue.splice(0, RaceManager.MAX_PLAYERS);
      this.startRace(racePlayers, arena);
      return;
    }

    // Если игроков ≥ MIN_PLAYERS, перезапускаем таймер кажлый раз (B-поведение)
    if (queue.length >= RaceManager.MIN_PLAYERS) {
      this.clearWaitingTimer(arena); // сбрасываем предыдущий, если был
      this.startWaitingTimer(arena); // запускаем заново 15 сек для всех
    }
  }

  private startWaitingTimer(arena: string) {
    console.log(`⏱️ Starting waiting timer for ${RaceManager.WAITING_TIME} seconds...`);
    
    const queue = this.waitingPlayers.get(arena) || [];
    
    // Уведомляем всех игроков о начале ожидания
    this.broadcastToWaiting(arena, 'waiting-timer-started', {
      waitingTime: RaceManager.WAITING_TIME,
      currentPlayers: queue.length,
      maxPlayers: RaceManager.MAX_PLAYERS
    });

    const timer = setTimeout(() => {
      console.log(`⏰ Waiting timer expired, starting race with ${queue.length} players`);
      const racePlayers = queue.splice(0, RaceManager.MAX_PLAYERS);
      if (racePlayers.length > 0) {
        this.startRace(racePlayers, arena);
      }
      this.startTimers.delete(arena);
    }, RaceManager.WAITING_TIME * 1000);
    
    this.startTimers.set(arena, timer);
  }

  private clearWaitingTimer(arena: string) {
    const timer = this.startTimers.get(arena);
    if (timer) {
      clearTimeout(timer);
      this.startTimers.delete(arena);
      console.log('⏹️ Waiting timer cleared');
    }
  }

  private broadcastToWaiting(arena: string, event: string, data: any) {
    this.waitingPlayers.get(arena)?.forEach(player => {
      player.socket.emit(event, data);
    });
  }

  private broadcastQueueUpdate(arena: string) {
    this.waitingPlayers.get(arena)?.forEach((player, index) => {
      player.socket.emit('queue-updated', {
        position: index + 1,
        totalPlayers: this.waitingPlayers.get(arena)?.length,
        maxPlayers: RaceManager.MAX_PLAYERS,
        players: this.waitingPlayers.get(arena)?.map((p, i) => ({
          id: p.id,
          username: p.username,
          walletAddress: p.walletAddress,
          position: i + 1,
          isYou: p.id === player.id
        }))
      });
    });
  }

  private startRace(players: Player[], arena: string) {
    const raceId = `race_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const seed = Math.random().toString(36).substring(2,10);
    const entryFeeLamports = RaceManager.ENTRY_FEE_MAP[arena] || ENTRY_FEE_LAMPORTS;
    const bankLamports = players.length * entryFeeLamports;
    const race: Race = {
      id: raceId,
      players: new Map(),
      status: 'starting',
      startTime: Date.now() + RaceManager.COUNTDOWN_TIME * 1000,
      duration: RaceManager.RACE_DURATION * 1000, // Convert to milliseconds
      maxPlayers: RaceManager.MAX_PLAYERS,
      mode: 'race',
      seed,
      bankLamports
    };

    // Add players to race
    players.forEach(player => {
      race.players.set(player.id, player);
      player.socket.join(raceId);
    });

    this.activeRaces.set(raceId, race);

    // Notify all players about race start
    this.io.to(raceId).emit('race-starting', {
      raceId,
      players: players.map(p => ({
        id: p.id,
        username: p.username,
        walletAddress: p.walletAddress
      })),
      countdown: RaceManager.COUNTDOWN_TIME * 1000,
      duration: race.duration,
      seed
    });

    console.log(`🚀 Race ${raceId} starting with ${players.length} players`);

    // Рассылаем обновленную статистику после старта гонки
    this.broadcastRoomStats();

    // Start countdown
    setTimeout(() => {
      this.activateRace(raceId);
    }, RaceManager.COUNTDOWN_TIME * 1000);

    // End race after duration
    setTimeout(() => {
      this.endRace(raceId);
    }, RaceManager.COUNTDOWN_TIME * 1000 + race.duration);
  }

  private activateRace(raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race) return;

    race.status = 'active';
    this.io.to(raceId).emit('race-started', {
      raceId,
      startTime: Date.now()
    });

    console.log(`⚡ Race ${raceId} activated`);
  }

  private async endRace(raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race) return;

    race.status = 'finished';

    // Generate mock scores for testing (in real game, scores come from player updates)
    const players = Array.from(race.players.values());
    players.forEach(player => {
      if (player.score === 0) {
        // Generate random score for testing
        player.score = Math.floor(Math.random() * 2000) + 500; // 500-2500 points
      }
    });

    const bank = race.bankLamports;
    const entryFeeLamports = bank / players.length;

    // Dynamic prize distribution by player count (house edge ≈10% stays in treasury)
    const distributionTable: Record<number, number[]> = {
      2: [0.9, 0.0],           // 90% / 0%
      3: [0.75, 0.15, 0.0],    // 75% / 15% / 0%
      4: [0.65, 0.20, 0.05, 0] // 65% / 20% / 5% / 0%
    };

    const percents = distributionTable[players.length] || distributionTable[4];

    const sortedPlayers = players.sort((a, b) => b.score - a.score);

    const results = sortedPlayers.map((player, index) => {
      const pct = percents[index] ?? 0;
      const prize = Math.floor(bank * pct);
      return {
        position: index + 1,
        playerId: player.id,
        username: player.username,
        walletAddress: player.walletAddress,
        score: player.score,
        isAlive: player.isAlive,
        prizeLamports: prize
      };
    });

    // Build payout list (skip prize=0)
    const payouts = results
      .filter(r => r.prizeLamports > 0)
      .map(r => ({ to: r.walletAddress, lamports: r.prizeLamports }));

    const payoutsSum = payouts.reduce((sum, p) => sum + p.lamports, 0);
    const houseEdgeLamports = bank - payoutsSum;

    let prizeTxSignature: string | null = null;
    try {
      prizeTxSignature = await sendPrizes(payouts);
      console.log(`💸 Prize payout tx: ${prizeTxSignature}`);
    } catch (err) {
      console.error('❌ Failed to send prize payouts', err);
    }

    // Save results to database
    await this.saveRaceResults(raceId, results, {
      prizeTxSignature,
      entryFeeLamports,
      bankLamports: bank,
      houseEdgeLamports
    });

    // Warn if house-edge слишком велик (> 10 % + 1 лампорт на округление)
    const expectedEdge = Math.floor(bank * 0.10) + 1;
    if (houseEdgeLamports > expectedEdge) {
      console.warn(`⚠️ House edge (${houseEdgeLamports}) exceeds expected (${expectedEdge}) in race ${raceId}`);
    }

    // Notify players of results and payout tx signature
    this.io.to(raceId).emit('race-finished', {
      raceId,
      results,
      duration: race.duration,
      prizeTxSignature
    });

    console.log(`🏆 Race ${raceId} finished. Winner: ${results[0]?.username} with score ${results[0]?.score}`);

    // Clean up
    this.activeRaces.delete(raceId);
    
    // Рассылаем обновленную статистику после завершения гонки
    this.broadcastRoomStats();
  }

  private handlePlayerPosition(socket: Socket, position: PlayerPosition) {
    const race = this.findPlayerRace(socket.id);
    if (!race || race.status !== 'active') return;

    const player = race.players.get(socket.id);
    if (!player || !player.isAlive) return;

    player.position = position;

    // Broadcast position to other players in the race
    socket.to(race.id).emit('opponent-position', {
      playerId: socket.id,
      position,
      username: player.username
    });
  }

  private handlePlayerScore(socket: Socket, score: number) {
    const race = this.findPlayerRace(socket.id);
    if (!race || race.status !== 'active') return;

    const player = race.players.get(socket.id);
    if (!player || !player.isAlive) return;

    player.score = score;

    // Broadcast score update to race
    this.io.to(race.id).emit('score-update', {
      playerId: socket.id,
      username: player.username,
      score
    });
  }

  private handlePlayerDied(socket: Socket) {
    const race = this.findPlayerRace(socket.id);
    if (!race) return;

    const player = race.players.get(socket.id);
    if (!player) return;

    player.isAlive = false;

    // Notify other players
    socket.to(race.id).emit('player-died', {
      playerId: socket.id,
      username: player.username,
      finalScore: player.score
    });

    console.log(`💀 Player ${player.username} died in race ${race.id} with score ${player.score}`);

    // If every player in the race is dead, finish early
    const allDead = Array.from(race.players.values()).every(p => !p.isAlive);
    if (allDead && race.status === 'active') {
      this.endRace(race.id);
    }
  }

  private handlePlayerDisconnect(socket: Socket) {
    this.removePlayerFromAll(socket.id);
    console.log(`🚪 Player disconnected: ${socket.id}`);
  }

  private handleLeaveRace(socket: Socket) {
    this.removePlayerFromAll(socket.id);
    socket.emit('race-left');
    console.log(`🚪 Player left race: ${socket.id}`);
  }

  private removePlayerFromAll(playerId: string) {
    // Remove from all waiting queues
    let foundInQueue = false;
    let removedFromArena = '';
    
    for (const [arena, queue] of this.waitingPlayers.entries()) {
      const oldQueueLength = queue.length;
      const newQueue = queue.filter(p => p.id !== playerId);
      
      if (oldQueueLength !== newQueue.length) {
        foundInQueue = true;
        removedFromArena = arena;
        this.waitingPlayers.set(arena, newQueue);
        
        console.log(`👤 Player removed from ${arena} queue. Queue: ${newQueue.length}/${RaceManager.MAX_PLAYERS}`);
        
        // Обновляем позиции в очереди для оставшихся игроков
        this.broadcastQueueUpdate(arena);

        // Рассылаем обновленную статистику после выхода игрока
        this.broadcastRoomStats();

        // Если игроков стало меньше минимума, отменяем таймер
        if (newQueue.length < RaceManager.MIN_PLAYERS) {
          this.clearWaitingTimer(arena);
          // Уведомляем оставшихся игроков что таймер отменен
          this.broadcastToWaiting(arena, 'waiting-timer-cancelled', {
            reason: 'Not enough players',
            currentPlayers: newQueue.length,
            minPlayers: RaceManager.MIN_PLAYERS
          });
          console.log(`⏹️ Not enough players for ${arena} race, timer cancelled`);
        }
        break; // Player can only be in one queue
      }
    }

    // Remove from active races
    this.activeRaces.forEach(race => {
      if (race.players.has(playerId)) {
        race.players.delete(playerId);
        
        // If race becomes empty, clean it up
        if (race.players.size === 0) {
          this.activeRaces.delete(race.id);
        }
      }
    });
  }

  private findPlayerRace(playerId: string): Race | null {
    for (const race of this.activeRaces.values()) {
      if (race.players.has(playerId)) {
        return race;
      }
    }
    return null;
  }

  private async saveRaceResults(raceId: string, results: any[], additionalData: any) {
    try {
      const { error } = await supabase
        .from('race_results')
        .insert({
          race_id: raceId,
          results: results,
          additional_data: additionalData,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Failed to save race results:', error);
      }
    } catch (error) {
      console.error('❌ Error saving race results:', error);
    }
  }

  // Public methods for getting race info
  public getRaceStats() {
    let totalWaitingPlayers = 0;
    for (const queue of this.waitingPlayers.values()) {
      totalWaitingPlayers += queue.length;
    }
    
    const totalActivePlayers = Array.from(this.activeRaces.values())
      .reduce((sum, race) => sum + race.players.size, 0);

    return {
      activeRaces: this.activeRaces.size,
      waitingPlayers: totalWaitingPlayers,
      totalPlayersOnline: totalWaitingPlayers + totalActivePlayers,
      arenaQueues: {
        bronze: this.waitingPlayers.get('bronze')?.length || 0,
        silver: this.waitingPlayers.get('silver')?.length || 0,
        gold: this.waitingPlayers.get('gold')?.length || 0
      }
    };
  }

  private broadcastRoomStats() {
    const stats = this.getRaceStats();
    this.io.emit('room-stats', stats);
    console.log('📊 Broadcasting room stats:', stats);
  }
}

let raceManager: RaceManager;

export function initializeRaceSystem(io: SocketIOServer) {
  raceManager = new RaceManager(io);
}

export function getRaceManager(): RaceManager {
  return raceManager;
} 