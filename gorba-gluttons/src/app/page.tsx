"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import GorbaGlutton from "@/components/GorbaGlutton"
import Leaderboard from "@/components/Leaderboard"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import GameStats from "@/components/GameStats"
import { Player, GameStats as GameStatsType, Referral } from "@/types"
import { getMockLeaderboard } from "@/lib/utils"
import { useFeedMonster } from "@/hooks/useFeedMonster"
import { useWallet } from "@solana/wallet-adapter-react"
import { useRouter } from "next/navigation"
import Achievements from "@/components/Achievements"
import { ACHIEVEMENTS } from "@/lib/achievements"
import type { Achievement } from "@/types";
import ActivityFeed from "@/components/ActivityFeed";
import type { MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";
import ReferralDashboard from "@/components/ReferralDashboard";
import { useAudio } from "@/hooks/useAudio"
import RefundPanel from "@/components/RefundPanel";
import AchievementNotification from "@/components/AchievementNotification";
import Link from 'next/link';

export default function Home() {
  // Game state
  const { feed, pending: isFeeding } = useFeedMonster()
  const [stinkScore, setStinkScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | undefined>()
  const [nickname, setNickname] = useState("")
  const [hoveredMode, setHoveredMode] = useState<'solo' | 'race' | null>(null)

  const { publicKey, wallet } = useWallet()

  const router = useRouter()

  // Mock game stats
  const [gameStats, setGameStats] = useState<GameStatsType>({
    totalPlayers: 0,
    totalTransactions: 0,
    totalStink: 0,
    currentKing: null,
  })

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [prevUnlocked, setPrevUnlocked] = useState<Set<string>>(new Set())
  interface Toast { text: string; trophy?: boolean }
  const [toasts, setToasts] = useState<Toast[]>([])
  const shownRef = useRef<Set<string>>(new Set())
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const [showAchievementNotification, setShowAchievementNotification] = useState(false)

  // New state
  const [refAddress, setRefAddress] = useState<string | null>(null);

  const [feedSuccess, setFeedSuccess] = useState<{open:boolean; amount:number; stink:number; line:string}>({open:false, amount:0, stink:0, line:""});

  const [balance, setBalance] = useState(0);

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [refBonus, setRefBonus] = useState(0);
  const [showRefModal, setShowRefModal] = useState(false);

  const [dailyLeft, setDailyLeft] = useState(0.25);
  const [txLeft, setTxLeft] = useState(10);

  const [feedError, setFeedError] = useState(false);
  const [feedHappy, setFeedHappy] = useState(false);

  const [showGameModal, setShowGameModal] = useState(false);

  const playSound = useAudio()

  const successLines = [
    "The Heap thanks you!",
    "Gorba burps happily!",
    "Stink levels rising!",
    "Trash never tasted so good.",
    "Glorious garbage offering!",
    "Your stench is legendary.",
    "Flies salute you!",
    "Compost royalty!",
    "Rotten riches gained.",
    "The trash can sings your praise!",
  ];

  const refreshDailyInfo = useCallback(async () => {
    if (!publicKey) return
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
      const res = await fetch(`${api}/daily-left/${publicKey.toBase58()}`)
      if (res.ok) {
        const { dailyLeft: srvDaily, txLeft: srvTx, todayCount, todayVolume } = await res.json()
        const serverDaily = typeof srvDaily === "string" ? parseFloat(srvDaily) : srvDaily;
        const serverTx = typeof srvTx === "string" ? parseInt(srvTx, 10) : srvTx;
        
        // Обновляем состояние напрямую, а не через Math.min
        setDailyLeft(serverDaily)
        setTxLeft(serverTx)
        
        // console.log(`📊 Daily limits updated: ${serverDaily.toFixed(4)} GOR left, ${serverTx} feeds left`)
      }
    } catch (e) {
      console.error("Failed to refresh daily limits", e)
    }
  }, [publicKey])

  // Fetch leaderboard from backend
  useEffect(() => {
    async function fetchLeaders() {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
        const res = await fetch(`${api}/leaderboard`)
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        
        const raw = await res.json() as any[]
        // raw is array of {address, stinkScore, etc} - the server already formats it correctly
        const mapped: Player[] = raw.map((row: any) => ({
          rank: row.rank,
          address: row.address,
          nickname: row.nickname || undefined,
          stinkScore: row.stinkScore,
          baseScore: row.baseScore,
          referralScore: row.referralScore,
          garbagePatchSize: row.garbagePatchSize,
        }))
        setLeaderboard(mapped)

        if (publicKey) {
          const me = mapped.find(p => p.address === publicKey.toBase58())
          setCurrentPlayer(me)
          
          // Загружаем полные данные игрока для достижений
          const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
          try {
            const playerRes = await fetch(`${api}/player/${publicKey.toBase58()}`);
            if (playerRes.ok) {
              const playerData = await playerRes.json();
              // Обновляем currentPlayer с полными данными
              setCurrentPlayer(prev => prev ? ({ 
                ...prev, 
                totalVolume: playerData.totalVolume,
                transactionCount: playerData.transactionCount 
              }) : undefined);
            }
          } catch (e) {
            console.error("Failed to load full player data", e);
          }
        }
      } catch (e) {
        console.error("Failed to load leaderboard", e)
        // Fallback to empty leaderboard if server is not available
        setLeaderboard([])
      }
    }

    fetchLeaders()
    const id = setInterval(fetchLeaders, 5000)
    return () => clearInterval(id)
  }, [publicKey])

  // Fetch aggregated stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const res = await fetch(`${api}/stats`);
        const data = await res.json();
        const king: Player | null = data.currentKing
          ? {
              rank: 1,
              address: data.currentKing.wallet,
              stinkScore: data.currentKing.total_score,
              baseScore: data.currentKing.total_score,
              referralScore: 0,
              garbagePatchSize: 0,
            }
          : null;
        setGameStats({
          totalPlayers: data.totalPlayers,
          totalTransactions: data.totalTransactions,
          totalStink: data.totalStink,
          currentKing: king,
        });
      } catch (e) {
        console.error("Failed to load stats", e);
      }
    }

    fetchStats();
    const id = setInterval(fetchStats, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (leaderboard.length) {
      setGameStats(prev => ({ ...prev, currentKing: leaderboard[0] }))
    }
  }, [leaderboard])

  useEffect(() => {
    if (currentPlayer) {
      setStinkScore(currentPlayer.stinkScore)
    }
  }, [currentPlayer])

  // Обновляем лимиты при подключении кошелька
  useEffect(() => {
    if (publicKey) {
      refreshDailyInfo();
    }
  }, [publicKey, refreshDailyInfo]);

  // Capture ?ref= query param
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && /^[A-Za-z0-9]{32,44}$/.test(ref)) {
      localStorage.setItem("referrerAddress", ref);
      localStorage.removeItem("refInviteShown");
      // Remove the query param from URL for cleanliness
      router.replace("/");
    }
  }, [router]);

  // New effect to decide show banner
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = localStorage.getItem("referrerAddress");
    if (ref) {
      setRefAddress(ref);
    }
  }, []);

  // ---------------- Referral registration after first feed ----------------
  const registerReferralIfNeeded = async () => {
    if (!publicKey) return;
    const ref = localStorage.getItem("referrerAddress");
    if (!ref) return;
    const already = localStorage.getItem(`isReferralRegistered:${publicKey.toBase58()}`);
    if (already) return;

    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const signer = wallet?.adapter as unknown as MessageSignerWalletAdapter;
    if (!signer?.signMessage) return;
    const msg = new TextEncoder().encode(`REF_LINK_${ref}`);
    try {
      const sig = await signer.signMessage(msg);
      const signatureB64 = Buffer.from(sig).toString("base64");
      
      const response = await fetch(`${api}/register-referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refereeAddress: publicKey.toBase58(),
          referrerAddress: ref,
          signature: signatureB64,
        }),
      });

      if (response.ok) {
        setToasts([{ text: "Referral registered successfully! 🎉" }]);
      } else {
        const error = await response.json();
        console.error("Referral registration failed:", error);
        setToasts([{ text: `Referral registration failed: ${error.error}` }]);
      }
      
      localStorage.setItem(`isReferralRegistered:${publicKey.toBase58()}`, "true");
    } catch (e) {
      console.error("Referral registration error:", e);
      setToasts([{ text: "Failed to register referral" }]);
    }
  };

  const handleFeed = async (amt: number) => {
    if (!publicKey) {
      setToasts([{ text: "Connect your wallet first!" }]);
      return
    }

    try {
      const result = await feed(amt)

      if (result) {
        playSound("feed-success", 0.7);
        setFeedHappy(true);
        setTimeout(() => setFeedHappy(false), 2000);
        
        const line = successLines[Math.floor(Math.random() * successLines.length)];
        setFeedSuccess({
          open: true,
          amount: amt,
          stink: result.stink,
          line 
        });
        
        // Optimistically update scores
        setStinkScore(result.newScore);
        if (currentPlayer) {
          setCurrentPlayer(prev => prev ? ({ ...prev, stinkScore: result.newScore }) : undefined);
        }

        // Обновляем лимиты из ответа сервера
        if (result.dailyLeft !== undefined && result.txLeft !== undefined) {
          setDailyLeft(result.dailyLeft)
          setTxLeft(result.txLeft)
          // console.log(`📊 Limits updated after feed: ${result.dailyLeft.toFixed(4)} GOR left, ${result.txLeft} feeds left`)
      } else {
          // Fallback: обновляем локально
          setDailyLeft(prev => Math.max(0, prev - amt));
          setTxLeft(prev => Math.max(0, prev - 1));
        }

        // Register referral if needed (after first successful feed)
        await registerReferralIfNeeded();

        // Обрабатываем новые достижения от сервера
        if (result.newAchievements && result.newAchievements.length > 0) {
          // Фильтруем только те достижения которые еще не показывались
          const trulyNewAchievements = result.newAchievements.filter((ach: any) => !shownRef.current.has(ach.id));
          
          if (trulyNewAchievements.length > 0) {
            console.log(`🏆 New achievements from feed:`, trulyNewAchievements.map((a: any) => a.name));
            setNewAchievements(trulyNewAchievements);
            setShowAchievementNotification(true);
            
            // Отмечаем достижения как показанные
            for (const ach of trulyNewAchievements) {
              shownRef.current.add(ach.id);
            }
            
            // Сохраняем в localStorage
            const walletKey = publicKey.toBase58();
            const shownArray = Array.from(shownRef.current);
            localStorage.setItem(`shownAchievements:${walletKey}`, JSON.stringify(shownArray));
        }
        }

      } else {
        // This case might not be hit if feed throws an error
        setFeedError(true);
        setTimeout(() => setFeedError(false), 2000);
        playSound("feed-fail", 0.7);
      }
    } catch (e: any) {
      console.error("Feed failed:", e)
      setFeedError(true);
      setTimeout(() => setFeedError(false), 2000);
      playSound("feed-fail", 0.7);

      let errorText = "Something went wrong."
      if (e.message.includes("Transaction rejected")) {
        errorText = "Transaction rejected by wallet."
      } else if (e.message.includes("Insufficient funds")) {
        errorText = "Not enough GOR for this offering!"
      }
      setToasts([{ text: errorText }])
    }
  }

  const handleSaveNickname = async () => {
    if (!publicKey || !nickname) return

    try {
    const signer = wallet?.adapter as unknown as MessageSignerWalletAdapter;
      if (!signer?.signMessage) {
        setToasts([{ text: "Wallet doesn't support message signing" }]);
        return;
      }

      // Создаем сообщение для подписи
      const message = `REGISTER_NICKNAME_${nickname}`;
      const messageBytes = new TextEncoder().encode(message);
      
      // Получаем подпись
      const signature = await signer.signMessage(messageBytes);
      const signatureB64 = Buffer.from(signature).toString("base64");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/player`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            walletAddress: publicKey.toBase58(), 
            nickname,
            signature: signatureB64
          }),
        }
      );
      
      if (res.ok) {
        setToasts([{ text: "Nickname saved successfully!" }]);
        setNickname("");
        // refresh leaderboard soon
    } else {
        const error = await res.json();
        setToasts([{ text: error.error || "Failed to save nickname" }]);
      }
    } catch (e) {
      console.error("Failed to save nickname", e);
      setToasts([{ text: "Failed to save nickname" }]);
    }
  };

  // Fetch achievements when wallet connected
  useEffect(() => {
    if (!publicKey) return;
    let timer: any;
    
    // Загружаем показанные достижения из localStorage
    const loadShownAchievements = () => {
      const walletKey = publicKey.toBase58();
      const shown = localStorage.getItem(`shownAchievements:${walletKey}`);
      if (shown) {
        try {
          const shownArray = JSON.parse(shown) as string[];
          shownArray.forEach(id => shownRef.current.add(id));
        } catch (e) {
          console.warn('Failed to parse shown achievements from localStorage');
        }
      }
    };
    
    // Сохраняем показанные достижения в localStorage
    const saveShownAchievements = () => {
      const walletKey = publicKey.toBase58();
      const shownArray = Array.from(shownRef.current);
      localStorage.setItem(`shownAchievements:${walletKey}`, JSON.stringify(shownArray));
    };
    
    const fetchAch = async () => {
      if (!publicKey) return
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/achievements/${publicKey.toBase58()}`
        )
        if (res.ok) {
          const { achievements: allAchievements } = await res.json() as { achievements: Achievement[] };
          
          // Определяем новые разблокированные достижения
          const newUnlocked = new Set(allAchievements.filter(a => a.unlocked).map(a => a.id));
        const justUnlocked = [...newUnlocked].filter(
            (id: string) => !prevUnlocked.has(id) && !shownRef.current.has(id)
        );

        if (justUnlocked.length > 0) {
            const newlyUnlockedAchievements = allAchievements.filter(a => justUnlocked.includes(a.id));
            
            console.log(`🏆 Showing ${newlyUnlockedAchievements.length} new achievements:`, newlyUnlockedAchievements.map(a => a.name));
            
            // Показываем уведомление о новых достижениях
            setNewAchievements(newlyUnlockedAchievements);
            setShowAchievementNotification(true);

            // Отмечаем достижения как показанные
            for (const ach of newlyUnlockedAchievements) {
              shownRef.current.add(ach.id);
            }
            
            // Сохраняем в localStorage
            saveShownAchievements();
        }
        setPrevUnlocked(newUnlocked);
          setAchievements(allAchievements);
        }
      } catch (e) {
        console.error("Failed to fetch achievements", e);
      }
    };
    
    // Загружаем показанные достижения при первом подключении кошелька
    loadShownAchievements();
    
    if (publicKey) {
      fetchAch();
    }
    // Убираем автоматическую проверку - достижения проверяются при кормлении и добавлении рефералов
    // timer = setInterval(fetchAch, 60000);
    // return () => clearInterval(timer);
  }, [publicKey]); // Убираем prevUnlocked из dependencies чтобы избежать бесконечного цикла

  // auto-remove toast after 4s
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => {
      setToasts((t) => t.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);



  // Daily left state fetching
  useEffect(() => {
    if (!publicKey) return;
    refreshDailyInfo();
    const id = setInterval(refreshDailyInfo, 10000);
    return () => clearInterval(id);
  }, [publicKey, refreshDailyInfo]);

  // Load initial values from localStorage
  useEffect(() => {
    if (!publicKey) return;
    const todayStr = new Date().toISOString().slice(0,10);
    const keyLeft = `dailyLeft:${publicKey.toBase58()}:${todayStr}`;
    const keyTx = `txLeft:${publicKey.toBase58()}:${todayStr}`;
    const cachedLeft = localStorage.getItem(keyLeft);
    const cachedTx = localStorage.getItem(keyTx);
    if (cachedLeft) {
      const num = parseFloat(cachedLeft);
      if (!isNaN(num)) setDailyLeft(num);
    }
    if (cachedTx) {
      const num = parseInt(cachedTx, 10);
      if (!isNaN(num)) setTxLeft(num);
    }
  }, [publicKey]);

  // Balance polling
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
        console.error("balance fetch fail", e);
      }
    };
    fetchBalance()
    const interval = setInterval(fetchBalance, 30000)
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicKey]);

  // Referrals polling
  useEffect(() => {
    if (!publicKey) return;
    let prevReferralCount = 0;
    
    const fetchRefs = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/referrals/${publicKey.toBase58()}`
        )
        if (res.ok) {
          const { referrals, bonus } = await res.json()
          // Маппим данные согласно интерфейсу Referral
          const mappedReferrals: Referral[] = (referrals || []).map((ref: any) => ({
            wallet: ref.wallet,
            nickname: ref.nickname,
            base_score: ref.base_score,
            total_score: ref.total_score,
            bonus_earned: ref.bonus_earned || 0,
            level: ref.level || 1
          }));
          
          // Если количество ПРЯМЫХ рефералов увеличилось - принудительно проверяем достижения
          const directReferrals = mappedReferrals.filter(ref => ref.level === 1);
          if (directReferrals.length > prevReferralCount) {
            // console.log(`🎯 Direct referral count increased: ${prevReferralCount} -> ${directReferrals.length}. Checking achievements...`);
            
            // Принудительная проверка достижений
            try {
              const achievementRes = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/check-achievements/${publicKey.toBase58()}`,
                { method: 'POST' }
              );
              
                             if (achievementRes.ok) {
                 const { newAchievements } = await achievementRes.json();
                 if (newAchievements && newAchievements.length > 0) {
                   // Фильтруем только те достижения которые еще не показывались
                   const trulyNewAchievements = newAchievements.filter((ach: any) => !shownRef.current.has(ach.id));
                   
                   if (trulyNewAchievements.length > 0) {
                     console.log(`🏆 New referral achievements unlocked:`, trulyNewAchievements.map((a: any) => a.name));
                     setNewAchievements(trulyNewAchievements);
                     setShowAchievementNotification(true);
                     
                     // Отмечаем достижения как показанные
                     for (const ach of trulyNewAchievements) {
                       shownRef.current.add(ach.id);
                     }
                     
                     // Сохраняем в localStorage
                     const walletKey = publicKey.toBase58();
                     const shownArray = Array.from(shownRef.current);
                     localStorage.setItem(`shownAchievements:${walletKey}`, JSON.stringify(shownArray));
                   }
                 }
               }
            } catch (e) {
              console.error("Failed to check achievements:", e);
            }
            
                         prevReferralCount = directReferrals.length;
          }
          
          setReferrals(mappedReferrals);
          setRefBonus(bonus || 0);
        }
      } catch (e) {
        console.error("referrals fetch fail", e);
      }
    };
    fetchRefs();
    const id = setInterval(fetchRefs, 15000);
    return () => clearInterval(id);
  }, [publicKey]);



  return (
    <div className="min-h-screen p-4 lg:p-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.header
          className="relative z-20 flex items-center justify-between mb-6 p-3 bg-gray-900/60 backdrop-blur-md border border-gray-700 rounded-lg shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <img src="/logo.png" alt="Trash logo" className="w-8 h-8" />
            <span className="text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-lime-300 via-yellow-300 to-lime-500 bg-clip-text text-transparent whitespace-nowrap drop-shadow-[0_0_6px_rgba(132,204,22,0.8)]">
              Gorba-Gluttons
              </span>
            </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://x.com/gorbaxyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-sm font-medium hidden sm:inline">@gorbaxyz</span>
            </a>
            <WalletMultiButton className="!h-9" />
          </div>
        </motion.header>

        {/* Game Stats */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <GameStats stats={gameStats} />
        </motion.div>

        {/* Main Game Selection Area */}
        <div className="relative mb-8">
          {/* Game Mode Selection - Trash Bins Layout */}
          <div className="flex items-center justify-center gap-8 lg:gap-16 mb-8">
            
            {/* Solo Mode Trash Bin */}
          <motion.div
              className="relative group cursor-default select-none w-64 lg:w-72 h-96 flex items-end justify-center"
              onMouseEnter={() => setHoveredMode('solo')}
              onMouseLeave={() => setHoveredMode(null)}
              initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
              whileHover={{ scale: 1.05, rotate: -2 }}
            >
              <div className="relative select-none pointer-events-none transition-all duration-300 group-hover:brightness-75">
                <motion.img 
                  src="/bin1.png" 
                  alt="Solo Mode Bin" 
                  className="w-full max-h-full object-contain drop-shadow-2xl" 
                  whileHover={{ y: -10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                />
                {/* Coming soon overlay - без темного фона */}
                <div className="absolute inset-0 flex items-center justify-center text-yellow-300 text-xl lg:text-2xl font-extrabold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  Coming&nbsp;Soon
                </div>
              </div>
            </motion.div>

            {/* Central Monster */}
            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              <div className="relative">
                {/* Monster with enhanced reactions */}
            <GorbaGlutton
              onFeed={handleFeed}
              isFeeding={isFeeding}
              stinkScore={stinkScore}
              balance={balance}
              txLeft={txLeft}
              dailyLeft={dailyLeft}
              isAngry={feedError}
              isHappy={feedHappy}
                  tilt={hoveredMode === 'solo' ? -12 : hoveredMode === 'race' ? 12 : 0}
            />
              </div>
            </motion.div>

            {/* Race Mode Trash Bin */}
            <motion.div
              className="relative cursor-pointer group"
              onMouseEnter={() => setHoveredMode('race')}
              onMouseLeave={() => setHoveredMode(null)}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              whileHover={{ scale: 1.05, rotate: 2 }}
            >
              <Link href="/race" className="block relative w-64 lg:w-72 h-96 flex items-end justify-center transition-all duration-300 group-hover:brightness-110">
                <img 
                  src="/bin2.png" 
                  alt="Race Mode Bin" 
                  className="w-full max-h-full object-contain drop-shadow-2xl" 
                />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Activity Marquee */}
        <div className="mb-8">
          <ActivityFeed />
        </div>

        {/* Bottom Section - Leaderboard and Info */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left Column - How to Play & Nickname */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            >
            {/* How to Play */}
            <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">How to Play</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">1.</span>
                  <span>Connect your wallet to join the game</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">2.</span>
                  <span>Join multiplayer race and compete to the top</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">3.</span>
                  <span>Feed Gorba-Glutton to generate Stink and climb leaderboards</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">4.</span>
                  <span>Become the ultimate Trash Tower King! 👑</span>
                </div>
              </div>
            </div>

            {/* Nickname setter */}
            {currentPlayer && !currentPlayer.nickname && publicKey && (
              <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-700 p-4">
                <h3 className="text-md font-bold text-white mb-2">Pick your Trash Tag</h3>
                <div className="flex space-x-2">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. DumpsterDuke"
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveNickname}
                    disabled={!/^[A-Za-z0-9_]{3,16}$/.test(nickname)}
                    className="px-4 py-2 bg-lime-500 text-black rounded disabled:opacity-50"
                  >Save</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">3-16 chars, letters, digits, underscore</p>
              </div>
            )}
          </motion.div>

          {/* Right Column - Leaderboard */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            <Leaderboard 
              players={leaderboard} 
              currentPlayer={currentPlayer}
              referralCount={referrals.length}
              onOpenReferrals={() => setShowRefModal(true)}
              onToast={(msg)=>setToasts(t=>[...t,{text:msg}])}
            />
          </motion.div>
        </div>

        <RefundPanel />

        {/* Footer */}
        <motion.footer
          className="mt-16 text-center text-gray-400 space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="flex items-center justify-center space-x-4">
          <p>Built on Gorbagana Network 🗑️</p>
            <div className="h-4 w-px bg-gray-600"></div>
            <a 
              href="https://x.com/gorbaxyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors duration-200 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-sm font-medium">@gorbaxyz</span>
            </a>
          </div>
          <p className="text-sm">
            &ldquo;If nobody creates Gorbagana network in 48 hours, I&apos;ll be very disappointed&rdquo; - Toly
          </p>
        </motion.footer>

        {/* Achievements */}
        <Achievements 
          achievements={achievements} 
          playerData={{
            stinkScore,
            transactionCount: currentPlayer?.transactionCount || 0,
            totalVolume: currentPlayer?.totalVolume || 0,
            referralCount: referrals.filter(ref => ref.level === 1).length, // Только прямые рефералы
            rank: currentPlayer?.rank || 0
          }}
        />

        {/* Achievement Notifications */}
        {showAchievementNotification && newAchievements.length > 0 && (
          <AchievementNotification
            achievements={newAchievements}
            onClose={() => {
              setShowAchievementNotification(false);
              setNewAchievements([]);
            }}
          />
        )}

        {/* Toasts */}
        <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2 z-40 pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast, idx) => (
              <motion.div
                key={toast.text + idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-900/90 text-white px-4 py-2 rounded shadow-lg"
              >
                {toast.trophy ? `🏆 ${toast.text} unlocked!` : toast.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>



        {/* Feed Success Modal */}
        {feedSuccess.open && (
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-30 backdrop-blur-sm"
            onClick={() => setFeedSuccess({open: false, amount: 0, stink: 0, line: ""})}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-gray-900 border-2 border-lime-500/50 rounded-2xl p-8 max-w-md text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-6xl mb-4">🤤</div>
              <h2 className="text-2xl font-bold text-lime-400 mb-2">Delicious!</h2>
              <p className="text-white mb-2">{feedSuccess.line}</p>
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-400">Transaction Amount</p>
                <p className="text-xl font-bold text-yellow-400">{feedSuccess.amount.toFixed(4)} GOR</p>
                <p className="text-sm text-gray-400 mt-2">Stink Generated</p>
                <p className="text-lg font-bold text-lime-400">+{feedSuccess.stink}</p>
          </div>
              <button
                onClick={() => setFeedSuccess({open: false, amount: 0, stink: 0, line: ""})}
                className="px-6 py-2 bg-lime-500 text-black rounded-lg font-bold hover:bg-lime-400"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Referral Modal */}
        {showRefModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-30 backdrop-blur-sm p-4"
            onClick={() => setShowRefModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
                             <ReferralDashboard 
                 address={publicKey?.toBase58() || ''}
                 bonus={refBonus}
                 referrals={referrals}
                 rank={currentPlayer?.rank || 0}
                 stinkScore={stinkScore}
                 onToast={(msg) => setToasts(t => [...t, {text: msg}])}
               />
               <div className="flex justify-center mt-4">
                 <button
                   onClick={() => setShowRefModal(false)}
                   className="px-4 py-2 bg-lime-500 text-black rounded-lg font-bold hover:bg-lime-400 transition"
                 >
                   Close
                 </button>
          </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
