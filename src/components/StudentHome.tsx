import React, { useState, useEffect } from 'react';
import { User, GameResult } from '../types';
import { Trophy, ShieldCheck, Gamepad2, ArrowRight, UserCheck, Sparkles, History, Award, Zap } from 'lucide-react';

interface StudentHomeProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onNavigateTab: (tab: string) => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({
  currentUser,
  onOpenAuth,
  onNavigateTab
}) => {
  const [history, setHistory] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      fetch(`/api/users/${currentUser.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.gameResults) {
            setHistory(data.gameResults);
          }
        })
        .catch((err) => console.error('Failed to fetch user game history:', err))
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="py-12 px-4 max-w-4xl mx-auto text-center space-y-8">
        <div className="bg-[#FFF9E6] border-4 border-black p-8 shadow-[8px_8px_0_0_#000000] rotate-[-1deg] space-y-6">
          <div className="w-16 h-16 bg-[#FFB703] border-4 border-black shadow-[4px_4px_0_0_#000000] mx-auto flex items-center justify-center">
            <Trophy className="w-8 h-8 text-black stroke-[3]" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-black italic">
            WELCOME TO THE COLLEGE GAMING ARENA!
          </h1>
          <p className="text-sm md:text-base font-bold text-black/80 max-w-2xl mx-auto leading-relaxed">
            The official campus leaderboard and XP hub for Chess, UNO, Drawasourous, Among Us, Antakshiri, Dumb Charades, and Guess the PIN!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#D90429] hover:bg-[#b00320] text-white font-black text-sm uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_#000000] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <UserCheck className="w-5 h-5 stroke-[2.5]" />
              Sign In / Sign Up to Portal
            </button>
            <button
              onClick={() => onNavigateTab('leaderboard')}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#FFB703] hover:bg-[#e0a100] text-black font-black text-sm uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_#000000] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              View Live Leaderboard
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Seven Official Event Games Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { name: 'Chess', xp: '+50 XP' },
            { name: 'UNO', xp: '+25 XP' },
            { name: 'Scribble', xp: '+10 XP' },
            { name: 'Among Us', xp: '+15 XP' },
            { name: 'Antakshiri', xp: '+10 XP' },
            { name: 'Charades', xp: '+5/Movie' },
            { name: 'Guess PIN', xp: '+10 XP' }
          ].map((game, i) => (
            <div
              key={i}
              className="p-3 bg-white border-2 border-black shadow-[2px_2px_0_0_#000000] font-black uppercase text-center"
            >
              <p className="text-xs text-black truncate">{game.name}</p>
              <p className="text-[10px] font-mono text-[#D90429]">{game.xp}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Player Header Banner */}
      <div className="bg-[#FFF9E6] border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0_0_#000000] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-5">
          <img
            src={currentUser.avatar}
            alt={currentUser.gamerTag}
            className="w-20 h-20 sm:w-24 sm:h-24 object-cover border-4 border-black shadow-[3px_3px_0_0_#000000]"
          />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-[#FFB703] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0_0_#000]">
                {currentUser.rankTier} TIER
              </span>
              <span className="px-2.5 py-0.5 bg-[#D90429] text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0_0_#000]">
                {currentUser.department}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black italic">
              {currentUser.fullName}
            </h1>
            <p className="text-sm font-black text-slate-700 uppercase">
              Tag: <span className="text-[#D90429]">@{currentUser.gamerTag}</span> • ID: {currentUser.studentId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full md:w-auto text-center font-mono font-black uppercase">
          <div className="p-3 bg-white border-2 border-black shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] text-slate-500 block">TOTAL XP</span>
            <span className="text-xl sm:text-2xl text-[#D90429]">{currentUser.xp} XP</span>
          </div>
          <div className="p-3 bg-white border-2 border-black shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] text-slate-500 block">MATCHES</span>
            <span className="text-xl sm:text-2xl text-black">{currentUser.gamesPlayed}</span>
          </div>
          <div className="p-3 bg-white border-2 border-black shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] text-slate-500 block">WINS</span>
            <span className="text-xl sm:text-2xl text-[#38B000]">{currentUser.wins}W</span>
          </div>
        </div>
      </div>

      {/* Official Game History Section */}
      <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000000] space-y-4">
        <div className="flex items-center justify-between border-b-4 border-black pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#D90429] stroke-[3]" />
            <h2 className="text-xl font-black uppercase italic text-black">Official Match History</h2>
          </div>
          <span className="text-xs font-mono font-black uppercase bg-[#FFB703] text-black px-2.5 py-1 border-2 border-black">
            {history.length} Matches Recorded
          </span>
        </div>

        {loading ? (
          <p className="text-center py-6 font-black uppercase text-sm">Loading match history...</p>
        ) : history.length === 0 ? (
          <div className="text-center py-8 bg-[#FFF9E6] border-2 border-black p-6 space-y-2">
            <Trophy className="w-10 h-10 text-slate-400 mx-auto stroke-[2]" />
            <p className="font-black text-sm uppercase text-black">No official event results logged yet!</p>
            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto">
              Participate in Chess, UNO, Scribble, Among Us, Antakshiri, Dumb Charades, or Guess the PIN to earn XP from referees.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map((res) => (
              <div
                key={res.id}
                className="p-4 bg-[#FFF9E6] border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0_0_#000]"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-black text-sm uppercase text-black">{res.game}</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-black uppercase bg-black text-[#FFB703]">
                      {res.result}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 uppercase">
                    Logged by {res.recordedByAdmin} • {new Date(res.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono font-black text-[#D90429] bg-white px-3 py-1 border-2 border-black">
                    +{res.xpAwarded} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
