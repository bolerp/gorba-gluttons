"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import io, { Socket } from 'socket.io-client';
import TrashTowerGame from '@/components/games/TrashTowerGame';
import SkinShop from '@/components/SkinShop';
import { SystemProgram, Transaction, PublicKey, Connection as GConnection } from '@gorbagana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';

type RaceStatus = 'lobby' | 'waiting' | 'countdown' | 'active' | 'finished';
type League = 'bronze' | 'silver' | 'gold';

interface RoomInfo {
  league: League;
  entryFee: number;
  prizePool: number;
  players: number;
  maxPlayers: number;
  status: 'waiting' | 'starting' | 'full';
  startTime?: number;
}

interface PlayerResult {
  playerId: string;
  username: string;
  score: number;
  position: number;
  prize: number;
}

const tierConfig = {
  bronze: {
    name: 'Morning Rush',
    description: 'Start your day with energy!',
    entryFee: 0.05,
    gradient: 'from-orange-300 via-amber-400 to-yellow-300',
    glow: 'shadow-[0_0_30px_rgba(251,146,60,0.3)]',
    borderColor: 'border-orange-400/50',
    textColor: 'text-orange-100',
    monsterImage: '/race/morning_mon.png'
  },
  silver: {
    name: 'Midday Madness',
    description: 'Peak performance time!',
    entryFee: 0.1,
    gradient: 'from-blue-400 via-cyan-400 to-sky-300',
    glow: 'shadow-[0_0_30px_rgba(56,189,248,0.3)]',
    borderColor: 'border-sky-400/50',
    textColor: 'text-sky-100',
    monsterImage: '/race/day_mon.png'
  },
  gold: {
    name: 'Midnight Mania',
    description: 'Night owls unite!',
    entryFee: 0.25,
    gradient: 'from-purple-600 via-indigo-600 to-blue-700',
    glow: 'shadow-[0_0_30px_rgba(99,102,241,0.4)]',
    borderColor: 'border-indigo-400/50',
    textColor: 'text-indigo-100',
    monsterImage: '/race/night_mon.png'
  }
}

interface Room {
  id: string;
  name: string;
  entryFee: number;
  prizePool: number;
  maxPlayers: number;
  currentPlayers: number;
  status: 'waiting' | 'countdown' | 'active' | 'finished';
  tier: 'bronze' | 'silver' | 'gold';
}

interface GameState {
  status: 'lobby' | 'waiting' | 'countdown' | 'active' | 'finished';
  room?: Room;
  countdown?: number;
  players?: Array<{ 
    id: string;
    username: string;
    walletAddress: string;
    position: number;
    isYou: boolean;
  }>;
  results?: PlayerResult[];
  position?: number;
  totalPlayers?: number;
  maxPlayers?: number;
  waitingTime?: number; // Время ожидания в секундах
  timeLeft?: number; // Оставшееся время ожидания
  raceId?: string;
  seed?: string;
  prizeTxSignature?: string;
}

export default function RacePage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  // Game state
  const [socket, setSocket] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [nickname, setNickname] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({ status: 'lobby' });
  
  // Room data
  const [rooms, setRooms] = useState<Room[]>([
    {
      id: 'morning-1',
      name: 'Morning Rush Arena',
      entryFee: 0.05,
      prizePool: 0.45,
      maxPlayers: 4,
      currentPlayers: 0,
      status: 'waiting',
      tier: 'bronze'
    },
    {
      id: 'day-1', 
      name: 'Midday Madness Arena',
      entryFee: 0.1,
      prizePool: 0.9,
      maxPlayers: 4,
      currentPlayers: 0,
      status: 'waiting',
      tier: 'silver'
    },
    {
      id: 'night-1',
      name: 'Midnight Mania Arena', 
      entryFee: 0.25,
      prizePool: 2.25,
      maxPlayers: 4,
      currentPlayers: 0,
      status: 'waiting',
      tier: 'gold'
    }
  ]);
  
  // Race state
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [raceId, setRaceId] = useState('');
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [myResult, setMyResult] = useState<PlayerResult | null>(null);

  // ref для хранения интервала ожидания
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load balance
  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    
    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/balance?address=${publicKey.toBase58()}`);
        if (res.ok) {
          const { balance: bal } = await res.json();
          if (!cancelled) {
            setBalance(Math.round(bal * 1000) / 1000);
          }
        }
      } catch (e) {
        console.error('Failed to fetch balance:', e);
      }
    };
    
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicKey]);

  // Fetch nickname once on wallet connect
  useEffect(() => {
    if (!publicKey) {
      setNickname(null);
      return;
    }
    const backend = ((process.env.NEXT_PUBLIC_API_URL as string)?.replace(/\/?api$/, '')) || 'http://localhost:3001';
    fetch(`${backend}/api/player/${publicKey.toBase58()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.nickname) {
          setNickname(data.nickname);
          try { localStorage.setItem('gorba_nick', data.nickname); } catch {}
        } else {
          setNickname(null);
        }
      })
      .catch(() => setNickname(null));
  }, [publicKey]);

  // WebSocket connection to race server
  useEffect(() => {
    if (!publicKey) return

    // Build Socket.io endpoint from env vars (works in dev & production)
    const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL as string) ||
      ((process.env.NEXT_PUBLIC_API_URL as string)?.replace(/\/?api$/, '') ?? 'http://localhost:3001');

    const socketConnection = io(SOCKET_URL, { transports: ['websocket'] })
    
    socketConnection.on('connect', () => {
      console.log('🏁 Connected to race server')
      setConnected(true)
      setSocket(socketConnection)
    })

    socketConnection.on('disconnect', () => {
      console.log('🚪 Disconnected from race server')
      setConnected(false)
      setSocket(null)
    })

    // Race event handlers
    socketConnection.on('race-queue-joined', (data: any) => {
      console.log('🏁 Joined race queue:', data)
      setGameState(prev => ({
        ...prev,
        status: 'waiting'
      }));
    })

    socketConnection.on('race-starting', (data: any) => {
      console.log('🚀 Race starting:', data)
      
      // Очищаем интервал таймера при старте гонки
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setGameState(prev => ({
        ...prev,
        status: 'countdown',
        raceId: data.raceId,
        seed: data.seed,
        countdown: 3,
        timeLeft: undefined,
        waitingTime: undefined
      }));
      
      // Start countdown from 3 to 1
      let countdownValue = 3;
      const countdownInterval = setInterval(() => {
        countdownValue -= 1;
        setGameState(prev => ({
          ...prev,
          countdown: countdownValue
        }));
        
        if (countdownValue <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
    })

    socketConnection.on('race-started', (data: any) => {
      console.log('⚡ Race started:', data)
      setGameState(prev => ({
        ...prev,
        status: 'active'
      }));
    })

    socketConnection.on('race-finished', (data: any) => {
      console.log('🏆 Race finished:', data);

      const txSig = data.prizeTxSignature as string | undefined;

      const processed = (data.results || []).map((r: any) => ({
        ...r,
        prize: (r.prizeLamports || 0) / 1_000_000_000
      }));

      const myRes = processed.find((r: any) => r.playerId === socketConnection.id);

      setResults(processed);
      setMyResult(myRes || null);
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        results: processed,
        prizeTxSignature: txSig
      }));
    })

    socketConnection.on('race-error', (error: any) => {
      console.error('❌ Race error:', error)
      alert(error.message)
    })

    socketConnection.on('race-left', () => {
      console.log('🚪 Left race successfully')
      
      // Очищаем интервал таймера при выходе из комнаты
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setGameState({ status: 'lobby' });
    })

    // Get real room stats from server
    const updateRoomStats = () => {
      socketConnection.emit('get-room-stats')
    }

    socketConnection.on('room-stats', (stats: any) => {
      console.log('📊 Room stats:', stats)
      // Update rooms with real data from specific arena queues
      setOnlinePlayers(stats.totalPlayersOnline || 0)
      
      // Update each room with its specific arena queue data
      setRooms(prev => prev.map(room => ({
        ...room,
        currentPlayers: stats.arenaQueues?.[room.tier] || 0
      })))
    })

    // Request initial stats
    updateRoomStats()

    // Handle race queue events
    socketConnection.on('race-queue-joined', (data: {
      position: number;
      totalPlayers: number;
      maxPlayers: number;
      arena: string;
    }) => {
      console.log('🎯 Joined race queue:', data);
      setGameState(prev => ({
        ...prev,
        status: 'waiting',
        position: data.position,
        totalPlayers: data.totalPlayers,
        maxPlayers: data.maxPlayers
      }));
    });

    // Handle waiting timer started
    socketConnection.on('waiting-timer-started', (data: {
      waitingTime: number;
      currentPlayers: number;
      maxPlayers: number;
    }) => {
      console.log('⏱️ Waiting timer started:', data);
      
      // Очищаем старый интервал если есть
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      setGameState(prev => ({
        ...prev,
        waitingTime: data.waitingTime,
        timeLeft: data.waitingTime
      }));
      
      // Start countdown timer
      const interval = setInterval(() => {
        setGameState(prev => {
          if (!prev.timeLeft || prev.timeLeft <= 1) {
            clearInterval(interval);
            timerRef.current = null;
            return {
              ...prev,
              timeLeft: 0
            };
          }
          return {
            ...prev,
            timeLeft: prev.timeLeft - 1
          };
        });
      }, 1000);
      
      timerRef.current = interval;
    });

    // Handle waiting timer cancelled
    socketConnection.on('waiting-timer-cancelled', (data: {
      reason: string;
      currentPlayers: number;
      minPlayers: number;
    }) => {
      console.log('⏹️ Waiting timer cancelled:', data);
      
      // Очищаем интервал
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setGameState(prev => ({
        ...prev,
        timeLeft: undefined,
        waitingTime: undefined
      }));
    });

    // Handle queue updates
    socketConnection.on('queue-updated', (data: {
      position: number;
      totalPlayers: number;
      maxPlayers: number;
      players: Array<{
        id: string;
        username: string;
        walletAddress: string;
        position: number;
        isYou: boolean;
      }>;
    }) => {
      console.log('📊 Queue updated:', data);
      setGameState(prev => ({
        ...prev,
        position: data.position,
        totalPlayers: data.totalPlayers,
        maxPlayers: data.maxPlayers,
        players: data.players
      }));
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      socketConnection.disconnect()
    }
  }, [publicKey])

  const joinRoom = async (room: Room) => {
    if (!publicKey || !socket) return;

    // 1. Проверяем, что у игрока есть nickname в базе
    try {
      if (!nickname) {
        alert('You must set up a nickname first. To set it up – feed your Gorba monster at least once on the main page.');
        return;
      }

      // 2. Проверяем баланс
      if (balance < room.entryFee) {
        alert('Insufficient balance!');
        return;
      }

      const treasuryPub = process.env.NEXT_PUBLIC_TREASURY_PUB;
      if (!treasuryPub) throw new Error('Treasure pub missing');

      const lamports = Math.floor(room.entryFee * 1_000_000_000);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(treasuryPub),
          lamports,
        })
      );

      const sig = await sendTransaction(tx, connection as unknown as GConnection);
      await connection.confirmTransaction(sig, 'confirmed');

      console.log('✅ Entry fee paid, tx:', sig);

      setGameState(prev => ({
        ...prev,
        room: room,
        status: 'waiting'
      }));

      socket.emit('join-race', {
        walletAddress: publicKey.toBase58(),
        username: nickname,
        arena: room.tier,
        paymentSig: sig
      });

    } catch (e) {
      console.error('Entry fee payment failed', e);
      alert('Payment failed: ' + (e as any).message);
    }
  }

  const backToLobby = () => {
    setGameState({ status: 'lobby' });
    setResults([]);
    setMyResult(null);
  };

  const leaveRoom = () => {
    if (!window.confirm('Are you sure you want to leave? Your entry fee will NOT be refunded.')) return;
    if (socket) {
      socket.emit('leave-race');
    }
    backToLobby();
  };

  const RoomCard = ({ room }: { room: Room }) => {
    const config = tierConfig[room.tier];
    const canJoin = publicKey && balance >= room.entryFee;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative bg-gray-900/40 backdrop-blur-md border ${config.borderColor} rounded-xl p-6 ${config.glow} transition-all duration-300 hover:bg-gray-900/50`}
      >
        {/* Status Badge */}
        {room.currentPlayers > 0 && (
          <div className="absolute -top-2 -right-2 bg-lime-400 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
            {room.currentPlayers} waiting
          </div>
        )}

        {/* Monster Image - BIG FOCUS */}
        <div className="flex justify-center mb-6">
          <motion.img 
            src={config.monsterImage} 
            alt={`${config.name} monster`}
            className="w-32 h-32 object-contain transition-transform duration-300 hover:rotate-3"
          />
        </div>

        <div className="space-y-4">
          {/* Arena Name & Description */}
          <div className="text-center">
            <h3 className={`text-2xl font-bold ${config.textColor} mb-2`}>{config.name}</h3>
            <p className={`text-sm ${config.textColor}/70 mb-3`}>{config.description}</p>
            
            {/* Players waiting indicator */}
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${room.currentPlayers > 0 ? 'bg-lime-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-xs ${config.textColor}/60`}>
                {room.currentPlayers > 0 
                  ? `${room.currentPlayers} waiting • Max ${room.maxPlayers} racers`
                  : `Max ${room.maxPlayers} racers • No one waiting`
                }
              </span>
            </div>
          </div>

          {/* Entry Fee */}
          <div className="flex justify-center items-center">
            <div className={`${config.textColor}/80`}>
              <div className="text-sm">Entry Fee</div>
              <div className="text-lg font-bold">{room.entryFee} GOR</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">A small percentage covers network fees</p>

          {/* Queue Progress */}
          {room.currentPlayers > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className={`${config.textColor}/60`}>Queue Progress</span>
                <span className={`${config.textColor}/60`}>
                  {room.currentPlayers}/{room.maxPlayers}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                  style={{ width: `${(room.currentPlayers / room.maxPlayers) * 100}%` }}
                />
              </div>
              <div className={`text-xs text-center ${config.textColor}/60`}>
                {room.currentPlayers >= 2 
                  ? room.currentPlayers >= room.maxPlayers 
                    ? "Full - Starting Soon!" 
                    : "Starting Soon..." 
                  : "Need 1 more to start"}
              </div>
            </div>
          )}

          {/* Join Button */}
          <button
            onClick={() => joinRoom(room)}
            disabled={!canJoin}
            className={`w-full py-3 rounded-lg font-bold transition-all duration-300 ${
              canJoin
                ? `bg-gradient-to-r ${config.gradient} text-black hover:shadow-lg hover:opacity-90`
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {!publicKey ? 'Connect Wallet' : 
             balance < room.entryFee ? 'Insufficient Balance' :
             room.currentPlayers > 0 ? `Join ${room.currentPlayers} Waiting` :
             'Join Race'}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen p-4 lg:p-8 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.header
          className="flex items-center justify-between mb-8 p-4 bg-gray-900/60 backdrop-blur-md border border-gray-700 rounded-xl shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="Logo" className="w-8 h-8" />
              <span className="text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-lime-300 via-yellow-300 to-lime-500 bg-clip-text text-transparent">
                Trash Tower Racing
              </span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4 relative z-50">
            {publicKey && (
              <div className="text-right">
                <div className="text-sm text-gray-400">Balance</div>
                <div className="text-lg font-bold text-lime-400">{balance.toFixed(3)} GOR</div>
              </div>
            )}
            <WalletMultiButton className="!h-10" />
          </div>
        </motion.header>

        {/* Connection Status */}
        {publicKey && (
          <motion.div 
            className="flex items-center justify-center mb-6 p-3 bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-4 text-center">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-white">{connected ? 'Connected to Race Server' : 'Connecting...'}</span>
              </div>
              {connected && onlinePlayers > 0 && (
                <>
                  <div className="w-px h-4 bg-gray-600" />
                  <span className="text-gray-300">Players Online: <span className="text-lime-400 font-bold">{onlinePlayers}</span></span>
                </>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {gameState.status === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <div className="text-center mb-12">
                <motion.h1
                  className="text-4xl lg:text-6xl font-extrabold mb-4 bg-gradient-to-r from-lime-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Race Around the Clock!
                </motion.h1>
                <motion.p
                  className="text-xl text-gray-300 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Choose your perfect time to race! Morning energy, midday power, or midnight magic - when do you stack fastest?
                </motion.p>
              </div>

              {/* Room Selection */}
              <div className="grid md:grid-cols-3 gap-6">
                {rooms.map((room, index) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <RoomCard room={room} />
                  </motion.div>
                ))}
              </div>

              {/* Skin Shop */}
              <motion.div
                className="mt-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <SkinShop />
              </motion.div>
            </motion.div>
          )}

          {/* Waiting State */}
          {gameState.status === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <div className="bg-gray-900/60 backdrop-blur-md border border-gray-700 rounded-xl p-8 max-w-2xl mx-auto">
                {/* Waiting Monster */}
                <div className="flex justify-center mb-6">
                  <motion.img 
                    src="/race/loading_mon.png" 
                    alt="Waiting monster"
                    className="w-32 h-32 object-contain"
                    animate={{ rotate: [0, 2, -2, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                
                <h2 className="text-3xl font-bold text-lime-400 mb-4">Waiting for Racers...</h2>
                
                {/* Queue Info */}
                <div className="mb-6">
                  <p className="text-gray-300 mb-2">
                    Players in queue: <span className="text-lime-400 font-bold">{gameState.totalPlayers || 0}</span>/{gameState.maxPlayers || 4}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Your position: <span className="text-yellow-400">#{gameState.position || 1}</span>
                  </p>
                </div>

                {/* Waiting Timer */}
                {gameState.timeLeft && gameState.timeLeft > 0 && (
                  <div className="mb-6">
                    <div className="text-lg text-orange-400 mb-2">⏱️ Starting in:</div>
                    <div className="text-4xl font-bold text-orange-300">
                      {gameState.timeLeft}s
                    </div>
                    <p className="text-gray-400 text-sm mt-2">
                      Race will start when timer runs out or lobby fills up!
                    </p>
                  </div>
                )}

                {/* No Timer Yet */}
                {(!gameState.timeLeft || gameState.timeLeft <= 0) && (
                  <div className="mb-6">
                    <p className="text-gray-300">
                      {(gameState.totalPlayers || 0) < 2 ? 
                        "Waiting for at least 2 players to start..." : 
                        "Timer will start when minimum players join"}
                    </p>
                  </div>
                )}
                
                {/* Player List */}
                <div className="space-y-2 mb-6">
                  {/* Real players */}
                  {gameState.players?.map((player) => (
                    <div key={player.id} className={`flex items-center justify-between p-3 rounded ${
                      player.isYou ? 'bg-lime-500/20 border border-lime-500/30' : 'bg-gray-800/50'
                    }`}>
                      <span className="text-white">
                        {player.isYou ? 'You' : player.username}
                        {player.isYou && <span className="text-lime-400 ml-2">({player.username})</span>}
                      </span>
                      <span className="text-lime-400">Ready</span>
                    </div>
                  ))}
                  
                  {/* Empty slots */}
                  {Array.from({ length: (gameState.maxPlayers || 4) - (gameState.totalPlayers || 0) }, (_, i) => (
                    <div key={`empty-${i}`} className="flex items-center justify-between bg-gray-800/20 p-3 rounded border-2 border-dashed border-gray-600">
                      <span className="text-gray-500">Waiting for player...</span>
                      <span className="text-gray-500">Empty</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={leaveRoom}
                  className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Leave Room
                </button>
              </div>
            </motion.div>
          )}

          {gameState.status === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="bg-gray-900/60 backdrop-blur-md border border-gray-700 rounded-xl p-12 max-w-lg mx-auto">
                {/* Countdown Monster */}
                <div className="flex justify-center mb-6">
                  <motion.img 
                    src="/race/countdown_mon.png" 
                    alt="Countdown monster"
                    className="w-40 h-40 object-contain"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-8">Race Starting In...</h2>
                <motion.div
                  className="text-8xl font-bold text-lime-400 mb-8"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  {gameState.countdown || 3}
                </motion.div>
                <p className="text-gray-300">Get ready to stack!</p>
              </div>
            </motion.div>
          )}

          {gameState.status === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="bg-gray-900/60 backdrop-blur-md border border-gray-700 rounded-xl p-8 max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-lime-400 mb-8">Race in Progress!</h2>
                
                {/* Real Trash Tower Game */}
                <div className="flex justify-center mb-6">
                  <div className="border-2 border-gray-700 rounded-xl overflow-hidden">
                    <TrashTowerGame 
                      socket={socket}
                      enableMultiplayer={true}
                      seed={gameState.seed || ''}
                      raceFinished={false}
                      frozen={false}
                      arena={gameState.room?.tier || 'bronze'}
                    />
                  </div>
                </div>
                
                <button
                  onClick={leaveRoom}
                  className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Leave Room
                </button>
              </div>
            </motion.div>
          )}

          {gameState.status === 'finished' && myResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-2xl w-full text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mb-6"
                >
                  {/* Result Monster */}
                  <div className="flex justify-center mb-6">
                    <motion.img 
                      src={myResult.position <= 3 ? "/race/victory_mon.png" : "/race/sad_mon.png"}
                      alt={myResult.position <= 3 ? "Victory monster" : "Sad monster"}
                      className="w-40 h-40 object-contain"
                      animate={myResult.position <= 3 ? { 
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0] 
                      } : {
                        x: [0, -2, 2, 0]
                      }}
                      transition={{ 
                        duration: myResult.position <= 3 ? 2 : 1, 
                        repeat: Infinity 
                      }}
                    />
                  </div>
                  
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {myResult.position <= 3 ? '🎉 RACE FINISHED! 🎉' : '😔 Better luck next time!'}
                  </h2>
                  <div className="text-4xl mb-4">
                    {myResult.position === 1 ? '🥇' : myResult.position === 2 ? '🥈' : myResult.position === 3 ? '🥉' : '🏁'}
                  </div>
                  <h3 className={`text-2xl font-bold ${myResult.position <= 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    You placed {myResult.position === 1 ? '1st' : myResult.position === 2 ? '2nd' : myResult.position === 3 ? '3rd' : `${myResult.position}th`}!
                  </h3>
                </motion.div>

                <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                  <div className="text-lg text-white mb-2">Final Score: <span className="text-lime-400 font-bold">{myResult.score.toLocaleString()} points</span></div>
                  {myResult.prize > 0 && (
                    <div className="text-lg text-white">Prize Earned: <span className="text-yellow-400 font-bold">{myResult.prize.toFixed(3)} GOR</span></div>
                  )}
                </div>

                <div className="mb-6">
                  <h4 className="text-lg font-bold text-white mb-3">📊 Full Results:</h4>
                  <div className="space-y-2">
                    {results.map((result, index) => (
                      <div key={result.playerId} className={`flex items-center justify-between p-3 rounded-lg ${result.playerId === 'you' ? 'bg-lime-500/20 border border-lime-500/30' : 'bg-gray-800/30'}`}>
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">
                            {result.position === 1 ? '🥇' : result.position === 2 ? '🥈' : result.position === 3 ? '🥉' : '4️⃣'}
                          </span>
                          <span className="text-white font-medium">{result.username}{result.playerId === socket.id ? ' (you)' : ''}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white">{result.score.toLocaleString()} pts</div>
                          {result.prize > 0 && <div className="text-yellow-400 text-sm">{result.prize.toFixed(3)} GOR</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button 
                    onClick={backToLobby}
                    className="flex-1 py-3 px-6 bg-lime-600 hover:bg-lime-500 text-white rounded-lg font-bold transition-colors"
                  >
                    RACE AGAIN 🎮
                  </button>
                  <Link href="/" className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors text-center">
                    BACK TO MAIN 🏠
                  </Link>
                </div>

                {gameState.prizeTxSignature && (
                  <div className="mt-4 text-sm text-gray-400">
                    Tx: <a href={`https://explorer.gorbagana.wtf/tx/${gameState.prizeTxSignature}`} target="_blank" rel="noopener noreferrer" className="text-lime-400 underline">view in explorer</a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}