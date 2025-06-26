import { Copy, Crown, Trophy } from "lucide-react";
import { Referral } from "@/types";

interface Props {
  address: string;
  bonus: number;
  referrals: Referral[];
  rank: number;
  stinkScore: number;
  onToast?: (msg: string) => void;
}

export default function ReferralDashboard({ address, bonus, referrals, rank, stinkScore, onToast }: Props) {
  const copyLink = () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}?ref=${address}`;
    const text = `🗑️ I'm rank #${rank} on Gorba-Gluttons with ${stinkScore.toLocaleString()} STINK! 💨\n\nFeed the beast and climb the heap! 👑\n\nUse my link: ${shareUrl}\n\n#GorbaGluttons #Gorbagana #KingOfTheHeap`;
    navigator.clipboard.writeText(text).then(() => {
      onToast?.("Invite text copied! Share it with friends 🗑️");
    });
  };

  return (
    <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4 space-y-3 max-w-md">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">My Referrals</h3>
        <button
          onClick={copyLink}
          className="flex items-center space-x-1 px-3 py-1.5
                     bg-gradient-to-r from-lime-500 to-green-500 text-black
                     rounded-md shadow-md border border-lime-400
                     hover:from-lime-400 hover:to-green-400
                     active:scale-95 transition"
        >
          <Copy className="w-4 h-4" />
          <span className="text-sm font-semibold">Copy&nbsp;invite</span>
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-1">Earn <span className="text-lime-400 font-semibold">30%</span> of your direct referral's base STINK and <span className="text-lime-400 font-semibold">10%</span> from referrals of your referrals.</p>
      <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
        <span>Total referral bonus: <span className="text-yellow-400 font-mono">{bonus.toLocaleString()}</span></span>
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1">
            <Crown className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-400">{referrals.filter(r => r.level === 1).length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trophy className="w-3 h-3 text-gray-400" />
            <span className="text-gray-400">{referrals.filter(r => r.level === 2).length}</span>
          </div>
        </div>
      </div>
      {referrals.length === 0 ? (
        <div className="text-gray-500 text-sm">No referrals yet.</div>
      ) : (
        <div className="max-h-64 overflow-y-auto border-t border-gray-800 pt-2 divide-y divide-gray-800">
          {/* Header */}
          <div className="grid grid-cols-12 py-2 text-xs text-gray-400 px-1 sticky top-0 bg-gray-900/90 backdrop-blur-sm z-10">
            <span className="col-span-1">#</span>
            <span className="col-span-6">Player</span>
            <span className="col-span-2 text-center">Lvl</span>
            <span className="col-span-3 text-right">My Bonus</span>
          </div>

          {/* Rows */}
          {referrals.map((r, idx) => (
            <div key={r.wallet} className={`grid grid-cols-12 items-center py-2 px-1 text-sm ${idx % 2 === 0 ? 'bg-gray-800/40' : 'bg-gray-800/20'}`}>
              <span className="col-span-1 text-gray-400 font-mono">{idx + 1}</span>
              <div className="col-span-6">
                <div className="truncate text-white">
                  {r.nickname ?? r.wallet.slice(0,4)+"…"+r.wallet.slice(-4)}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {r.total_score.toLocaleString()} STINK
                </div>
              </div>
              <div className="col-span-2 text-center">
                {r.level === 1 ? (
                  <div className="flex items-center justify-center">
                    <Crown className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs text-yellow-400 ml-1">L1</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Trophy className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400 ml-1">L2</span>
                  </div>
                )}
              </div>
              <span className="col-span-3 text-right text-lime-400 font-mono">
                +{r.bonus_earned.toLocaleString()}
              </span>
              {/* Progress bar */}
              <div className="col-span-12 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full ${r.level === 1 ? 'bg-yellow-500' : 'bg-gray-500'}`}
                  style={{ 
                    width: `${Math.max(5, (r.bonus_earned / Math.max(1, Math.max(...referrals.map(rr=>rr.bonus_earned)))) * 100)}%` 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 