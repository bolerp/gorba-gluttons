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
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import ReferralDashboard from "@/components/ReferralDashboard";
import { useAudio } from "@/hooks/useAudio"
import RefundPanel from "@/components/RefundPanel";
import AchievementNotification from "@/components/AchievementNotification";

export default function Home() {
  // Game state
  const { feed, pending: isFeeding } = useFeedMonster()
  const [stinkScore, setStinkScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | undefined>()
  const [nickname, setNickname] = useState("")

  const { publicKey, wallet } = useWallet()
  const { connection } = useConnection();

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
  const [showInvite, setShowInvite] = useState(false);
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
        console.log(`📈 Today's usage: ${todayVolume.toFixed(4)} GOR spent, ${todayCount} feeds made`)
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
    const shown = localStorage.getItem("refInviteShown");
    if (ref && shown !== ref) {
      setRefAddress(ref);
      setShowInvite(true);
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

  // Function handleCloseBanner
  const acknowledgeInvite = () => {
    if (refAddress) localStorage.setItem("refInviteShown", refAddress);
    setShowInvite(false);
  };

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
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) {
          setBalance(Math.round((lamports / LAMPORTS_PER_SOL) * 100) / 100);
        }
      } catch (e) {
        console.error("balance fetch fail", e);
      }
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [publicKey, connection]);

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
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.header
          className="flex items-center justify-between mb-4 p-3 bg-gray-900/60 backdrop-blur-md border border-gray-700 rounded-lg shadow-lg"
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
          <WalletMultiButton className="!h-9" />
        </motion.header>

        {/* Game Stats */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <GameStats stats={gameStats} />
        </motion.div>

        {/* Activity Marquee */}
        <div className="mb-6">
          <ActivityFeed />
        </div>

        {/* Main Game Area */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left Column - Monster */}
          <motion.div
            className="flex flex-col items-center space-y-8"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <GorbaGlutton
              onFeed={handleFeed}
              isFeeding={isFeeding}
              stinkScore={stinkScore}
              balance={balance}
              txLeft={txLeft}
              dailyLeft={dailyLeft}
              isAngry={feedError}
              isHappy={feedHappy}
            />

            {/* How to Play */}
            <motion.div
              className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6 max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h3 className="text-lg font-bold text-white mb-4">How to Play</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">1.</span>
                  <span>Connect your wallet to join the game</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">2.</span>
                  <span>Feed Gorba-Glutton by making transactions</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">3.</span>
                  <span>Generate Stink and climb the leaderboard</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-lime-400 font-bold">4.</span>
                  <span>Become the King of the Heap! 👑</span>
                </div>
              </div>
            </motion.div>

            {/* Nickname setter */}
            {currentPlayer && !currentPlayer.nickname && publicKey && (
              <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-700 p-4 max-w-md w-full">
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
            transition={{ duration: 0.7, delay: 0.4 }}
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
          className="mt-16 text-center text-gray-400 space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <p>Built on Gorbagana Network 🗑️</p>
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
        <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2 z-[100] pointer-events-none">
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

        {/* Invite Banner */}
        {showInvite && refAddress && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative bg-gray-900 border-2 border-lime-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl overflow-hidden"
            >
              <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-lime-500/10 rounded-full animate-pulse" />
              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white mb-3 glow-text">
                  You've Been Summoned!
                </h2>
                <p className="text-gray-300 mb-6">
                  Your first feed will boost <span className="font-mono text-lime-400">{refAddress.slice(0, 4)}…{refAddress.slice(-4)}</span>'s Stink Score.
                </p>
                <button
                  onClick={acknowledgeInvite}
                  className="px-8 py-3 bg-lime-500 text-black text-lg rounded-lg font-bold hover:bg-lime-400 transition-all scale-100 hover:scale-105 shadow-[0_0_20px_rgba(132,204,22,0.5)]"
        >
                  Feed the Beast!
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {feedSuccess.open && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity:0, scale:0.9}}
              animate={{ opacity:1, scale:1}}
              exit={{ opacity:0, scale:0.9}}
              transition={{ type:"spring", stiffness:260, damping:20}}
              className="bg-gray-900 border-2 border-lime-500/30 rounded-2xl p-8 max-w-sm text-center shadow-2xl"
            >
              <h2 className="text-3xl font-bold text-lime-400 mb-2">+{feedSuccess.amount.toFixed(2)} GOR!</h2>
              <p className="text-xl font-bold text-yellow-400 mb-4">+{Math.round(feedSuccess.stink)} Stink</p>
              <p className="text-gray-300 mb-6">{feedSuccess.line}</p>
              <button onClick={()=>setFeedSuccess({open:false, amount:0, stink:0, line:""})} className="px-6 py-2 bg-lime-500 text-black rounded-lg font-bold hover:bg-lime-400 transition">Got it</button>
            </motion.div>
          </div>
        )}

        {/* Referral Modal */}
        {showRefModal && publicKey && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={() => setShowRefModal(false)}
          >
            <motion.div
              initial={{ opacity:0, scale:0.9 }}
              animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0, scale:0.9 }}
              transition={{ type:"spring", stiffness:260, damping:20 }}
              className="bg-gray-900 border-2 border-lime-500/30 rounded-2xl p-6 w-full max-w-md text-center shadow-2xl"
              onClick={(e)=>e.stopPropagation()}
            >
              <ReferralDashboard address={publicKey.toBase58()} bonus={refBonus} referrals={referrals} rank={currentPlayer?.rank ?? 0} stinkScore={stinkScore} onToast={(msg)=>setToasts(t=>[...t,{text:msg}])} />
              <button onClick={()=>setShowRefModal(false)} className="mt-4 px-4 py-2 bg-lime-500 text-black rounded-lg font-bold hover:bg-lime-400 transition">Close</button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
