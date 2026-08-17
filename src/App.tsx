import React, { useState, useEffect } from 'react';
import { User, LeaderboardUser, GameResult } from './types';
import { Navbar } from './components/Navbar';
import { StudentHome } from './components/StudentHome';
import { GamesView } from './components/GamesView';
import { LeaderboardView } from './components/LeaderboardView';
import { AuthModal } from './components/AuthModal';
import { SignOutConfirmModal } from './components/SignOutConfirmModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Trophy, Zap, CheckCircle2, AlertCircle, X, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // URL Path Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  // Active View Tab for non-admin views
  const [activeTab, setActiveTab] = useState<
    'student-home' | 'games' | 'leaderboard' | 'student-score' | 'student-history'
  >('student-home');

  // Modals State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [inspectedUser, setInspectedUser] = useState<LeaderboardUser | null>(null);
  const [inspectedUserHistory, setInspectedUserHistory] = useState<GameResult[]>([]);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper for path navigation
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch initial app data and restore existing session
  const fetchData = async () => {
    try {
      setLoading(true);

      const [usersRes, meRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('hero_rank_token') || ''}`
          }
        })
      ]);

      const usersData = await usersRes.json();
      if (usersData.users) {
        setStudents(usersData.users);
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setCurrentUser(meData.user);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sign Out Handler - Opens confirmation popup
  const handleLogout = () => {
    setIsSignOutModalOpen(true);
  };

  // Confirmed Sign Out
  const handleConfirmLogout = async () => {
    const token = localStorage.getItem('hero_rank_token');
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'ADMIN');

    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // Silently handle request errors
      }
    }

    localStorage.removeItem('hero_rank_token');
    setCurrentUser(null);
    setIsSignOutModalOpen(false);

    if (isAdmin) {
      navigate('/');
    }

    showToast('Signed out successfully.');
    setActiveTab('student-home');
  };

  // Inspect Player Profile
  const handleSelectUserForModal = async (user: LeaderboardUser) => {
    setInspectedUser(user);
    try {
      const res = await fetch(`/api/users/${user.id}`);
      const data = await res.json();
      if (data.gameResults) {
        setInspectedUserHistory(data.gameResults);
      }
    } catch (e) {
      console.error('Error fetching player history:', e);
    }
  };

  const isAdminRoute = currentPath.startsWith('/admin');
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'ADMIN');

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 font-sans selection:bg-[#FFB703] selection:text-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 border-4 border-black font-black text-sm uppercase tracking-wide shadow-[6px_6px_0_0_#000000] ${
              toastMessage.type === 'error' ? 'bg-[#D90429] text-white' : 'bg-[#FFB703] text-black'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab as any);
          if (currentPath.startsWith('/admin')) {
            navigate('/');
          }
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        currentPath={currentPath}
        onNavigateAdmin={navigate}
      />

      {/* Main View Router */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isAdminRoute ? (
          isAdmin ? (
            <AdminDashboard currentPath={currentPath} onNavigateAdmin={navigate} />
          ) : (
            <div className="py-16 text-center space-y-6 max-w-md mx-auto">
              <div className="bg-[#FFF9E6] border-4 border-black p-8 shadow-[8px_8px_0_0_#000000] space-y-5">
                <div className="w-16 h-16 bg-[#D90429] border-4 border-black shadow-[4px_4px_0_0_#000000] mx-auto flex items-center justify-center text-white">
                  <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h2 className="text-2xl font-black uppercase italic text-black">ADMIN ACCESS RESTRICTED</h2>
                <p className="text-xs font-bold text-slate-700 uppercase leading-relaxed">
                  You must be authenticated as an Official Admin to access the Gaming Arena Control Center.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full py-3 bg-[#FFB703] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0_0_#000000] hover:bg-[#e0a100] cursor-pointer"
                  >
                    SIGN IN TO PORTAL
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-2 bg-white text-black font-black text-xs uppercase border-2 border-black hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                    <span>Return to Public Home</span>
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <>
            {activeTab === 'student-home' && (
              <StudentHome
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            )}

            {activeTab === 'games' && <GamesView />}

            {activeTab === 'leaderboard' && (
              <LeaderboardView onSelectUser={handleSelectUserForModal} />
            )}

            {activeTab === 'student-score' && (
              <StudentHome
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            )}

            {activeTab === 'student-history' && (
              <StudentHome
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            )}
          </>
        )}
      </main>

      {/* Unified Auth Modal (Handles Sign In, Sign Up, Admin Auth & Auto-Redirect) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user, token, isAdminUser) => {
          localStorage.setItem('hero_rank_token', token);
          setCurrentUser(user);
          setIsAuthModalOpen(false);

          if (isAdminUser || user.role === 'ADMIN' || user.role === 'admin') {
            showToast(`Welcome to Admin Control Center, ${user.fullName}! 👑`);
            navigate('/admin/dashboard');
          } else {
            showToast(`Welcome back, ${user.fullName}! 🎉`);
            setActiveTab('student-home');
            navigate('/');
          }
          fetchData();
        }}
      />

      {/* Sign Out Confirmation Modal */}
      <SignOutConfirmModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        userRole={currentUser?.role}
      />

      {/* Inspect Player Profile & Game History Modal */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 sm:p-8 max-w-xl w-full shadow-[8px_8px_0_0_#000] relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectedUser(null)}
              className="absolute top-4 right-4 p-1.5 bg-[#D90429] text-white border-2 border-black hover:bg-[#b00320] cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[3]" />
            </button>

            <div className="flex items-center gap-4 border-b-4 border-black pb-4">
              <img
                src={inspectedUser.avatar}
                alt={inspectedUser.gamerTag}
                className="w-16 h-16 object-cover border-4 border-black shadow-[2px_2px_0_0_#000]"
              />
              <div>
                <span className="px-2 py-0.5 bg-[#FFB703] text-black font-mono text-[10px] font-black uppercase border border-black">
                  RANK #{inspectedUser.rank} • {inspectedUser.department}
                </span>
                <h3 className="text-2xl font-black uppercase italic text-black">{inspectedUser.fullName}</h3>
                <p className="text-xs font-black uppercase text-[#D90429]">GamerTag: @{inspectedUser.gamerTag}</p>
                <p className="text-xs font-mono text-slate-600">ID: {inspectedUser.studentId}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center font-mono font-black uppercase text-xs">
              <div className="p-3 bg-[#FFF9E6] border-2 border-black">
                <span className="text-[10px] text-slate-500 block">TOTAL XP</span>
                <span className="text-xl text-[#D90429]">{inspectedUser.xp.toLocaleString()} XP</span>
              </div>
              <div className="p-3 bg-[#FFF9E6] border-2 border-black">
                <span className="text-[10px] text-slate-500 block">RANK TIER</span>
                <span className="text-xl text-black">{inspectedUser.rankTier}</span>
              </div>
              <div className="p-3 bg-[#FFF9E6] border-2 border-black">
                <span className="text-[10px] text-slate-500 block">WINS / LOSSES</span>
                <span className="text-xl text-black">{inspectedUser.wins}W / {inspectedUser.losses}L</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-sm uppercase italic border-b-2 border-black pb-1">
                Official Game History (Logged by Admin)
              </h4>
              {inspectedUserHistory.length === 0 ? (
                <p className="text-xs font-bold text-slate-500 py-3 uppercase">
                  No official game results logged yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {inspectedUserHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-[#FFF9E6] border-2 border-black flex items-center justify-between text-xs font-black uppercase"
                    >
                      <div>
                        <span>{item.game}</span>
                        <span className="ml-2 font-mono text-[10px] text-slate-600">[{item.result}]</span>
                      </div>
                      <span className="font-mono text-[#D90429]">+{item.xpAwarded} XP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
