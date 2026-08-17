import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { createServer as createViteServer } from 'vite';
import { User, GameResult, XpHistoryEntry, AuditLogEntry, RankTier, EventGame } from './src/types.js';
import {
  INITIAL_USERS,
  INITIAL_GAME_RESULTS,
  INITIAL_XP_HISTORY,
  INITIAL_AUDIT_LOGS,
  calculateRankTier
} from './src/server/seedData.js';

dotenv.config();
setLogLevel('error');

const PORT = process.env.PORT || 3000;
const BACKUP_DB_FILE = path.join(process.cwd(), 'data_store.json');

// Password Hashing Helpers
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash?: string): boolean {
  if (!combinedHash) return false;
  if (!combinedHash.includes(':')) {
    return password === combinedHash;
  }
  try {
    const [salt, originalHash] = combinedHash.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch (e) {
    return false;
  }
}

// Cloud Firestore Database Configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

let firestoreDb: ReturnType<typeof getFirestore> | null = null;
let isFirestoreAvailable = false;

if (firebaseConfig.projectId && firebaseConfig.projectId !== 'your_project_id_here') {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    firestoreDb = getFirestore(app);
    isFirestoreAvailable = true;
    console.log(`⚡ Connected to Cloud Firestore Primary Database (Project: ${firebaseConfig.projectId})`);
  } catch (err) {
    console.warn('Cloud Firestore initialization warning:', err);
  }
}

function handleFirestoreError(err: any) {
  const errMessage = String(err?.message || err?.code || err);
  if (isFirestoreAvailable) {
    isFirestoreAvailable = false;
    console.warn(`\n⚠️ Cloud Firestore notice: ${errMessage}. Seamlessly switching to local backup storage (data_store.json).`);
  }
}

interface DatabaseSchema {
  users: User[];
  gameResults: GameResult[];
  xpHistory: XpHistoryEntry[];
  auditLogs: AuditLogEntry[];
  sessions: Record<string, string>; // sessionToken -> userId
  adminResetTokens: Record<string, { email: string; expiresAt: number }>;
}

let db: DatabaseSchema = {
  users: [...INITIAL_USERS],
  gameResults: [...INITIAL_GAME_RESULTS],
  xpHistory: [...INITIAL_XP_HISTORY],
  auditLogs: [...INITIAL_AUDIT_LOGS],
  sessions: {},
  adminResetTokens: {}
};

// Save Local Backup to data_store.json
function saveBackupDb() {
  try {
    fs.writeFileSync(BACKUP_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save local backup file:', err);
  }
}

// Load from Local Backup file
function loadBackupDb() {
  try {
    if (fs.existsSync(BACKUP_DB_FILE)) {
      const data = fs.readFileSync(BACKUP_DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.users && parsed.gameResults) {
        db = {
          users: parsed.users || [],
          gameResults: parsed.gameResults || [],
          xpHistory: parsed.xpHistory || [],
          auditLogs: parsed.auditLogs || [],
          sessions: parsed.sessions || {},
          adminResetTokens: parsed.adminResetTokens || {}
        };
      }
    }
  } catch (err) {
    console.error('Failed to load backup DB file:', err);
  }
}

// --- PRIMARY CLOUD FIRESTORE WRITERS ---

async function syncUserToFirestore(user: User) {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    await setDoc(doc(firestoreDb, 'users', user.id), user, { merge: true });
  } catch (err) {
    handleFirestoreError(err);
  }
}

async function syncGameResultToFirestore(result: GameResult) {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    await setDoc(doc(firestoreDb, 'gameResults', result.id), result, { merge: true });
  } catch (err) {
    handleFirestoreError(err);
  }
}

async function syncXpHistoryToFirestore(entry: XpHistoryEntry) {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    await setDoc(doc(firestoreDb, 'xpHistory', entry.id), entry, { merge: true });
  } catch (err) {
    handleFirestoreError(err);
  }
}

async function syncAuditLogToFirestore(entry: AuditLogEntry) {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    await setDoc(doc(firestoreDb, 'auditLogs', entry.id), entry, { merge: true });
  } catch (err) {
    handleFirestoreError(err);
  }
}

async function syncSessionToFirestore(token: string, userId: string) {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    await setDoc(doc(firestoreDb, 'sessions', token), { token, userId, createdAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err);
  }
}

async function deleteSessionFromFirestore(token: string) {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    await deleteDoc(doc(firestoreDb, 'sessions', token));
  } catch (err) {
    handleFirestoreError(err);
  }
}

// Load and populate from Cloud Firestore into cache and write backup
async function loadDbFromFirestore() {
  if (!firestoreDb || !isFirestoreAvailable) return;
  try {
    const usersSnap = await getDocs(collection(firestoreDb, 'users'));
    if (!usersSnap.empty) {
      const remoteUsers: User[] = [];
      usersSnap.forEach((docSnap) => remoteUsers.push(docSnap.data() as User));
      
      remoteUsers.forEach((rUser) => {
        const idx = db.users.findIndex((u) => u.id === rUser.id);
        if (idx >= 0) db.users[idx] = rUser;
        else db.users.push(rUser);
      });
    } else {
      // Seed Firestore with initial records if empty
      console.log('🌱 Seeding initial records into Cloud Firestore database...');
      for (const u of db.users) {
        await setDoc(doc(firestoreDb, 'users', u.id), u, { merge: true });
      }
      for (const r of db.gameResults) {
        await setDoc(doc(firestoreDb, 'gameResults', r.id), r, { merge: true });
      }
      for (const x of db.xpHistory) {
        await setDoc(doc(firestoreDb, 'xpHistory', x.id), x, { merge: true });
      }
      for (const a of db.auditLogs) {
        await setDoc(doc(firestoreDb, 'auditLogs', a.id), a, { merge: true });
      }
    }

    const resultsSnap = await getDocs(collection(firestoreDb, 'gameResults'));
    if (!resultsSnap.empty) {
      resultsSnap.forEach((docSnap) => {
        const rData = docSnap.data() as GameResult;
        const idx = db.gameResults.findIndex((r) => r.id === rData.id);
        if (idx >= 0) db.gameResults[idx] = rData;
        else db.gameResults.push(rData);
      });
    }

    const xpSnap = await getDocs(collection(firestoreDb, 'xpHistory'));
    if (!xpSnap.empty) {
      xpSnap.forEach((docSnap) => {
        const xData = docSnap.data() as XpHistoryEntry;
        const idx = db.xpHistory.findIndex((x) => x.id === xData.id);
        if (idx >= 0) db.xpHistory[idx] = xData;
        else db.xpHistory.push(xData);
      });
    }

    const auditSnap = await getDocs(collection(firestoreDb, 'auditLogs'));
    if (!auditSnap.empty) {
      auditSnap.forEach((docSnap) => {
        const aData = docSnap.data() as AuditLogEntry;
        const idx = db.auditLogs.findIndex((a) => a.id === aData.id);
        if (idx >= 0) db.auditLogs[idx] = aData;
        else db.auditLogs.push(aData);
      });
    }

    const sessionSnap = await getDocs(collection(firestoreDb, 'sessions'));
    if (!sessionSnap.empty) {
      sessionSnap.forEach((docSnap) => {
        const sData = docSnap.data();
        if (sData.token && sData.userId) {
          db.sessions[sData.token] = sData.userId;
        }
      });
    }

    saveBackupDb();
    console.log('✅ Cloud Firestore Primary Database loaded & synchronized');
  } catch (err) {
    handleFirestoreError(err);
  }
}

async function ensureAdminExists() {
  const adminEmail = 'ivijaysa@gmail.com';
  const hashedVijayPass = hashPassword('vijay007');

  let adminUser = db.users.find((u) => u.email.toLowerCase() === adminEmail.toLowerCase());

  if (!adminUser) {
    adminUser = {
      id: 'usr_admin_vijay',
      email: adminEmail,
      fullName: 'Vijay S (Admin)',
      gamerTag: 'Admin_Vijay',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150',
      department: 'Esports Commission',
      studentId: 'ADM-2025-01',
      role: 'ADMIN',
      passwordHash: hashedVijayPass,
      xp: 0,
      rankTier: 'Iron',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      joinedAt: '2025-01-01'
    };
    db.users.push(adminUser);
  } else {
    adminUser.email = adminEmail;
    adminUser.role = 'ADMIN';
    adminUser.passwordHash = hashedVijayPass;
  }

  // 1. Store in Cloud Firestore First
  await syncUserToFirestore(adminUser);
  // 2. Store in local backup second
  saveBackupDb();
}

// Fixed XP Calculation Rule
export function calculateXpForGame(game: string, result: string, moviesWon?: number): number {
  switch (game) {
    case 'Chess':
      return result === 'WIN' ? 50 : 0;
    case 'UNO':
      return result === 'WIN' ? 25 : 0;
    case 'Drawasourous / Scribble.io':
      return result === 'WIN' ? 10 : 0;
    case 'Among Us':
      return result === 'WIN' ? 15 : 0;
    case 'Antakshiri':
      return result === 'WIN' ? 10 : 0;
    case 'Dumb Charades': {
      const count = Math.max(0, parseInt(String(moviesWon || 0), 10) || 0);
      return count * 5;
    }
    case 'Guess the PIN':
      return result === 'CORRECT WITHIN TIME' ? 10 : 0;
    default:
      return 0;
  }
}

async function startServer() {
  loadBackupDb();
  await loadDbFromFirestore();
  await ensureAdminExists();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Helper Auth middleware (Checks Firestore & Cache)
  const getAuthUser = async (req: express.Request): Promise<User | null> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    let userId = db.sessions[token];

    if (!userId && firestoreDb && isFirestoreAvailable) {
      try {
        const sessionSnap = await getDoc(doc(firestoreDb, 'sessions', token));
        if (sessionSnap.exists()) {
          userId = sessionSnap.data()?.userId;
          if (userId) db.sessions[token] = userId;
        }
      } catch (err) {
        handleFirestoreError(err);
      }
    }

    if (!userId) return null;

    let user: User | null = db.users.find((u) => u.id === userId) || null;

    if (!user && firestoreDb && isFirestoreAvailable) {
      try {
        const userSnap = await getDoc(doc(firestoreDb, 'users', userId));
        if (userSnap.exists()) {
          user = userSnap.data() as User;
          db.users.push(user);
        }
      } catch (err) {
        handleFirestoreError(err);
      }
    }

    return user;
  };

  const getAdminUser = async (req: express.Request): Promise<User | null> => {
    const user = await getAuthUser(req);
    if (!user) return null;
    if (user.role !== 'ADMIN' && user.role !== 'admin') return null;
    return user;
  };

  const logAudit = async (action: AuditLogEntry['action'], performedBy: string, details: string, req?: express.Request) => {
    const entry: AuditLogEntry = {
      id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      action,
      performedBy,
      details,
      ipAddress: req?.ip || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    
    // 1. Store in Cloud Firestore First
    await syncAuditLogToFirestore(entry);

    // 2. Store in cache & local backup
    db.auditLogs.unshift(entry);
    saveBackupDb();
  };

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      database: 'Cloud Firestore',
      backup: 'data_store.json',
      serverTime: new Date().toISOString(),
      firestoreConnected: isFirestoreAvailable
    });
  });

  // PARTICIPANT AUTH: Sign Up / Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, username, department, teamName, password, confirmPassword } = req.body;

      if (!name || !username || !department || !teamName || !password || !confirmPassword) {
        return res.status(400).json({
          error: 'All fields (Name, Username, Department, Team Name, Password, and Confirm Password) are required.'
        });
      }

      const trimmedName = name.trim();
      const trimmedUsername = username.trim();
      const trimmedDept = department.trim().toUpperCase();
      const trimmedTeam = teamName.trim();

      const ALLOWED_DEPARTMENTS = ['CSE', 'AIDS', 'AIML', 'IT', 'CSBS'];
      if (!ALLOWED_DEPARTMENTS.includes(trimmedDept)) {
        return res.status(400).json({
          error: 'Invalid department. Allowed departments are CSE, AIDS, AIML, IT, CSBS.'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          error: 'Passwords do not match. Please verify your Password and Confirm Password.'
        });
      }

      // Check existing username uniqueness
      const existingUsernameUser = db.users.find(
        (u) => u.gamerTag.toLowerCase() === trimmedUsername.toLowerCase()
      );

      if (existingUsernameUser) {
        return res.status(400).json({
          error: 'Username is already taken! Try another one. 👀'
        });
      }

      // Check existing account detection (same full name & team name)
      const existingAccount = db.users.find(
        (u) =>
          u.fullName.toLowerCase() === trimmedName.toLowerCase() &&
          (u.teamName?.toLowerCase() === trimmedTeam.toLowerCase() ||
            u.studentId.toLowerCase() === trimmedTeam.toLowerCase())
      );

      if (existingAccount) {
        return res.status(400).json({
          error: 'Oops! You already exist! Try Logging In! 😎'
        });
      }

      // Hash password securely
      const passwordHash = hashPassword(password);
      const userId = 'usr_st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const email = `${trimmedUsername.toLowerCase()}@gamingarena.edu`;
      const token = 'token_st_' + Date.now() + '_' + userId;

      const newUser: User = {
        id: userId,
        email,
        passwordHash,
        fullName: trimmedName,
        gamerTag: trimmedUsername,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`,
        department: trimmedDept,
        teamName: trimmedTeam,
        studentId: trimmedTeam,
        role: 'student',
        xp: 0,
        rankTier: 'Iron',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        joinedAt: new Date().toISOString().split('T')[0]
      };

      // 1. Store in Cloud Firestore First
      await syncUserToFirestore(newUser);
      await syncSessionToFirestore(token, newUser.id);

      // 2. Store in cache & backup to data_store.json second
      db.users.push(newUser);
      db.sessions[token] = newUser.id;
      saveBackupDb();

      const { passwordHash: _, ...safeUser } = newUser;
      res.status(201).json({
        success: true,
        message: 'Account registered successfully in Cloud Firestore!',
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  // PARTICIPANT AUTH: Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const queryStr = username.trim();

      const user: User | null =
        db.users.find(
          (u) =>
            u.gamerTag.toLowerCase() === queryStr.toLowerCase() ||
            u.email.toLowerCase() === queryStr.toLowerCase()
        ) || null;

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const token = 'token_st_' + Date.now() + '_' + user.id;

      // 1. Store session in Cloud Firestore First
      await syncSessionToFirestore(token, user.id);

      // 2. Store in cache & backup to data_store.json second
      db.sessions[token] = user.id;
      saveBackupDb();

      const { passwordHash: _, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  // STUDENT AUTH: Google / Student Login
  app.post('/api/auth/student-google', async (req, res) => {
    const { email, fullName, avatar, googleId, department, studentId, gamerTag } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Google account email is required' });
    }

    let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      const username = gamerTag || email.split('@')[0] || 'Player';
      user = {
        id: 'usr_st_' + Date.now(),
        googleId: googleId || 'g_' + Date.now(),
        email,
        fullName: fullName || username,
        gamerTag: username,
        avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        department: department || 'Computer Science',
        studentId: studentId || 'ST-' + Math.floor(1000 + Math.random() * 9000),
        role: 'student',
        xp: 0,
        rankTier: 'Iron',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        joinedAt: new Date().toISOString().split('T')[0]
      };
      db.users.push(user);
    } else {
      if (fullName) user.fullName = fullName;
      if (avatar) user.avatar = avatar;
      if (googleId) user.googleId = googleId;
    }

    const token = 'token_st_' + Date.now() + '_' + user.id;

    // 1. Store in Cloud Firestore First
    await syncUserToFirestore(user);
    await syncSessionToFirestore(token, user.id);

    // 2. Store in cache & backup second
    db.sessions[token] = user.id;
    saveBackupDb();

    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  // ADMIN AUTH: Login
  app.post(['/api/auth/admin-login', '/api/admin/admin-login'], async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const adminUser =
        db.users.find(
          (u) =>
            (u.role === 'ADMIN' || u.role === 'admin') &&
            u.email.toLowerCase() === email.toLowerCase()
        ) || null;

      if (!adminUser) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const isValid = verifyPassword(password, adminUser.passwordHash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const token = 'token_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2);

      // 1. Store in Cloud Firestore First
      await syncSessionToFirestore(token, adminUser.id);
      await logAudit('ADMIN_LOGIN', adminUser.email, 'Admin signed in successfully', req);

      // 2. Store in cache & backup second
      db.sessions[token] = adminUser.id;
      saveBackupDb();

      const { passwordHash, ...safeUser } = adminUser;
      res.json({ token, user: { ...safeUser, role: 'ADMIN' } });
    } catch (err) {
      console.error('Unexpected admin login error:', err);
      res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  });

  // ADMIN FORGOT PASSWORD
  app.post('/api/admin/forgot-password', async (req, res) => {
    const { email } = req.body;
    const admin = db.users.find((u) => (u.role === 'ADMIN' || u.role === 'admin') && u.email.toLowerCase() === (email || '').toLowerCase());

    if (!admin) {
      return res.status(404).json({ error: 'No admin account found with that email address' });
    }

    const resetToken = 'reset_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    db.adminResetTokens[resetToken] = {
      email: admin.email,
      expiresAt: Date.now() + 3600000
    };

    await logAudit('PASSWORD_RESET', admin.email, `Password reset token requested for ${admin.email}`, req);
    saveBackupDb();

    res.json({ success: true, message: 'Password reset code generated.', resetToken });
  });

  // ADMIN RESET PASSWORD
  app.post('/api/admin/reset-password', async (req, res) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    const tokenData = db.adminResetTokens[resetToken];
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const admin = db.users.find((u) => u.email.toLowerCase() === tokenData.email.toLowerCase());
    if (admin) {
      admin.passwordHash = hashPassword(newPassword);
      // 1. Store in Cloud Firestore First
      await syncUserToFirestore(admin);
    }

    delete db.adminResetTokens[resetToken];
    await logAudit('PASSWORD_RESET', tokenData.email, `Password updated for admin ${tokenData.email}`, req);
    
    // 2. Store in local backup second
    saveBackupDb();

    res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
  });

  // GET AUTH ME
  app.get('/api/auth/me', async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthenticated' });
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // LOGOUT
  app.post('/api/auth/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      
      // 1. Delete from Cloud Firestore First
      await deleteSessionFromFirestore(token);

      // 2. Delete from cache & local backup second
      delete db.sessions[token];
      saveBackupDb();
    }
    res.json({ success: true });
  });

  // LEADERBOARD
  app.get('/api/leaderboard', (req, res) => {
    const { search } = req.query;

    let students = db.users.filter((u) => u.role === 'student');

    if (search) {
      const query = (search as string).toLowerCase();
      students = students.filter(
        (u) =>
          u.gamerTag.toLowerCase().includes(query) ||
          u.fullName.toLowerCase().includes(query) ||
          u.department.toLowerCase().includes(query) ||
          u.studentId.toLowerCase().includes(query)
      );
    }

    students.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.gamerTag.localeCompare(b.gamerTag);
    });

    const leaderboard = students.map((user, index) => {
      const { passwordHash, ...safe } = user;
      return {
        ...safe,
        rank: index + 1
      };
    });

    res.json({
      leaderboard,
      totalStudents: leaderboard.length,
      lastUpdated: new Date().toISOString()
    });
  });

  // GET ALL PLAYERS
  app.get('/api/users', (req, res) => {
    const students = db.users.filter((u) => u.role === 'student').map((u) => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
    res.json({ users: students });
  });

  // GET PLAYER PROFILE + GAME HISTORY
  app.get('/api/users/:id', (req, res) => {
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Player profile not found' });

    const { passwordHash, ...safeUser } = user;
    const userResults = db.gameResults.filter((r) => r.userId === user.id && !r.isVoided);
    const userXpHistory = db.xpHistory.filter((x) => x.userId === user.id);

    res.json({ user: safeUser, gameResults: userResults, xpHistory: userXpHistory });
  });

  // UPDATE EVENT POINTS (ADMIN ONLY)
  app.post('/api/admin/update-points', async (req, res) => {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({ error: '403 / Access Denied: Admin authorization required' });
    }

    const { userId, game, result, moviesWon } = req.body;

    if (!userId || !game || !result) {
      return res.status(400).json({ error: 'Missing required parameters: userId, game, result' });
    }

    const student = db.users.find((u) => u.id === userId && u.role === 'student');
    if (!student) {
      return res.status(404).json({ error: 'Selected student participant not found' });
    }

    const xpAwarded = calculateXpForGame(game, result, moviesWon);

    const isWin = result === 'WIN' || result === 'CORRECT WITHIN TIME' || (game === 'Dumb Charades' && (moviesWon || 0) > 0);

    student.xp = Math.max(0, student.xp + xpAwarded);
    student.rankTier = calculateRankTier(student.xp);
    student.gamesPlayed += 1;
    if (isWin) {
      student.wins += 1;
    } else {
      student.losses += 1;
    }

    const newResult: GameResult = {
      id: 'res_' + Date.now(),
      userId: student.id,
      userGamerTag: student.gamerTag,
      userFullName: student.fullName,
      game: game as EventGame,
      result: result,
      moviesWon: game === 'Dumb Charades' ? Math.max(0, parseInt(String(moviesWon || 0), 10) || 0) : undefined,
      xpAwarded,
      isVoided: false,
      recordedByAdmin: admin.email,
      createdAt: new Date().toISOString()
    };

    const newXpEntry: XpHistoryEntry = {
      id: 'xp_' + Date.now(),
      userId: student.id,
      userGamerTag: student.gamerTag,
      game,
      result: game === 'Dumb Charades' ? `WIN (${newResult.moviesWon} Movies)` : result,
      amount: xpAwarded,
      performedBy: admin.email,
      createdAt: new Date().toISOString()
    };

    // 1. Store in Cloud Firestore First
    await syncUserToFirestore(student);
    await syncGameResultToFirestore(newResult);
    await syncXpHistoryToFirestore(newXpEntry);
    await logAudit(
      'XP_UPDATE',
      admin.email,
      `Awarded +${xpAwarded} XP to ${student.fullName} (${student.gamerTag}) for ${game} [${result}]`,
      req
    );

    // 2. Store in cache & backup to data_store.json second
    db.gameResults.unshift(newResult);
    db.xpHistory.unshift(newXpEntry);
    saveBackupDb();

    const { passwordHash, ...safeStudent } = student;

    res.json({
      success: true,
      user: safeStudent,
      gameResult: newResult,
      xpEntry: newXpEntry
    });
  });

  // GAME RESULTS (Official List)
  app.get('/api/admin/game-results', (req, res) => {
    res.json({ gameResults: db.gameResults });
  });

  // VOID / CORRECT A GAME RESULT (ADMIN ONLY)
  app.post('/api/admin/void-result', async (req, res) => {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({ error: '403 / Access Denied: Admin authorization required' });
    }

    const { resultId, voidReason } = req.body;

    if (!resultId || !voidReason) {
      return res.status(400).json({ error: 'resultId and voidReason are required' });
    }

    const result = db.gameResults.find((r) => r.id === resultId);
    if (!result) {
      return res.status(404).json({ error: 'Game result record not found' });
    }

    if (result.isVoided) {
      return res.status(400).json({ error: 'This game result has already been voided' });
    }

    const student = db.users.find((u) => u.id === result.userId);
    if (student) {
      student.xp = Math.max(0, student.xp - result.xpAwarded);
      student.rankTier = calculateRankTier(student.xp);
      student.gamesPlayed = Math.max(0, student.gamesPlayed - 1);

      const isWin = result.result === 'WIN' || result.result === 'CORRECT WITHIN TIME' || (result.game === 'Dumb Charades' && (result.moviesWon || 0) > 0);
      if (isWin) {
        student.wins = Math.max(0, student.wins - 1);
      } else {
        student.losses = Math.max(0, student.losses - 1);
      }
    }

    result.isVoided = true;
    result.voidReason = voidReason;

    const voidXpEntry: XpHistoryEntry = {
      id: 'xp_void_' + Date.now(),
      userId: result.userId,
      userGamerTag: result.userGamerTag,
      game: result.game,
      result: `VOIDED: ${voidReason}`,
      amount: -result.xpAwarded,
      performedBy: admin.email,
      createdAt: new Date().toISOString()
    };

    // 1. Store in Cloud Firestore First
    await syncGameResultToFirestore(result);
    if (student) await syncUserToFirestore(student);
    await syncXpHistoryToFirestore(voidXpEntry);
    await logAudit('RESULT_VOID', admin.email, `Voided game result ${resultId} for ${result.userGamerTag}. Reason: ${voidReason}`, req);

    // 2. Store in cache & backup to data_store.json second
    db.xpHistory.unshift(voidXpEntry);
    saveBackupDb();

    let safeStudent = undefined;
    if (student) {
      const { passwordHash, ...s } = student;
      safeStudent = s;
    }

    res.json({ success: true, result, user: safeStudent });
  });

  // XP HISTORY (Full Log)
  app.get('/api/xp/history', (req, res) => {
    res.json({ xpHistory: db.xpHistory });
  });

  // AUDIT LOGS (Admin)
  app.get('/api/admin/audit-logs', async (req, res) => {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({ error: '403 / Access Denied: Admin authorization required' });
    }
    res.json({ auditLogs: db.auditLogs });
  });

  // ANALYTICS (Admin)
  app.get('/api/admin/analytics', async (req, res) => {
    const students = db.users.filter((u) => u.role === 'student');
    const validResults = db.gameResults.filter((r) => !r.isVoided);

    const totalParticipants = students.length;
    const totalGamesPlayed = validResults.length;
    const totalXpAwarded = validResults.reduce((acc, r) => acc + r.xpAwarded, 0);

    const gameCounts: Record<string, number> = {};
    validResults.forEach((r) => {
      gameCounts[r.game] = (gameCounts[r.game] || 0) + 1;
    });

    let mostPlayedGame = 'None';
    let maxCount = 0;
    Object.entries(gameCounts).forEach(([game, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostPlayedGame = game;
      }
    });

    const sortedStudents = [...students].sort((a, b) => b.xp - a.xp);
    const currentLeader = sortedStudents.length > 0 ? sortedStudents[0].fullName + ' (' + sortedStudents[0].gamerTag + ')' : 'None';

    const totalWins = students.reduce((acc, s) => acc + s.wins, 0);
    const averageXp = totalParticipants > 0 ? Math.round(totalXpAwarded / totalParticipants) : 0;

    res.json({
      analytics: {
        totalParticipants,
        totalGamesPlayed,
        totalXpAwarded,
        mostPlayedGame,
        currentLeader,
        totalWins,
        averageXp
      }
    });
  });

  // VITE DEVELOPMENT OR PRODUCTION SERVING
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🎮 Gaming Arena College Leaderboard Server running on http://localhost:${PORT}`);
  });
}

startServer();
