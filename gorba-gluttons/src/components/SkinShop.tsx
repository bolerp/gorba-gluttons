import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Список скинов с описанями и редкостью
const SKINS = {
  rusty: { 
    name: 'Rusty Gorba', 
    image: '/race/gorba/gorba_rusty.png', 
    price: 0,
    rarity: 'Common',
    description: 'The original trash collector. Battle-tested and reliable.',
    rarityColor: '#94a3b8'
  },
  plastic: { 
    name: 'Plastic Gorba', 
    image: '/race/gorba/gorba_plastic.png', 
    price: 100,
    rarity: 'Rare',
    description: 'Sleek and modern. Perfect for the eco-conscious collector.',
    rarityColor: '#60a5fa'
  },
  toxic: { 
    name: 'Toxic Gorba', 
    image: '/race/gorba/gorba_toxic.png', 
    price: 250,
    rarity: 'Epic',
    description: 'Radioactive and dangerous. Only for the bravest trash kings.',
    rarityColor: '#34d399'
  },
};

export type SkinKey = keyof typeof SKINS;

const BOLTS_KEY = 'trash_tower_bolts';
const UNLOCKED_KEY = 'trash_tower_unlocked_skins';
const CURRENT_KEY = 'trash_tower_current_skin';

const SkinShop: React.FC = () => {
  const [totalBolts, setTotalBolts] = useState<number>(0);
  const [unlockedSkins, setUnlockedSkins] = useState<SkinKey[]>(['rusty']);
  const [currentSkin, setCurrentSkin] = useState<SkinKey>('rusty');
  const [selectedPreview, setSelectedPreview] = useState<SkinKey>('rusty');

  // Load from localStorage on mount
  useEffect(() => {
    const bolts = parseInt(localStorage.getItem(BOLTS_KEY) || '0', 10);
    setTotalBolts(bolts);

    const unlockedRaw = localStorage.getItem(UNLOCKED_KEY);
    if (unlockedRaw) {
      const parsed: SkinKey[] = JSON.parse(unlockedRaw).map((s: string) => (s === 'default' ? 'rusty' : s));
      setUnlockedSkins(parsed.length ? parsed : ['rusty']);
    }

    const curRaw = localStorage.getItem(CURRENT_KEY);
    const migrated = curRaw === 'default' || !curRaw ? 'rusty' : (curRaw as SkinKey);
    setCurrentSkin(migrated as SkinKey);
    setSelectedPreview(migrated as SkinKey);
  }, []);

  // Purchase skin
  const purchaseSkin = (skin: SkinKey) => {
    const skinData = SKINS[skin];
    if (totalBolts >= skinData.price && !unlockedSkins.includes(skin)) {
      const newTotal = totalBolts - skinData.price;
      const newUnlocked = [...unlockedSkins, skin];
      setTotalBolts(newTotal);
      setUnlockedSkins(newUnlocked);
      localStorage.setItem(BOLTS_KEY, newTotal.toString());
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(newUnlocked));
    }
  };

  const selectSkin = (skin: SkinKey) => {
    if (!unlockedSkins.includes(skin)) return;
    setCurrentSkin(skin);
    localStorage.setItem(CURRENT_KEY, skin);
  };

  const previewedSkin = SKINS[selectedPreview];

  return (
    <div className="bg-gradient-to-b from-gray-900/40 to-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-8 shadow-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h3 
          className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🗑️ Gorba's Trash Emporium
        </motion.h3>
        <p className="text-gray-300 text-lg">Premium Skins for Distinguished Collectors</p>
        
        {/* Bolts Display */}
        <motion.div 
          className="inline-flex items-center bg-yellow-500/10 border border-yellow-500/30 rounded-full px-6 py-2 mt-4"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-2xl mr-2">🔩</span>
          <span className="text-yellow-300 font-bold text-xl">{totalBolts}</span>
          <span className="text-gray-400 ml-2">Bolts</span>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Preview Area */}
        <motion.div 
          className="lg:col-span-1 bg-gray-800/40 rounded-xl border border-gray-600/50 p-6"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h4 className="text-xl font-bold text-white mb-4 text-center">Preview</h4>
          
          {/* Large Skin Preview */}
          <div className="relative bg-gradient-to-br from-gray-700/50 to-gray-900/50 rounded-lg p-8 mb-4 h-48 flex items-center justify-center border border-gray-600/30">
            <motion.img 
              key={selectedPreview}
              src={previewedSkin.image} 
              alt={previewedSkin.name}
              className="max-w-full max-h-full object-contain drop-shadow-lg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            />
            
            {/* Rarity Badge */}
            <div 
              className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold border"
              style={{ 
                backgroundColor: `${previewedSkin.rarityColor}20`,
                borderColor: previewedSkin.rarityColor,
                color: previewedSkin.rarityColor
              }}
            >
              {previewedSkin.rarity}
            </div>
          </div>

          {/* Skin Info */}
          <div className="text-center">
            <h5 className="text-lg font-bold text-white mb-2">{previewedSkin.name}</h5>
            <p className="text-gray-400 text-sm mb-4">{previewedSkin.description}</p>
            
            {/* Action Button */}
            {unlockedSkins.includes(selectedPreview) ? (
              currentSkin === selectedPreview ? (
                <div className="bg-lime-500/20 border border-lime-500 text-lime-400 px-4 py-2 rounded-lg font-bold">
                  ✓ Equipped
                </div>
              ) : (
                <motion.button
                  onClick={() => selectSkin(selectedPreview)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Equip Skin
                </motion.button>
              )
            ) : (
              <motion.button
                onClick={() => purchaseSkin(selectedPreview)}
                disabled={totalBolts < previewedSkin.price}
                className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center justify-center mx-auto ${
                  totalBolts < previewedSkin.price 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
                whileHover={totalBolts >= previewedSkin.price ? { scale: 1.05 } : {}}
                whileTap={totalBolts >= previewedSkin.price ? { scale: 0.95 } : {}}
              >
                <span className="mr-2">🔩</span>
                {previewedSkin.price === 0 ? 'Free' : `${previewedSkin.price} Bolts`}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Skins Grid */}
        <div className="lg:col-span-2">
          <h4 className="text-xl font-bold text-white mb-6">Available Skins</h4>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(Object.keys(SKINS) as SkinKey[]).map((skinKey, index) => {
              const data = SKINS[skinKey];
              const unlocked = unlockedSkins.includes(skinKey);
              const selected = currentSkin === skinKey;
              const previewing = selectedPreview === skinKey;
              
              return (
                <motion.div
                  key={skinKey}
                  className={`relative bg-gray-800/60 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                    previewing 
                      ? 'border-yellow-500/70 shadow-lg shadow-yellow-500/20' 
                      : 'border-gray-600/50 hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedPreview(skinKey)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                >
                  {/* Skin Image */}
                  <div className="relative h-32 bg-gradient-to-br from-gray-700/30 to-gray-900/30 flex items-center justify-center">
                    <img 
                      src={data.image} 
                      alt={data.name}
                      className="max-w-16 max-h-16 object-contain"
                    />
                    
                    {/* Status Indicators */}
                    {selected && (
                      <div className="absolute top-2 left-2 bg-lime-500 text-black px-2 py-1 rounded-full text-xs font-bold">
                        EQUIPPED
                      </div>
                    )}
                    
                    {!unlocked && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-4xl">🔒</span>
                      </div>
                    )}
                  </div>

                  {/* Skin Info */}
                  <div className="p-4">
                    <h5 className="font-bold text-white text-sm mb-1">{data.name}</h5>
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-xs px-2 py-1 rounded-full border"
                        style={{ 
                          backgroundColor: `${data.rarityColor}20`,
                          borderColor: data.rarityColor,
                          color: data.rarityColor
                        }}
                      >
                        {data.rarity}
                      </span>
                      {!unlocked && (
                        <span className="text-yellow-400 text-sm font-bold">
                          🔩{data.price}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkinShop; 