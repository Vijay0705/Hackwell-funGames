import { User, GameResult, XpHistoryEntry, AuditLogEntry, RankTier } from '../types.js';

export function calculateRankTier(xp: number): RankTier {
  if (xp >= 5000) return 'Radiance';
  if (xp >= 3500) return 'Grandmaster';
  if (xp >= 2500) return 'Master';
  if (xp >= 1800) return 'Diamond';
  if (xp >= 1200) return 'Platinum';
  if (xp >= 800) return 'Gold';
  if (xp >= 400) return 'Silver';
  if (xp >= 150) return 'Bronze';
  return 'Iron';
}

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_vijay',
    email: 'ivijaysa@gmail.com',
    fullName: 'Vijay S (Admin)',
    gamerTag: 'Admin_Vijay',
    avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
    department: 'Esports Commission',
    studentId: 'ADM-2025-01',
    role: 'ADMIN',
    xp: 0,
    rankTier: 'Iron',
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    joinedAt: '2025-01-01'
  },
  {
    id: 'usr_arjun',
    email: 'arjun.sharma@student.gamingarena.edu',
    fullName: 'Arjun Sharma',
    gamerTag: 'GrandmasterArjun',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    department: 'Computer Science',
    studentId: 'CS2023-019',
    role: 'student',
    xp: 320,
    rankTier: 'Silver',
    gamesPlayed: 7,
    wins: 5,
    losses: 2,
    joinedAt: '2025-01-10'
  },
  {
    id: 'usr_priya',
    email: 'priya.patel@student.gamingarena.edu',
    fullName: 'Priya Patel',
    gamerTag: 'CardQueenPriya',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    department: 'Electrical Engineering',
    studentId: 'EE2024-042',
    role: 'student',
    xp: 260,
    rankTier: 'Silver',
    gamesPlayed: 8,
    wins: 6,
    losses: 2,
    joinedAt: '2025-01-12'
  },
  {
    id: 'usr_rohan',
    email: 'rohan.gupta@student.gamingarena.edu',
    fullName: 'Rohan Gupta',
    gamerTag: 'RohanDoodleMaster',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    department: 'Mechanical Engineering',
    studentId: 'ME2023-088',
    role: 'student',
    xp: 195,
    rankTier: 'Bronze',
    gamesPlayed: 6,
    wins: 4,
    losses: 2,
    joinedAt: '2025-01-15'
  },
  {
    id: 'usr_sanya',
    email: 'sanya.singh@student.gamingarena.edu',
    fullName: 'Sanya Singh',
    gamerTag: 'SanyaMelody',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    department: 'Business Administration',
    studentId: 'BA2024-012',
    role: 'student',
    xp: 140,
    rankTier: 'Bronze',
    gamesPlayed: 5,
    wins: 3,
    losses: 2,
    joinedAt: '2025-01-20'
  },
  {
    id: 'usr_kabir',
    email: 'kabir.verma@student.gamingarena.edu',
    fullName: 'Kabir Verma',
    gamerTag: 'PinCrackerKabir',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    department: 'Information Technology',
    studentId: 'IT2023-055',
    role: 'student',
    xp: 95,
    rankTier: 'Iron',
    gamesPlayed: 4,
    wins: 2,
    losses: 2,
    joinedAt: '2025-01-25'
  }
];

export const INITIAL_GAME_RESULTS: GameResult[] = [
  {
    id: 'res_1',
    userId: 'usr_arjun',
    userGamerTag: 'GrandmasterArjun',
    userFullName: 'Arjun Sharma',
    game: 'Chess',
    result: 'WIN',
    xpAwarded: 50,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'res_2',
    userId: 'usr_arjun',
    userGamerTag: 'GrandmasterArjun',
    userFullName: 'Arjun Sharma',
    game: 'Dumb Charades',
    result: 'WIN',
    moviesWon: 4,
    xpAwarded: 20,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'res_3',
    userId: 'usr_priya',
    userGamerTag: 'CardQueenPriya',
    userFullName: 'Priya Patel',
    game: 'UNO',
    result: 'WIN',
    xpAwarded: 25,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'res_4',
    userId: 'usr_priya',
    userGamerTag: 'CardQueenPriya',
    userFullName: 'Priya Patel',
    game: 'Among Us',
    result: 'WIN',
    xpAwarded: 15,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'res_5',
    userId: 'usr_rohan',
    userGamerTag: 'RohanDoodleMaster',
    userFullName: 'Rohan Gupta',
    game: 'Drawasourous / Scribble.io',
    result: 'WIN',
    xpAwarded: 10,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'res_6',
    userId: 'usr_sanya',
    userGamerTag: 'SanyaMelody',
    userFullName: 'Sanya Singh',
    game: 'Antakshiri',
    result: 'WIN',
    xpAwarded: 10,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'res_7',
    userId: 'usr_kabir',
    userGamerTag: 'PinCrackerKabir',
    userFullName: 'Kabir Verma',
    game: 'Guess the PIN',
    result: 'CORRECT WITHIN TIME',
    xpAwarded: 10,
    isVoided: false,
    recordedByAdmin: 'admin@gamingarena.edu',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

export const INITIAL_XP_HISTORY: XpHistoryEntry[] = INITIAL_GAME_RESULTS.map((r) => ({
  id: 'xp_' + r.id,
  userId: r.userId,
  userGamerTag: r.userGamerTag,
  game: r.game,
  result: r.result === 'WIN' && r.moviesWon ? `WIN (${r.moviesWon} Movies)` : r.result,
  amount: r.xpAwarded,
  performedBy: r.recordedByAdmin,
  createdAt: r.createdAt
}));

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit_1',
    action: 'ADMIN_LOGIN',
    performedBy: 'admin@gamingarena.edu',
    details: 'Admin authenticated into College Gaming Arena system',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 'audit_2',
    action: 'XP_UPDATE',
    performedBy: 'admin@gamingarena.edu',
    details: 'Logged official result for Arjun Sharma in Chess (WIN, +50 XP)',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'audit_3',
    action: 'XP_UPDATE',
    performedBy: 'admin@gamingarena.edu',
    details: 'Logged official result for Priya Patel in UNO (WIN, +25 XP)',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];
