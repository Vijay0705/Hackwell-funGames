import React from 'react';
import { User } from '../types';
import {
  Trophy,
  Gamepad2,
  TrendingUp,
  LogOut,
  Sparkles,
  LogIn,
  LayoutDashboard
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  currentPath?: string;
  onNavigateAdmin?: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onLogout,
  currentPath,
  onNavigateAdmin
}) => {
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'ADMIN');

  const isDashboardPage =
    currentPath === '/admin/dashboard' || currentPath === '/admin' || currentPath === '/admin/';

  const handleBrandClick = () => {
    if (isAdmin) {
      if (onNavigateAdmin) onNavigateAdmin('/admin/dashboard');
      else setActiveTab('admin-dashboard');
    } else {
      if (onNavigateAdmin && currentPath?.startsWith('/admin')) onNavigateAdmin('/');
      setActiveTab('student-home');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#D90429] border-b-4 border-black text-white shadow-[0_4px_0_0_#000000]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between min-h-[4.5rem] py-2 sm:py-0 gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0"
            onClick={handleBrandClick}
          >
            <div className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 bg-[#FFB703] border-3 sm:border-4 border-black shadow-[3px_3px_0_0_#000000] rotate-[-2deg]">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl sm:text-2xl tracking-tighter text-white uppercase italic drop-shadow-[2px_2px_0_#000]">
                  GAMING ARENA
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-white/90 font-bold uppercase tracking-wider -mt-0.5 hidden xs:block sm:block">
                College Gaming Event XP Portal
              </p>
            </div>
          </div>

          {/* Navigation Links (Student / General) */}
          {!isAdmin && (
            <nav className="flex items-center gap-1.5 sm:gap-2.5 my-1 sm:my-0">
              <button
                id="nav-home-btn"
                onClick={() => setActiveTab('student-home')}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xs uppercase tracking-wider transition-all border-2 border-black cursor-pointer ${
                  activeTab === 'student-home'
                    ? 'bg-[#FFB703] text-black shadow-[3px_3px_0_0_#000000] -translate-y-0.5'
                    : 'bg-white text-black hover:bg-[#FFF9E6]'
                }`}
              >
                <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                <span>Home</span>
              </button>

              <button
                id="nav-games-btn"
                onClick={() => setActiveTab('games')}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xs uppercase tracking-wider transition-all border-2 border-black cursor-pointer ${
                  activeTab === 'games'
                    ? 'bg-[#FFB703] text-black shadow-[3px_3px_0_0_#000000] -translate-y-0.5'
                    : 'bg-white text-black hover:bg-[#FFF9E6]'
                }`}
              >
                <Gamepad2 className="w-4 h-4 text-black stroke-[2.5]" />
                <span>Games</span>
              </button>

              <button
                id="nav-leaderboard-btn"
                onClick={() => setActiveTab('leaderboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xs uppercase tracking-wider transition-all border-2 border-black cursor-pointer ${
                  activeTab === 'leaderboard'
                    ? 'bg-[#FFB703] text-black shadow-[3px_3px_0_0_#000000] -translate-y-0.5'
                    : 'bg-white text-black hover:bg-[#FFF9E6]'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-black stroke-[2.5]" />
                <span>Leaderboard</span>
              </button>
            </nav>
          )}

          {/* Navigation Links (Admin Mode) */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 sm:gap-2 my-1 sm:my-0">
              <button
                id="admin-navbar-dashboard-btn"
                onClick={() => {
                  if (onNavigateAdmin) {
                    onNavigateAdmin('/admin/dashboard');
                  } else {
                    setActiveTab('admin-dashboard');
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 font-black text-xs uppercase tracking-wider transition-all border-2 border-black cursor-pointer shadow-[3px_3px_0_0_#000000] ${
                  isDashboardPage
                    ? 'bg-[#FFB703] text-black ring-2 ring-white -translate-y-0.5 scale-105'
                    : 'bg-[#FFB703] text-black hover:bg-[#e0a100]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 stroke-[2.5]" />
                <span>Dashboard</span>
                <span className="ml-1 px-1.5 py-0.5 bg-black text-[#FFB703] text-[9px] font-mono font-bold">
                  ADMIN
                </span>
              </button>

              <button
                onClick={() => {
                  if (onNavigateAdmin) {
                    onNavigateAdmin('/');
                  } else {
                    setActiveTab('student-home');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xs uppercase tracking-wider transition-all border-2 border-black cursor-pointer ${
                  !currentPath?.startsWith('/admin')
                    ? 'bg-white text-black shadow-[2px_2px_0_0_#000]'
                    : 'bg-white/80 text-black hover:bg-white'
                }`}
              >
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Public View</span>
              </button>
            </div>
          )}

          {/* User Auth Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div
                  id="user-badge-header"
                  onClick={handleBrandClick}
                  className="flex items-center gap-2 pl-2 pr-3 py-1 bg-white text-black border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer hover:bg-[#FFF9E6] transition-all"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.gamerTag}
                    className="w-7 h-7 object-cover border-2 border-black"
                  />
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-black uppercase max-w-[110px] truncate leading-tight">
                      {currentUser.gamerTag}
                    </p>
                    <p className="text-[9px] font-mono font-bold text-[#D90429] uppercase leading-none">
                      {currentUser.role === 'admin' || currentUser.role === 'ADMIN' ? 'Official Admin' : `${currentUser.xp} XP`}
                    </p>
                  </div>
                </div>

                <button
                  id="logout-btn"
                  onClick={onLogout}
                  title="Sign Out"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D90429] hover:bg-black text-white font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_0_#000000] transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                id="open-auth-btn"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FFB703] hover:bg-[#e0a100] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0_0_#000000] transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
              >
                <LogIn className="w-4 h-4 stroke-[2.5]" />
                <span>Sign In / Sign Up</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
