import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { BarChart3, Users, Gamepad2, Zap, Trophy, RefreshCw, Flame, Award, Layers } from 'lucide-react';

interface AdminAnalyticsProps {
  students?: User[];
  onRefreshData?: () => void;
}

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
      const token = localStorage.getItem('hero_rank_token');
      const res = await fetch('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.analytics) {
        setData(json.analytics);
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
          <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-black flex items-center gap-2">
            <BarChart3 className="w-8 h-8 stroke-[2.5]" />
            EVENT ANALYTICS & INSIGHTS
          </h2>
          <p className="text-xs font-bold uppercase text-black/90 mt-1">
            Real-time event summary metrics and player distribution for college tournament performance.
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

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
          <div className="flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase tracking-wider">TOTAL PARTICIPANTS</span>
            <Users className="w-6 h-6 text-[#219EBC]" />
          </div>
          <p className="text-4xl font-black text-black font-mono">{displayData.totalParticipants}</p>
          <p className="text-[10px] font-bold text-slate-600 uppercase">Verified College Student Gamers</p>
        </div>

        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
          <div className="flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase tracking-wider">TOTAL MATCHES LOGGED</span>
            <Gamepad2 className="w-6 h-6 text-[#D90429]" />
          </div>
          <p className="text-4xl font-black text-black font-mono">{displayData.totalGamesPlayed}</p>
          <p className="text-[10px] font-bold text-slate-600 uppercase">Matches Completed Across 8 Games</p>
        </div>

        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
          <div className="flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase tracking-wider">TOTAL XP DISTRIBUTED</span>
            <Zap className="w-6 h-6 text-[#FFB703] fill-[#FFB703]" />
          </div>
          <p className="text-4xl font-black text-[#D90429] font-mono">{displayData.totalXpAwarded.toLocaleString()} XP</p>
          <p className="text-[10px] font-bold text-slate-600 uppercase">Distributed Event Points</p>
        </div>

        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
          <div className="flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase tracking-wider">MOST PLAYED GAME</span>
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-xl font-black text-black uppercase italic truncate">{displayData.mostPlayedGame}</p>
          <p className="text-[10px] font-bold text-slate-600 uppercase">Highest Match Participation</p>
        </div>

        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
          <div className="flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase tracking-wider">CURRENT #1 LEADER</span>
            <Award className="w-6 h-6 text-[#FFB703]" />
          </div>
          <p className="text-lg font-black text-[#D90429] uppercase italic truncate">{displayData.currentLeader}</p>
          <p className="text-[10px] font-bold text-slate-600 uppercase">Top Event Player</p>
        </div>

        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-2">
          <div className="flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase tracking-wider">AVERAGE XP / PLAYER</span>
            <BarChart3 className="w-6 h-6 text-[#219EBC]" />
          </div>
          <p className="text-4xl font-black text-black font-mono">{displayData.averageXp} XP</p>
          <p className="text-[10px] font-bold text-slate-600 uppercase">Mean XP Accumulation</p>
        </div>
      </div>

      {/* Tier Distribution Breakdown */}
      <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-black pb-3">
          <Layers className="w-5 h-5 text-black stroke-[2.5]" />
          <h3 className="text-base font-black uppercase italic text-black">PLAYER RANK TIER DISTRIBUTION</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-amber-50 border-2 border-amber-500 shadow-[3px_3px_0_0_#000] text-center space-y-1">
            <span className="px-2 py-0.5 bg-amber-400 text-black font-black text-[10px] uppercase border border-black inline-block">
              LEGEND (150+ XP)
            </span>
            <p className="text-3xl font-black font-mono text-black">{displayData.tierCounts.Legend}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Players</p>
          </div>

          <div className="p-4 bg-purple-50 border-2 border-purple-500 shadow-[3px_3px_0_0_#000] text-center space-y-1">
            <span className="px-2 py-0.5 bg-purple-400 text-white font-black text-[10px] uppercase border border-black inline-block">
              NOVA (79-149 XP)
            </span>
            <p className="text-3xl font-black font-mono text-black">{displayData.tierCounts.Nova}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Players</p>
          </div>

          <div className="p-4 bg-rose-50 border-2 border-rose-500 shadow-[3px_3px_0_0_#000] text-center space-y-1">
            <span className="px-2 py-0.5 bg-rose-400 text-white font-black text-[10px] uppercase border border-black inline-block">
              BLAZE (39-78 XP)
            </span>
            <p className="text-3xl font-black font-mono text-black">{displayData.tierCounts.Blaze}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Players</p>
          </div>

          <div className="p-4 bg-slate-50 border-2 border-slate-400 shadow-[3px_3px_0_0_#000] text-center space-y-1">
            <span className="px-2 py-0.5 bg-slate-200 text-black font-black text-[10px] uppercase border border-black inline-block">
              SPARK (0-38 XP)
            </span>
            <p className="text-3xl font-black font-mono text-black">{displayData.tierCounts.Spark}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase">Players</p>
          </div>
        </div>
      </div>
    </div>
  );
};

