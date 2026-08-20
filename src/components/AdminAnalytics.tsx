import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Gamepad2, Zap, Trophy, RefreshCw } from 'lucide-react';

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ students = [], onRefreshData }) => {
  const [data, setData] = useState<{
    totalParticipants: number;
    totalGamesPlayed: number;
    totalXpAwarded: number;
    mostPlayedGame: string;
    currentLeader: string;
    totalWins: number;
    averageXp: number;
    tierCounts?: {
      Legend: number;
      Nova: number;
      Blaze: number;
      Spark: number;
    };
    gameBreakdown?: Record<string, number>;
  } | null>(null);
  const [xpHistory, setXpHistory] = useState<XpHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute live fallback from students array
  const liveParticipants = students.length;
  const liveXpAwarded = students.reduce((sum, s) => sum + (s.xp || 0), 0);
  const liveGamesPlayed = students.reduce((sum, s) => sum + (s.gamesPlayed || 0), 0);
  const liveTotalWins = students.reduce((sum, s) => sum + (s.wins || 0), 0);
  const sortedLive = [...students].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const liveLeader = sortedLive.length > 0 ? `${sortedLive[0].fullName} (@${sortedLive[0].gamerTag})` : 'None';
  const liveAverageXp = liveParticipants > 0 ? Math.round(liveXpAwarded / liveParticipants) : 0;

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('hero_rank_token');
      const res = await fetch('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.analytics) {
        setData(json.analytics);
      }
      if (json.xpHistory) {
        setXpHistory(json.xpHistory);
      } else {
        // Fallback fetch for XP History
        const xpRes = await fetch('/api/xp/history');
        const xpJson = await xpRes.json();
        if (xpJson.xpHistory) setXpHistory(xpJson.xpHistory);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchAnalytics();
    onRefreshData?.();
  };

  useEffect(() => {
    fetchAnalytics();
  }, [students.length]);

  const displayData = {
    totalParticipants: data?.totalParticipants ?? liveParticipants,
    totalGamesPlayed: Math.max(data?.totalGamesPlayed ?? 0, liveGamesPlayed),
    totalXpAwarded: Math.max(data?.totalXpAwarded ?? 0, liveXpAwarded),
    mostPlayedGame: data?.mostPlayedGame || (liveGamesPlayed > 0 ? 'Multiple Events' : 'None'),
    currentLeader: data?.currentLeader && data.currentLeader !== 'None' ? data.currentLeader : liveLeader,
    totalWins: Math.max(data?.totalWins ?? 0, liveTotalWins),
    averageXp: Math.max(data?.averageXp ?? 0, liveAverageXp),
    tierCounts: data?.tierCounts || {
      Legend: students.filter((s) => s.rankTier === 'Legend').length,
      Nova: students.filter((s) => s.rankTier === 'Nova').length,
      Blaze: students.filter((s) => s.rankTier === 'Blaze').length,
      Spark: students.filter((s) => s.rankTier === 'Spark' || !s.rankTier).length
    },
    gameBreakdown: data?.gameBreakdown || {}
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="bg-[#FFB703] border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-black">
            EVENT ANALYTICS & INSIGHTS
          </h2>
          <p className="text-xs font-bold uppercase text-black/90 mt-1">
            Real-time event summary metrics for college gaming tournament performance.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 bg-[#D90429] hover:bg-[#b00320] text-white border-2 border-black shadow-[2px_2px_0_0_#000] cursor-pointer flex items-center gap-1.5 text-xs font-black uppercase"
        >
          <RefreshCw className={`w-4 h-4 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {loading || !data ? (
        <div className="bg-white border-4 border-black p-12 text-center font-mono font-bold text-xs">
          Loading analytics metrics...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
            <div className="flex items-center justify-between text-black">
              <span className="text-xs font-black uppercase tracking-wider">TOTAL PARTICIPANTS</span>
              <Users className="w-6 h-6 text-[#219EBC]" />
            </div>
            <p className="text-4xl font-black text-black font-mono">{data.totalParticipants}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Verified College Student Gamers</p>
          </div>

          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
            <div className="flex items-center justify-between text-black">
              <span className="text-xs font-black uppercase tracking-wider">TOTAL GAMES LOGGED</span>
              <Gamepad2 className="w-6 h-6 text-[#D90429]" />
            </div>
            <p className="text-4xl font-black text-black font-mono">{data.totalGamesPlayed}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Matches Completed Across 8 Games</p>
          </div>

          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
            <div className="flex items-center justify-between text-black">
              <span className="text-xs font-black uppercase tracking-wider">TOTAL XP AWARDED</span>
              <Zap className="w-6 h-6 text-[#FFB703] fill-[#FFB703]" />
            </div>
            <p className="text-4xl font-black text-[#D90429] font-mono">{data.totalXpAwarded.toLocaleString()} XP</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Distributed Event Points</p>
          </div>

          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
            <div className="flex items-center justify-between text-black">
              <span className="text-xs font-black uppercase tracking-wider">MOST PLAYED GAME</span>
              <Trophy className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-black uppercase italic">{data.mostPlayedGame}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Highest Match Participation</p>
          </div>

          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
            <div className="flex items-center justify-between text-black">
              <span className="text-xs font-black uppercase tracking-wider">CURRENT #1 LEADER</span>
              <Trophy className="w-6 h-6 text-[#FFB703]" />
            </div>
            <p className="text-xl font-black text-[#D90429] uppercase italic truncate">{data.currentLeader}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Top Event Player</p>
          </div>

          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
            <div className="flex items-center justify-between text-black">
              <span className="text-xs font-black uppercase tracking-wider">AVERAGE XP / PLAYER</span>
              <BarChart3 className="w-6 h-6 text-[#219EBC]" />
            </div>
            <p className="text-3xl font-black text-black font-mono">{data.averageXp} XP</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Mean XP Accumulation</p>
          </div>
        </div>
      </div>
    </div >
  );
};

