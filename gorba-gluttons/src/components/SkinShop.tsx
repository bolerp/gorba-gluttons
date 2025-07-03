import React, { useEffect, useState } from 'react';

// Список скинов (должен соответствовать TrashTowerGame)
const SKINS = {
  rusty: { name: 'Rusty', color: '#b7791f', price: 0 },
  plastic: { name: 'Plastic', color: '#38bdf8', price: 100 },
  toxic: { name: 'Toxic', color: '#38a169', price: 250 },
};

export type SkinKey = keyof typeof SKINS;

const BOLTS_KEY = 'trash_tower_bolts';
const UNLOCKED_KEY = 'trash_tower_unlocked_skins';
const CURRENT_KEY = 'trash_tower_current_skin';

const SkinShop: React.FC = () => {
  const [totalBolts, setTotalBolts] = useState<number>(0);
  const [unlockedSkins, setUnlockedSkins] = useState<SkinKey[]>(['rusty']);
  const [currentSkin, setCurrentSkin] = useState<SkinKey>('rusty');

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
      alert(`${skinData.name} skin unlocked!`);
    }
  };

  const selectSkin = (skin: SkinKey) => {
    if (!unlockedSkins.includes(skin)) return;
    setCurrentSkin(skin);
    localStorage.setItem(CURRENT_KEY, skin);
  };

  return (
    <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
      <h3 className="text-2xl font-bold text-white mb-4 text-center">Trash Tower Skin Shop</h3>
      <p className="text-center text-gray-300 mb-6">Your Bolts: <span className="text-yellow-300 font-bold">🔩{totalBolts}</span></p>
      <div className="grid md:grid-cols-3 gap-4">
        {(Object.keys(SKINS) as SkinKey[]).map((skinKey) => {
          const data = SKINS[skinKey];
          const unlocked = unlockedSkins.includes(skinKey);
          const selected = currentSkin === skinKey;
          return (
            <div key={skinKey} className="bg-gray-800/60 p-4 rounded-lg text-center border border-gray-700">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full" style={{ backgroundColor: data.color }} />
              <h4 className="text-lg font-bold text-white mb-2">{data.name}</h4>
              {unlocked ? (
                <button
                  disabled={selected}
                  onClick={() => selectSkin(skinKey)}
                  className={`w-full py-2 rounded-lg font-bold transition-colors ${
                    selected ? 'bg-lime-600 cursor-default' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {selected ? 'Selected' : 'Equip'}
                </button>
              ) : (
                <button
                  onClick={() => purchaseSkin(skinKey)}
                  className={`w-full py-2 rounded-lg font-bold bg-yellow-600 hover:bg-yellow-500 transition-colors ${
                    totalBolts < data.price ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={totalBolts < data.price}
                >
                  Buy 🔩{data.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SkinShop; 