"use client"

import React, { useRef, useEffect, useCallback, useState } from 'react';

// Game Constants - Based on Original Doodle Jump
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 40;
const PLAYER_COLOR = '#f6ad55'; // Orange
const GRAVITY = 0.4;
const JUMP_FORCE = -12;
const SUPER_JUMP_FORCE = -18;
const MOVE_SPEED = 5;

const PLATFORM_WIDTH = 70;
const PLATFORM_HEIGHT = 15;
const PLATFORM_COUNT = 15; // Fewer platforms on screen
const PLATFORM_SPACING_Y_MIN = 60; // Minimum vertical spacing
const PLATFORM_SPACING_Y_MAX = 100; // Maximum vertical spacing

const PLATFORM_COLORS = {
    normal: '#48bb78',      // Green - Standard platforms (most common)
    bouncy: '#4299e1',      // Blue - Extra bouncy platforms  
    breakable: '#a0aec0',   // Gray - Disappearing platforms
    moving: '#d69e2e',      // Brown - Moving platforms
};

// Platform textures mapping
const PLATFORM_TEXTURES = {
    normal: '/race/game/panel_plastic.png',
    bouncy: '/race/game/panel_tire.png', 
    breakable: '/race/game/panel_paper.png',
    moving: '/race/game/panel_metal.png',
};

// Skin textures mapping
const SKIN_TEXTURES: Record<Skin, string> = {
    rusty: '/race/gorba/gorba_rusty.png',
    plastic: '/race/gorba/gorba_plastic.png',
    toxic: '/race/gorba/gorba_toxic.png',
};

const COLLECTIBLE_COLOR = '#f6e05e'; // Yellow for Bolts
const COLLECTIBLE_SIZE = 10;
const COLLECTIBLE_TEXTURE = '/race/game/item_bolt.png';

// Arena backgrounds
const ARENA_BACKGROUNDS = {
    bronze: '/race/game/bg_morning.png',
    silver: '/race/game/bg_day.png', 
    gold: '/race/game/bg_night.png',
};

// Stink-o-Meter
const METER_MAX = 100;
const BOOST_DURATION = 180; // 3 seconds at 60fps

type PlatformType = 'normal' | 'bouncy' | 'breakable' | 'moving';
type ArenaType = 'bronze' | 'silver' | 'gold';

interface Collectible {
    x: number;
    y: number;
    isCollected?: boolean;
}
interface Platform {
    x: number;
    y: number;
    width: number;
    height: number;
    type: PlatformType;
    isBroken?: boolean;
    speed?: number;
    collectible?: Collectible;
}

type GameState = 'waiting' | 'playing' | 'gameOver';

// --- Skins ---
const SKINS = {
    rusty: { name: 'Rusty', color: '#b7791f', price: 0 },
    plastic: { name: 'Plastic', color: '#38bdf8', price: 100 },
    toxic: { name: 'Toxic', color: '#38a169', price: 250 },
};
type Skin = keyof typeof SKINS;

interface MultiplayerOptions {
  socket?: any; // Socket.io client, optional
  enableMultiplayer?: boolean;
  seed?: string;
  raceFinished?: boolean;
  frozen?: boolean;
  arena?: ArenaType; // Добавляем тип арены
}

const TrashTowerGame: React.FC<MultiplayerOptions> = ({ 
  socket, 
  enableMultiplayer = false, 
  seed, 
  raceFinished = false, 
  frozen = false,
  arena = 'bronze' // По умолчанию утренняя арена
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Image loading state
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const images = useRef<{ [key: string]: HTMLImageElement }>({});

  // Workshop State
  const [totalBolts, setTotalBolts] = useState(0);
  const [unlockedSkins, setUnlockedSkins] = useState<Skin[]>(['rusty']);
  const [currentSkin, setCurrentSkin] = useState<Skin>('rusty');

  // Game state refs
  const player = useRef({ x: 225, y: 550, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, vx: 0, vy: 0 });
  const platforms = useRef<Platform[]>([]);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameState = useRef<GameState>('waiting');
  const score = useRef(0);
  const sessionBolts = useRef(0);
  const stinkMeter = useRef(0);
  const boostTimer = useRef(0);
  const onStickyPlatform = useRef<Platform | null>(null);
  // Multiplayer helpers
  const lastSentScore = useRef(0);
  const lastPosSentAt = useRef(0);
  type Opponent = {
    x: number;
    y: number;
    drawX: number;
    drawY: number;
    isAlive: boolean;
    username: string;
    score: number;
  };
  const opponents = useRef<Record<string, Opponent>>({});
  
  // --- LocalStorage Persistence ---
  useEffect(() => {
    const savedBolts = localStorage.getItem('trash_tower_bolts');
    if (savedBolts) setTotalBolts(parseInt(savedBolts, 10));

    const savedSkins = localStorage.getItem('trash_tower_unlocked_skins');
    if (savedSkins) {
      const parsed: Skin[] = JSON.parse(savedSkins).map((s: string) => (s === 'default' ? 'rusty' : s));
      setUnlockedSkins(parsed.length ? parsed : ['rusty']);
    }
    
    const savedCurrentSkin = localStorage.getItem('trash_tower_current_skin');
    if (savedCurrentSkin) {
      const migrated = savedCurrentSkin === 'default' ? 'rusty' : savedCurrentSkin;
      setCurrentSkin(migrated as Skin);
    }

  }, []);

  // Load images
  useEffect(() => {
    const loadImages = async () => {
      const imagePromises: Promise<void>[] = [];
      
      // Load background
      const bgImg = new Image();
      imagePromises.push(new Promise((resolve) => {
        bgImg.onload = () => resolve();
        bgImg.src = ARENA_BACKGROUNDS[arena];
      }));
      images.current['background'] = bgImg;

      // Load platform textures
      Object.entries(PLATFORM_TEXTURES).forEach(([type, src]) => {
        const img = new Image();
        imagePromises.push(new Promise((resolve) => {
          img.onload = () => resolve();
          img.src = src;
        }));
        images.current[`platform_${type}`] = img;
      });

      // Load collectible texture
      const collectibleImg = new Image();
      imagePromises.push(new Promise((resolve) => {
        collectibleImg.onload = () => resolve();
        collectibleImg.src = COLLECTIBLE_TEXTURE;
      }));
      images.current['collectible'] = collectibleImg;

      // Load skin textures
      Object.entries(SKIN_TEXTURES).forEach(([skinKey, src]) => {
        const img = new Image();
        imagePromises.push(new Promise(resolve => {
          img.onload = () => resolve();
          img.src = src;
        }));
        images.current[`skin_${skinKey}`] = img;
      });

      await Promise.all(imagePromises);
      setImagesLoaded(true);
    };

    loadImages();
  }, [arena]);

  const saveProgress = useCallback((newBolts: number) => {
    const updatedTotalBolts = totalBolts + newBolts;
    setTotalBolts(updatedTotalBolts);
    localStorage.setItem('trash_tower_bolts', updatedTotalBolts.toString());
  }, [totalBolts]);

  const unlockSkin = (skin: Skin) => {
    const skinData = SKINS[skin];
    if (totalBolts >= skinData.price && !unlockedSkins.includes(skin)) {
        const newTotalBolts = totalBolts - skinData.price;
        const newUnlockedSkins = [...unlockedSkins, skin];
        
        setTotalBolts(newTotalBolts);
        setUnlockedSkins(newUnlockedSkins);

        localStorage.setItem('trash_tower_bolts', newTotalBolts.toString());
        localStorage.setItem('trash_tower_unlocked_skins', JSON.stringify(newUnlockedSkins));
        
        alert(`${skinData.name} skin unlocked!`);
    }
  };

  const selectSkin = (skin: Skin) => {
    if (unlockedSkins.includes(skin)) {
        setCurrentSkin(skin);
        localStorage.setItem('trash_tower_current_skin', skin);
    }
  }

  // --- Deterministic RNG ---
  const mulberry32 = (a: number) => {
    return function() {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const seedInt = seed ? seed.split('').reduce((acc,c)=>acc + c.charCodeAt(0),0) : 0;
  const rng = seed ? mulberry32(seedInt) : Math.random;

  // Original Doodle Jump style platform generation - ONE platform at a time
  const generateNextPlatform = (lastPlatform: Platform): Platform => {
    // Calculate vertical spacing (60-100 pixels up from last platform)
    const ySpacing = PLATFORM_SPACING_Y_MIN + rng() * (PLATFORM_SPACING_Y_MAX - PLATFORM_SPACING_Y_MIN);
    
    // Calculate horizontal position (random but reachable)
    const maxHorizontalDistance = 120; // Maximum horizontal distance player can reach
    const minX = Math.max(20, lastPlatform.x - maxHorizontalDistance);
    const maxX = Math.min(480 - PLATFORM_WIDTH - 20, lastPlatform.x + maxHorizontalDistance);
    
    const x = minX + rng() * (maxX - minX);
    const y = lastPlatform.y - ySpacing;
    
    // Platform type distribution (like original Doodle Jump)
    let type: PlatformType = 'normal';
    const rand = rng();
    
    if (rand < 0.8) {
        type = 'normal';        // 80% normal platforms
    } else if (rand < 0.9) {
        type = 'moving';        // 10% moving platforms  
    } else if (rand < 0.95) {
        type = 'bouncy';        // 5% bouncy platforms
    } else {
        type = 'breakable';     // 5% breakable platforms
    }
    
    const platform: Platform = {
        x,
        y,
        width: PLATFORM_WIDTH,
        height: PLATFORM_HEIGHT,
        type,
        speed: type === 'moving' ? (rng() > 0.5 ? 1.5 : -1.5) : 0 // Moving platforms have speed
    };
    
    // Add collectible to some platforms (20% chance)
    if (rng() < 0.2) {
        platform.collectible = { 
            x: platform.x + platform.width / 2 - 5, 
            y: platform.y - 20 
        };
    }
    
    return platform;
  }

  const resetGame = useCallback(() => {
    player.current = { x: 225, y: 500, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, vx: 0, vy: JUMP_FORCE };
    platforms.current = [];
    score.current = 0;
    sessionBolts.current = 0;
    stinkMeter.current = 0;
    boostTimer.current = 0;
    onStickyPlatform.current = null;
    
    // Create starting platform
    let lastPlatform: Platform = { x: 210, y: 600, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'normal' };
    platforms.current.push(lastPlatform);

    // Generate platforms one by one (original Doodle Jump style)
    while(platforms.current.length < PLATFORM_COUNT) {
        const newPlatform = generateNextPlatform(lastPlatform);
        platforms.current.push(newPlatform);
        lastPlatform = newPlatform;
    }
    gameState.current = 'playing';
  }, []);

  const addToStinkMeter = (amount: number) => {
      stinkMeter.current = Math.min(METER_MAX, stinkMeter.current + amount);
      if (stinkMeter.current >= METER_MAX) {
          boostTimer.current = BOOST_DURATION;
          stinkMeter.current = 0;
      }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keys.current[key] = true;
    if (key === ' ') {
        if (gameState.current === 'waiting') {
            resetGame();
        } else if (gameState.current !== 'playing' && (!enableMultiplayer || raceFinished)) {
            resetGame();
        }
    }
    
    // No manual jumping in original Doodle Jump - player auto-jumps on platform contact
  }, [resetGame]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keys.current[e.key.toLowerCase()] = false;
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Auto start for multiplayer sessions
    if (enableMultiplayer) {
      resetGame();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, enableMultiplayer, resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrameId: number;
    
    const gameLoop = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      if (imagesLoaded && images.current['background']) {
        // Draw tiled background with parallax effect
        const bgImg = images.current['background'];
        const scale = canvas.width / bgImg.width;
        const scaledHeight = bgImg.height * scale;
        const yOffset = 0; // статичный фон, не двигаем по Y

        for (let y = -scaledHeight + yOffset; y < canvas.height + scaledHeight; y += scaledHeight) {
          context.drawImage(bgImg, 0, y, canvas.width, scaledHeight);
        }
      } else {
        // Fallback to solid color
        context.fillStyle = '#1a202c';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (gameState.current === 'waiting') {
          context.fillStyle = 'white';
          context.font = '24px Arial';
          context.textAlign = 'center';
          if (!imagesLoaded) {
            context.fillText('Loading game assets...', canvas.width / 2, canvas.height / 2);
          } else {
            context.fillText('Press SPACE to Start', canvas.width / 2, canvas.height / 2);
          }
      } else if (gameState.current === 'playing') {
        if (frozen) {
            // Just draw player and platforms without physics
            platforms.current.forEach(p => {
                if (!p.isBroken) {
                    // Draw platform with texture if available
                    if (imagesLoaded && images.current[`platform_${p.type}`]) {
                        const platformImg = images.current[`platform_${p.type}`];
                        context.drawImage(platformImg, p.x, p.y, p.width, p.height);
                    } else {
                        // Fallback to colored rectangle
                        context.fillStyle = PLATFORM_COLORS[p.type];
                        context.fillRect(p.x, p.y, p.width, p.height);
                    }
                }
            });
            if (imagesLoaded && images.current[`skin_${currentSkin}`]) {
                const skinImg = images.current[`skin_${currentSkin}`];
                context.drawImage(skinImg, player.current.x - 9, player.current.y - 8, player.current.width + 18, player.current.height + 16);
            } else {
                context.fillStyle = SKINS[currentSkin].color;
                context.fillRect(player.current.x, player.current.y, player.current.width, player.current.height);
            }
            animationFrameId = window.requestAnimationFrame(gameLoop);
            return;
        }
        // --- Boost Logic ---
        if (boostTimer.current > 0) {
            player.current.vy = -10; // Rocket speed
            boostTimer.current--;
        } else {
             // --- Physics & Updates (Original Doodle Jump style) ---
            if (keys.current['arrowleft'] || keys.current['a']) player.current.vx = -MOVE_SPEED;
            else if (keys.current['arrowright'] || keys.current['d']) player.current.vx = MOVE_SPEED;
            else player.current.vx = 0;
            
            // Always apply gravity (no sticky platforms in original Doodle Jump)
            player.current.vy += GRAVITY;
        }
        player.current.x += player.current.vx;
        player.current.y += player.current.vy;
       

        // --- Camera Movement ---
        if (player.current.y < canvas.height / 2) {
            const yOffset = canvas.height / 2 - player.current.y;
            player.current.y = canvas.height / 2;
            platforms.current.forEach(p => {
                p.y += yOffset;
                if(p.collectible) p.collectible.y += yOffset;
            });
            score.current += Math.floor(yOffset);
            if (enableMultiplayer && socket?.connected) {
                // Send score update if changed by >=10
                if (score.current - lastSentScore.current >= 10) {
                    socket.emit('player-score', score.current);
                    lastSentScore.current = score.current;
                }
            }
        }

        // Wall wrap-around
        if (player.current.x > canvas.width) player.current.x = 0 - player.current.width;
        else if (player.current.x + player.current.width < 0) player.current.x = canvas.width;

        let onAnyPlatformThisFrame = false;
        // Platform collision & logic
        platforms.current.forEach(platform => {
            // Update moving platforms
            if (platform.speed) {
                platform.x += platform.speed;
                if (platform.x <= 0 || platform.x + platform.width >= canvas.width) {
                    platform.speed *= -1;
                }
            }

            // Collectible collision
            if (platform.collectible && !platform.collectible.isCollected) {
                const p = player.current;
                const c = platform.collectible;
                const collectibleSize = COLLECTIBLE_SIZE * 1.5;
                if (
                    ((p.x + p.width/2) > c.x - collectibleSize/4) &&
                    ((p.x + p.width/2) < c.x + collectibleSize - collectibleSize/4) &&
                    p.y < c.y + collectibleSize - collectibleSize/4 &&
                    p.y + p.height > c.y - collectibleSize/4
                ) {
                    c.isCollected = true;
                    sessionBolts.current += 1;
                    addToStinkMeter(10);
                }
            }

            // Platform collision detection (only when falling)
            if (
              boostTimer.current <= 0 && // No collision during boost
              player.current.vy >= 0 && // Only when falling
              !platform.isBroken &&
              ((player.current.x + player.current.width/2) > platform.x) &&
              ((player.current.x + player.current.width/2) < platform.x + platform.width) &&
              player.current.y + player.current.height > platform.y &&
              player.current.y + player.current.height < platform.y + platform.height + 15
            ) {
              onAnyPlatformThisFrame = true;
              
              // Handle different platform types (original Doodle Jump style)
              if (platform.type === 'bouncy') {
                  player.current.vy = SUPER_JUMP_FORCE;
                  addToStinkMeter(7);
              } else {
                  player.current.vy = JUMP_FORCE;
              }
            
              if (platform.type === 'breakable') {
                  platform.isBroken = true;
                  addToStinkMeter(5);
              }
            }
        });

        // Clear sticky platform reference (not used in original Doodle Jump style)
        if (!onAnyPlatformThisFrame) { onStickyPlatform.current = null; }
        
        // --- Platform Generation ---
        let highestPlatform = platforms.current.length > 0 
            ? platforms.current.reduce((prev, current) => (prev.y < current.y) ? prev : current) 
            : { y: canvas.height, x: canvas.width/2, width: 0, height: 0, type: 'normal' } as Platform;
        platforms.current = platforms.current.filter(p => p.y < canvas.height + 100);
        while (platforms.current.length < PLATFORM_COUNT) {
            const newPlatform = generateNextPlatform(highestPlatform);
            platforms.current.push(newPlatform);
            highestPlatform = newPlatform;
        }

        // --- Game Over Check ---
        if (player.current.y > canvas.height + 100) {
            saveProgress(sessionBolts.current);
            gameState.current = 'gameOver';
            if (enableMultiplayer && socket?.connected) {
                socket.emit('player-died');
            }
        }

        // --- Drawing ---
        platforms.current.forEach(p => {
            if (!p.isBroken) {
                // Draw platform with texture if available
                if (imagesLoaded && images.current[`platform_${p.type}`]) {
                    const platformImg = images.current[`platform_${p.type}`];
                    context.drawImage(platformImg, p.x, p.y, p.width, p.height);
                } else {
                    // Fallback to colored rectangle
                    context.fillStyle = PLATFORM_COLORS[p.type];
                    context.fillRect(p.x, p.y, p.width, p.height);
                }
                
                // Show direction arrows for moving platforms
                if (p.type === 'moving' && p.speed) {
                    context.fillStyle = 'white';
                    context.font = '12px Arial';
                    context.textAlign = 'center';
                    context.fillText(p.speed > 0 ? '→' : '←', p.x + p.width / 2, p.y + p.height - 3);
                }
                
                // Draw collectibles
                if (p.collectible && !p.collectible.isCollected) {
                    if (imagesLoaded && images.current['collectible']) {
                        const collectibleImg = images.current['collectible'];
                        const collectibleSize = COLLECTIBLE_SIZE * 1.5; // Немного больше чем оригинал
                        context.drawImage(collectibleImg, p.collectible.x - collectibleSize/4, p.collectible.y - collectibleSize/4, collectibleSize, collectibleSize);
                    } else {
                        // Fallback to colored rectangle
                        context.fillStyle = COLLECTIBLE_COLOR;
                        context.fillRect(p.collectible.x, p.collectible.y, COLLECTIBLE_SIZE, COLLECTIBLE_SIZE);
                    }
                }
            }
        });
        
        if (imagesLoaded && images.current[`skin_${currentSkin}`]) {
            const skinImg = images.current[`skin_${currentSkin}`];
            context.drawImage(skinImg, player.current.x - 9, player.current.y - 8, player.current.width + 18, player.current.height + 16);
        } else {
            context.fillStyle = SKINS[currentSkin].color;
            context.fillRect(player.current.x, player.current.y, player.current.width, player.current.height);
        }
        if (boostTimer.current > 0) {
            context.fillStyle = 'rgba(255, 255, 0, 0.5)';
            context.fillRect(player.current.x - 5, player.current.y, player.current.width + 10, player.current.height);
        }

        // --- UI ---
        context.fillStyle = 'white';
        context.font = '20px Arial';
        context.textAlign = 'left';
        context.fillText(`Score: ${score.current}`, 10, 30);
        context.fillText(`🔩: ${sessionBolts.current}`, 10, 55);

        // Stink-o-Meter
        context.fillStyle = '#555';
        context.fillRect(canvas.width - 120, 10, 110, 20);
        context.fillStyle = 'purple';
        context.fillRect(canvas.width - 118, 12, (stinkMeter.current / METER_MAX) * 106, 16);
        context.strokeStyle = 'white';
        context.strokeRect(canvas.width - 120, 10, 110, 20);

        // --- Draw Opponents ---
        if (enableMultiplayer) {
            Object.values(opponents.current).forEach(opp => {
                // Smooth X toward target
                opp.drawX += (opp.x - opp.drawX) * 0.2;
                // Compute desired Y based on score difference (myScore - oppScore)
                const targetY = player.current.y + (score.current - opp.score);
                opp.drawY += (targetY - opp.drawY) * 0.2;
                const oppSprite = imagesLoaded && images.current['skin_rusty'];
                if (oppSprite) {
                    context.save();
                    context.globalAlpha = opp.isAlive ? 0.5 : 0.25;
                    context.drawImage(oppSprite, opp.drawX - 9, opp.drawY - 8, PLAYER_WIDTH + 18, PLAYER_HEIGHT + 16);
                    context.restore();
                } else {
                    const oppColor = opp.isAlive ? 'rgba(255,255,255,0.3)' : 'rgba(128,128,128,0.2)';
                    context.fillStyle = oppColor;
                    context.fillRect(opp.drawX, opp.drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
                }
                // Username
                context.fillStyle = 'white';
                context.font = '12px Arial';
                context.textAlign = 'center';
                context.fillText(opp.username, opp.drawX + PLAYER_WIDTH / 2, opp.drawY - 4);
            });
        }

        // Send position throttled every 100ms
        if (enableMultiplayer && socket?.connected) {
            const now = Date.now();
            if (now - lastPosSentAt.current > 100) {
                socket.emit('player-position', {
                    x: player.current.x,
                    y: player.current.y,
                    vx: player.current.vx,
                    vy: player.current.vy,
                });
                lastPosSentAt.current = now;
            }
        }

      } else if (gameState.current === 'gameOver') {
        context.fillStyle = 'white';
        context.font = '48px Arial';
        context.textAlign = 'center';
        context.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 40);
        context.font = '24px Arial';
        context.fillText(`Final Score: ${score.current}`, canvas.width / 2, canvas.height / 2);
        context.fillText(`Bolts collected: ${sessionBolts.current}`, canvas.width / 2, canvas.height / 2 + 40);
        context.font = '18px Arial';
        if (!enableMultiplayer || raceFinished) {
            context.fillText('Press SPACE to Restart', canvas.width / 2, canvas.height / 2 + 80);
        } else {
            context.fillText('Waiting for race to finish...', canvas.width / 2, canvas.height / 2 + 80);
        }
      }
      
      animationFrameId = window.requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [resetGame, saveProgress, imagesLoaded]);

  // --- Multiplayer listeners ---
  useEffect(() => {
    if (!enableMultiplayer || !socket) return;

    const handleOpponentPos = (payload: any) => {
      const { playerId, position, username } = payload;
      if (playerId === socket.id) return;
      const existing = opponents.current[playerId];
      if (existing) {
        existing.x = position.x;
        existing.y = position.y;
      } else {
        opponents.current[playerId] = {
          x: position.x,
          y: position.y,
          drawX: position.x,
          drawY: position.y,
          isAlive: true,
          score: 0,
          username: username || 'Opp',
        };
      }
    };

    const handleScoreUpdate = (payload: any) => {
      const { playerId, score, username } = payload;
      if (playerId === socket.id) return;
      if (!opponents.current[playerId]) {
        opponents.current[playerId] = {
          x: 0,
          y: 0,
          drawX: 0,
          drawY: 0,
          isAlive: true,
          score,
          username: username || 'Opp'
        };
      } else {
        opponents.current[playerId].score = score;
      }
    };

    const handleOpponentDied = (payload: any) => {
      const { playerId } = payload;
      if (opponents.current[playerId]) {
        opponents.current[playerId].isAlive = false;
      }
    };

    socket.on('opponent-position', handleOpponentPos);
    socket.on('score-update', handleScoreUpdate);
    socket.on('player-died', handleOpponentDied);

    return () => {
      socket.off('opponent-position', handleOpponentPos);
      socket.off('score-update', handleScoreUpdate);
      socket.off('player-died', handleOpponentDied);
    };
  }, [enableMultiplayer, socket]);

  return (
    <div className="flex flex-col items-center justify-center">
        <div className="w-full bg-gray-800 rounded-lg p-4">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Trash Tower</h2>
            <canvas
                ref={canvasRef}
                width={480}
                height={640}
                className="bg-gray-700 rounded-md mx-auto block"
                style={{ touchAction: 'none' }}
            />
        </div>
        {/* Workshop UI removed – now handled in separate SkinShop component */}
    </div>
  );
};

export default TrashTowerGame; 