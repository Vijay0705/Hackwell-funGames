import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { createServer as createViteServer } from 'vite';
import { User, GameResult, XpHistoryEntry, AuditLogEntry, RankTier, EventGame } from './src/types.js';
import { calculateRankTier } from './src/server/seedData.js';

dotenv.config({ path: ['.env', 'env'] });
setLogLevel('error');

const PORT = process.env.PORT || 3000;

// Password Hashing Helpers using Scrypt
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
    case 'Free Fire / BGMI':
      return result === 'WIN' ? 60 : 0;
    default:
      return 0;
  }
}

// Cloud Firestore Database Initialization
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const firestoreDb = initializeFirestore(appInstance, {
  ignoreUndefinedProperties: true
});

// --- FIRESTORE HELPER UTILITIES ---

async function withFirestoreRetry<T>(op: () => Promise<T>, retries = 3, delayMs = 200): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await op();
    } catch (err: any) {
      lastErr = err;
      const isOffline =
        err?.code === 'unavailable' ||
        (err?.message && String(err.message).toLowerCase().includes('client is offline'));
      if (isOffline && i < retries - 1) {
        await new Promise((res) => setTimeout(res, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function stripPasswordHash(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    rankTier: calculateRankTier(safeUser.xp || 0)
  };
}

async function getUserById(userId: string): Promise<User | null> {
  if (!userId || typeof userId !== 'string' || userId === 'null' || userId === 'undefined') return null;
  try {
    const snap = await withFirestoreRetry(() => getDoc(doc(firestoreDb, 'users', userId)));
    if (snap.exists()) {
      const data = snap.data() as User;
      return { ...data, id: data.id || snap.id };
    }
    // Fallback: search by id field if document key in Firestore is different
    const q = query(collection(firestoreDb, 'users'), where('id', '==', userId));
    const snapQ = await withFirestoreRetry(() => getDocs(q));
    if (!snapQ.empty) {
      const data = snapQ.docs[0].data() as User;
      return { ...data, id: data.id || snapQ.docs[0].id };
    }
  } catch (err: any) {
    if (err?.code === 'unavailable' || String(err?.message).includes('client is offline')) {
      console.warn(`[Firestore Offline] Transient network issue reading user profile document ${userId}`);
    } else {
      console.error(`Error fetching user ${userId} from Firestore:`, err);
    }
  }
  return null;
}

async function getUserByGamerTag(gamerTag: string): Promise<User | null> {
  if (!gamerTag || !gamerTag.trim()) return null;
  try {
    const q = query(collection(firestoreDb, 'users'), where('gamerTag', '==', gamerTag.trim()));
    const snap = await withFirestoreRetry(() => getDocs(q));
    if (!snap.empty) {
      return snap.docs[0].data() as User;
    }
    // Case-insensitive fallback lookup
    const allSnap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'users')));
    for (const d of allSnap.docs) {
      const u = d.data() as User;
      if (u.gamerTag && u.gamerTag.toLowerCase() === gamerTag.trim().toLowerCase()) {
        return u;
      }
    }
  } catch (err) {
    console.error(`Error finding user by gamerTag ${gamerTag}:`, err);
  }
  return null;
}

async function getUserByEmail(email: string): Promise<User | null> {
  if (!email || !email.trim()) return null;
  try {
    const q = query(collection(firestoreDb, 'users'), where('email', '==', email.trim()));
    const snap = await withFirestoreRetry(() => getDocs(q));
    if (!snap.empty) {
      return snap.docs[0].data() as User;
    }
    // Case-insensitive fallback
    const allSnap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'users')));
    for (const d of allSnap.docs) {
      const u = d.data() as User;
      if (u.email && u.email.toLowerCase() === email.trim().toLowerCase()) {
        return u;
      }
    }
  } catch (err) {
    console.error(`Error finding user by email ${email}:`, err);
  }
  return null;
}

async function getAllStudentsFromFirestore(): Promise<User[]> {
  try {
    const snap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'users')));
    const students: User[] = [];
    snap.forEach((docSnap) => {
      const u = docSnap.data() as User;
      const roleStr = String(u.role || '').toLowerCase();
      if (roleStr === 'student' || roleStr === 'participant' || (!roleStr && u.id !== 'usr_admin_vijay')) {
        students.push({
          ...u,
          id: u.id || docSnap.id,
          rankTier: calculateRankTier(u.xp || 0)
        });
      }
    });
    return students;
  } catch (err) {
    console.error('Error fetching all students from Firestore:', err);
    return [];
  }
}

async function logAudit(
  action: AuditLogEntry['action'],
  performedBy: string,
  details: string,
  req?: express.Request
) {
  try {
    const entry: AuditLogEntry = {
      id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      action,
      performedBy,
      details,
      ipAddress: req?.ip || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'auditLogs', entry.id), entry));
  } catch (err) {
    console.error('Failed to write audit log to Firestore:', err);
  }
}

// Authentication Helpers
const inFlightSessions = new Map<string, Promise<User | null>>();

async function getAuthUser(req: express.Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'null' || token === 'undefined') return null;

  if (inFlightSessions.has(token)) {
    return inFlightSessions.get(token)!;
  }

  const sessionPromise = (async () => {
    try {
      const sessionSnap = await withFirestoreRetry(() => getDoc(doc(firestoreDb, 'sessions', token)));
      if (!sessionSnap.exists()) return null;

      const sessionData = sessionSnap.data();
      const userId = sessionData?.userId;
      if (!userId || typeof userId !== 'string' || userId === 'null' || userId === 'undefined') return null;

      return await getUserById(userId);
    } catch (err: any) {
      if (err?.code === 'unavailable' || String(err?.message).includes('client is offline')) {
        console.warn(`[Firestore Offline] Transient network issue resolving session token: ${token.substring(0, 12)}...`);
      } else if (err?.code === 'permission-denied') {
        console.warn('⚠️ Firestore permission denied while resolving auth session.');
      } else {
        console.error('Error resolving auth user session from Firestore:', err);
      }
      return null;
    } finally {
      inFlightSessions.delete(token);
    }
  })();

  inFlightSessions.set(token, sessionPromise);
  return sessionPromise;
}

async function getAdminUser(req: express.Request): Promise<User | null> {
  const user = await getAuthUser(req);
  if (!user) return null;
  if (user.role !== 'ADMIN' && user.role !== 'admin') return null;
  return user;
}

// Seed default official admin account, tournament match results, and schema defaults directly into Firestore
async function ensureSchemaAndInitialData() {
  const adminEmail = 'ivijaysa@gmail.com';
  const hashedVijayPass = hashPassword('vijay007');

  try {
    const adminDocRef = doc(firestoreDb, 'users', 'usr_admin_vijay');
    const adminSnap = await withFirestoreRetry(() => getDoc(adminDocRef));

    if (!adminSnap.exists()) {
      const adminUser: User = {
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
        rankTier: 'Spark',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        joinedAt: '2025-01-01'
      };
      await withFirestoreRetry(() => setDoc(adminDocRef, adminUser));
      console.log('✅ Admin account (ivijaysa@gmail.com) verified and initialized in Cloud Firestore');
    }

    // Initialize auditLogs sample log if empty
    const auditSnap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'auditLogs')));
    if (auditSnap.empty) {
      const initialLog: AuditLogEntry = {
        id: 'audit_init_1001',
        action: 'ADMIN_LOGIN',
        performedBy: adminEmail,
        details: 'Cloud Firestore database schema verified according to db_schema.json specification.',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString()
      };
      await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'auditLogs', initialLog.id), initialLog));
    }

    // Seed gameResults and xpHistory if gameResults collection is empty
    const gameResultsSnap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'gameResults')));
    if (gameResultsSnap.empty) {
      console.log('🔄 Seeding initial gameResults and xpHistory into Cloud Firestore...');
      const sampleResults: GameResult[] = [
        {
          id: 'res_seed_101',
          userId: 'usr_st_1786962058384_uunvj',
          userGamerTag: 'nidthish',
          userFullName: 'nidthish',
          game: 'Chess',
          result: 'WIN',
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'res_seed_102',
          userId: 'usr_st_1786962058384_uunvj',
          userGamerTag: 'nidthish',
          userFullName: 'nidthish',
          game: 'Free Fire / BGMI',
          result: 'WIN',
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 43200000).toISOString()
        },
        {
          id: 'res_seed_103',
          userId: 'usr_st_1787058329051_g0rwb',
          userGamerTag: 'barath789',
          userFullName: 'Barath',
          game: 'Chess',
          result: 'WIN',
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 21600000).toISOString()
        },
        {
          id: 'res_seed_104',
          userId: 'usr_st_1787120282490_av5lu',
          userGamerTag: 'premii13',
          userFullName: 'premii',
          game: 'UNO',
          result: 'WIN',
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 10800000).toISOString()
        }
      ];

      for (const resDoc of sampleResults) {
        const xpDoc: XpHistoryEntry = {
          id: 'xp_' + resDoc.id,
          userId: resDoc.userId,
          userGamerTag: resDoc.userGamerTag,
          game: resDoc.game,
          result: resDoc.result,
          amount: resDoc.xpAwarded,
          performedBy: adminEmail,
          createdAt: resDoc.createdAt
        };
        await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'gameResults', resDoc.id), resDoc));
        await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'xpHistory', xpDoc.id), xpDoc));
      }
      console.log('✅ Default Cloud Firestore match results & XP transaction history successfully written.');
    }
  } catch (err) {
    console.error('Error ensuring schema in Cloud Firestore:', err);
  }
}

// --- SERVER INITIALIZATION ---

console.log(`⚡ Initializing 100% Cloud Firestore Backend (Project: ${firebaseConfig.projectId})...`);

const app = express();
app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'ok',
      database: 'Cloud Firestore',
      projectId: firebaseConfig.projectId,
      serverTime: new Date().toISOString()
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

      const ALLOWED_DEPARTMENTS = ['CSE', 'AIDS', 'AIML', 'IT', 'CSBS', 'ESPORTS COMMISSION'];
      if (!ALLOWED_DEPARTMENTS.includes(trimmedDept)) {
        return res.status(400).json({
          error: 'Invalid department. Allowed departments are CSE, AIDS, AIML, IT, CSBS, Esports Commission.'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          error: 'Passwords do not match. Please verify your Password and Confirm Password.'
        });
      }

      // Check username uniqueness in Firestore
      const existingUserByTag = await getUserByGamerTag(trimmedUsername);
      if (existingUserByTag) {
        return res.status(400).json({
          error: 'Username is already taken! Try another one. 👀'
        });
      }

      // Check if same student / team combo already registered
      const allStudents = await getAllStudentsFromFirestore();
      const duplicateAccount = allStudents.find(
        (u) =>
          u.fullName.toLowerCase() === trimmedName.toLowerCase() &&
          (u.teamName?.toLowerCase() === trimmedTeam.toLowerCase() ||
            u.studentId?.toLowerCase() === trimmedTeam.toLowerCase())
      );

      if (duplicateAccount) {
        return res.status(400).json({
          error: 'Oops! You already exist! Try Logging In! 😎'
        });
      }

      // Generate user record
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
        rankTier: 'Spark',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        joinedAt: new Date().toISOString().split('T')[0]
      };

      // Write directly to Cloud Firestore
      await setDoc(doc(firestoreDb, 'users', newUser.id), newUser);
      await setDoc(doc(firestoreDb, 'sessions', token), {
        token,
        userId: newUser.id,
        createdAt: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        message: 'Account registered successfully in Cloud Firestore!',
        token,
        user: stripPasswordHash(newUser)
      });
    } catch (err) {
      console.error('Registration error in Cloud Firestore:', err);
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

      // Find user by gamerTag or email directly in Firestore
      let user = await getUserByGamerTag(queryStr);
      if (!user) {
        user = await getUserByEmail(queryStr);
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const token = 'token_st_' + Date.now() + '_' + user.id;

      // Save session in Cloud Firestore
      await setDoc(doc(firestoreDb, 'sessions', token), {
        token,
        userId: user.id,
        createdAt: new Date().toISOString()
      });

      res.json({ token, user: stripPasswordHash(user) });
    } catch (err) {
      console.error('Login error in Cloud Firestore:', err);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  // STUDENT AUTH: Google / Student Login
  app.post('/api/auth/student-google', async (req, res) => {
    try {
      const { email, fullName, avatar, googleId, department, studentId, gamerTag } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Google account email is required' });
      }

      let user = await getUserByEmail(email);

      if (!user) {
        const username = gamerTag || email.split('@')[0] || 'Player';
        user = {
          id: 'usr_st_' + Date.now(),
          googleId: googleId || 'g_' + Date.now(),
          email,
          fullName: fullName || username,
          gamerTag: username,
          avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          department: department || 'CSE',
          teamName: studentId || 'Team Apex',
          studentId: studentId || 'ST-' + Math.floor(1000 + Math.random() * 9000),
          role: 'student',
          xp: 0,
          rankTier: 'Spark',
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          joinedAt: new Date().toISOString().split('T')[0]
        };
        await setDoc(doc(firestoreDb, 'users', user.id), user);
      } else {
        const updates: Partial<User> = {};
        if (fullName) updates.fullName = fullName;
        if (avatar) updates.avatar = avatar;
        if (googleId) updates.googleId = googleId;
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(firestoreDb, 'users', user.id), updates);
          user = { ...user, ...updates };
        }
      }

      const token = 'token_st_' + Date.now() + '_' + user.id;
      await setDoc(doc(firestoreDb, 'sessions', token), {
        token,
        userId: user.id,
        createdAt: new Date().toISOString()
      });

      res.json({ token, user: stripPasswordHash(user) });
    } catch (err) {
      console.error('Google sign-in error:', err);
      res.status(500).json({ error: 'Google authentication failed.' });
    }
  });

  // ADMIN AUTH: Login
  app.post(['/api/auth/admin-login', '/api/admin/admin-login'], async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const adminUser = await getUserByEmail(email);

      if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'admin')) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const isValid = verifyPassword(password, adminUser.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const token = 'token_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2);

      // Store admin session directly in Firestore
      await setDoc(doc(firestoreDb, 'sessions', token), {
        token,
        userId: adminUser.id,
        createdAt: new Date().toISOString()
      });

      await logAudit('ADMIN_LOGIN', adminUser.email, 'Admin signed in successfully', req);

      res.json({ token, user: { ...stripPasswordHash(adminUser), role: 'ADMIN' } });
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  });

  // ADMIN FORGOT PASSWORD
  app.post('/api/admin/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      const admin = await getUserByEmail(email || '');

      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'admin')) {
        return res.status(404).json({ error: 'No admin account found with that email address' });
      }

      const resetToken = 'reset_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      await setDoc(doc(firestoreDb, 'adminResetTokens', resetToken), {
        email: admin.email,
        expiresAt: Date.now() + 3600000
      });

      await logAudit('PASSWORD_RESET', admin.email, `Password reset token requested for ${admin.email}`, req);

      res.json({ success: true, message: 'Password reset code generated.', resetToken });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Failed to process password reset request.' });
    }
  });

  // ADMIN RESET PASSWORD
  app.post('/api/admin/reset-password', async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return res.status(400).json({ error: 'Reset token and new password are required' });
      }

      const tokenDocRef = doc(firestoreDb, 'adminResetTokens', resetToken);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const tokenData = tokenSnap.data();
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        await deleteDoc(tokenDocRef);
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const admin = await getUserByEmail(tokenData.email);
      if (admin) {
        await updateDoc(doc(firestoreDb, 'users', admin.id), {
          passwordHash: hashPassword(newPassword)
        });
      }

      await deleteDoc(tokenDocRef);
      await logAudit('PASSWORD_RESET', tokenData.email, `Password updated for admin ${tokenData.email}`, req);

      res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  // GET CURRENT AUTHENTICATED USER
  app.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '').trim() : '';

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(200).json({ user: null });
    }

    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(200).json({ user: null });
      res.json({ user: stripPasswordHash(user) });
    } catch (err: any) {
      const isOffline = err?.code === 'unavailable' || String(err?.message).includes('client is offline');
      if (isOffline) {
        return res.status(503).json({ error: 'Database temporarily offline', code: 'unavailable' });
      }
      res.status(500).json({ error: 'Failed to fetch user session' });
    }
  });

  // LOGOUT
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '').trim();
        if (token) {
          await deleteDoc(doc(firestoreDb, 'sessions', token));
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // LEADERBOARD (Direct Live Query from Cloud Firestore)
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const { search } = req.query;
      let students = await getAllStudentsFromFirestore();

      if (search) {
        const queryStr = (search as string).toLowerCase();
        students = students.filter(
          (u) =>
            u.gamerTag.toLowerCase().includes(queryStr) ||
            u.fullName.toLowerCase().includes(queryStr) ||
            u.department.toLowerCase().includes(queryStr) ||
            u.studentId.toLowerCase().includes(queryStr)
        );
      }

      // Sort strictly by XP descending, then Wins descending, then GamerTag
      students.sort((a, b) => {
        if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        return a.gamerTag.localeCompare(b.gamerTag);
      });

      const leaderboard = students.map((user, index) => ({
        ...stripPasswordHash(user),
        rank: index + 1
      }));

      res.json({
        leaderboard,
        totalStudents: leaderboard.length,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error fetching live leaderboard from Firestore:', err);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // GET ALL PLAYERS / ROSTER
  app.get('/api/users', async (req, res) => {
    try {
      const students = await getAllStudentsFromFirestore();
      res.json({ users: students.map(stripPasswordHash) });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  });

  // GET PLAYER PROFILE + OFFICIAL GAME & XP HISTORY
  app.get('/api/users/:id', async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: 'Player profile not found' });

      // Query results and XP history directly from Cloud Firestore
      const resultsSnap = await getDocs(
        query(collection(firestoreDb, 'gameResults'), where('userId', '==', user.id))
      );
      const userResults: GameResult[] = [];
      resultsSnap.forEach((d) => {
        const r = d.data() as GameResult;
        if (!r.isVoided) {
          userResults.push(r);
        }
      });
      userResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const xpSnap = await getDocs(
        query(collection(firestoreDb, 'xpHistory'), where('userId', '==', user.id))
      );
      const userXpHistory: XpHistoryEntry[] = [];
      xpSnap.forEach((d) => {
        userXpHistory.push(d.data() as XpHistoryEntry);
      });
      userXpHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        user: stripPasswordHash(user),
        gameResults: userResults,
        xpHistory: userXpHistory
      });
    } catch (err) {
      console.error('Error fetching player profile from Firestore:', err);
      res.status(500).json({ error: 'Failed to fetch player details' });
    }
  });

  // UPDATE EVENT POINTS (ADMIN ONLY - Direct Cloud Firestore Transaction)
  app.post('/api/admin/update-points', async (req, res) => {
    try {
      const admin = await getAdminUser(req);
      if (!admin) {
        return res.status(403).json({ error: '403 / Access Denied: Admin authorization required' });
      }

      const { userId, game, result, moviesWon } = req.body;

      if (!userId || !game || !result) {
        return res.status(400).json({ error: 'Missing required parameters: userId, game, result' });
      }

      const student = await getUserById(userId);
      if (!student) {
        return res.status(404).json({ error: 'Selected student participant not found' });
      }

      const xpAwarded = calculateXpForGame(game, result, moviesWon);
      const isWin =
        result === 'WIN' ||
        result === 'CORRECT WITHIN TIME' ||
        (game === 'Dumb Charades' && (moviesWon || 0) > 0);

      const newXp = Math.max(0, (student.xp || 0) + xpAwarded);
      const newRankTier = calculateRankTier(newXp);
      const newGamesPlayed = (student.gamesPlayed || 0) + 1;
      const newWins = isWin ? (student.wins || 0) + 1 : student.wins || 0;
      const newLosses = !isWin ? (student.losses || 0) + 1 : student.losses || 0;

      const updatedStudent: User = {
        ...student,
        xp: newXp,
        rankTier: newRankTier,
        gamesPlayed: newGamesPlayed,
        wins: newWins,
        losses: newLosses
      };

      const resultId = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const xpId = 'xp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const newResult: GameResult = {
        id: resultId,
        userId: student.id,
        userGamerTag: student.gamerTag,
        userFullName: student.fullName,
        game: game as EventGame,
        result: result,
        xpAwarded,
        isVoided: false,
        recordedByAdmin: admin.email,
        createdAt: new Date().toISOString()
      };

      if (game === 'Dumb Charades') {
        newResult.moviesWon = Math.max(0, parseInt(String(moviesWon || 0), 10) || 0);
      }

      const newXpEntry: XpHistoryEntry = {
        id: xpId,
        userId: student.id,
        userGamerTag: student.gamerTag,
        game,
        result: game === 'Dumb Charades' ? `WIN (${newResult.moviesWon || 0} Movies)` : result,
        amount: xpAwarded,
        performedBy: admin.email,
        createdAt: new Date().toISOString()
      };

      // Write directly to Cloud Firestore collections
      await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'users', student.id), updatedStudent, { merge: true }));
      await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'gameResults', newResult.id), newResult));
      await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'xpHistory', newXpEntry.id), newXpEntry));
      await logAudit(
        'XP_UPDATE',
        admin.email,
        `Awarded +${xpAwarded} XP to ${student.fullName} (${student.gamerTag}) for ${game} [${result}]`,
        req
      );

      res.json({
        success: true,
        user: stripPasswordHash(updatedStudent),
        gameResult: newResult,
        xpEntry: newXpEntry
      });
    } catch (err) {
      console.error('Error recording points in Cloud Firestore:', err);
      res.status(500).json({ error: 'Failed to record event match result' });
    }
  });



  // GAME RESULTS (Official List)
  app.get('/api/admin/game-results', async (req, res) => {
    try {
      let snap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'gameResults')));
      if (snap.empty) {
        await ensureSchemaAndInitialData();
        snap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'gameResults')));
      }

      const results: GameResult[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data) {
          results.push({
            id: d.id,
            ...data
          } as GameResult);
        }
      });

      results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json({ gameResults: results });
    } catch (err) {
      console.error('Error fetching game results:', err);
      res.status(500).json({ error: 'Failed to fetch game results' });
    }
  });

  // VOID / CORRECT A GAME RESULT (ADMIN ONLY - Direct Cloud Firestore)
  app.post('/api/admin/void-result', async (req, res) => {
    try {
      const admin = await getAdminUser(req);
      if (!admin) {
        return res.status(403).json({ error: '403 / Access Denied: Admin authorization required' });
      }

      const { resultId, voidReason } = req.body;

      if (!resultId || !voidReason) {
        return res.status(400).json({ error: 'resultId and voidReason are required' });
      }

      const resultDocRef = doc(firestoreDb, 'gameResults', resultId);
      const resultSnap = await withFirestoreRetry(() => getDoc(resultDocRef));

      if (!resultSnap.exists()) {
        return res.status(404).json({ error: 'Game result record not found' });
      }

      const result = resultSnap.data() as GameResult;
      if (result.isVoided) {
        return res.status(400).json({ error: 'This game result has already been voided' });
      }

      const student = await getUserById(result.userId);
      let updatedStudent: User | undefined = undefined;

      if (student) {
        const isWin =
          result.result === 'WIN' ||
          result.result === 'CORRECT WITHIN TIME' ||
          (result.game === 'Dumb Charades' && (result.moviesWon || 0) > 0);

        const newXp = Math.max(0, (student.xp || 0) - result.xpAwarded);
        const newWins = isWin ? Math.max(0, (student.wins || 0) - 1) : student.wins || 0;
        const newLosses = !isWin ? Math.max(0, (student.losses || 0) - 1) : student.losses || 0;
        const newGamesPlayed = Math.max(0, (student.gamesPlayed || 0) - 1);

        updatedStudent = {
          ...student,
          xp: newXp,
          rankTier: calculateRankTier(newXp),
          gamesPlayed: newGamesPlayed,
          wins: newWins,
          losses: newLosses
        };

        await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'users', student.id), updatedStudent, { merge: true }));
      }

      // Mark result as voided
      await withFirestoreRetry(() =>
        updateDoc(resultDocRef, {
          isVoided: true,
          voidReason
        })
      );

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

      await withFirestoreRetry(() => setDoc(doc(firestoreDb, 'xpHistory', voidXpEntry.id), voidXpEntry));
      await logAudit(
        'RESULT_VOID',
        admin.email,
        `Voided game result ${resultId} for ${result.userGamerTag}. Reason: ${voidReason}`,
        req
      );

      res.json({
        success: true,
        result: { ...result, isVoided: true, voidReason },
        user: updatedStudent ? stripPasswordHash(updatedStudent) : undefined
      });
    } catch (err) {
      console.error('Error voiding result in Cloud Firestore:', err);
      res.status(500).json({ error: 'Failed to void result' });
    }
  });

  // XP HISTORY (Full Log from Firestore)
  app.get(['/api/xp/history', '/api/admin/xp-history'], async (req, res) => {
    try {
      let snap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'xpHistory')));
      if (snap.empty) {
        await ensureSchemaAndInitialData();
        snap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'xpHistory')));
      }

      const history: XpHistoryEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data) {
          history.push({
            id: d.id,
            ...data
          } as XpHistoryEntry);
        }
      });

      history.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json({ xpHistory: history });
    } catch (err) {
      console.error('Error fetching XP history:', err);
      res.status(500).json({ error: 'Failed to fetch XP history' });
    }
  });

  // AUDIT LOGS (Admin)
  app.get('/api/admin/audit-logs', async (req, res) => {
    try {
      const admin = await getAdminUser(req);
      if (!admin) {
        return res.status(403).json({ error: '403 / Access Denied: Admin authorization required' });
      }
      const snap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'auditLogs')));
      const logs: AuditLogEntry[] = [];
      snap.forEach((d) => logs.push(d.data() as AuditLogEntry));
      logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ auditLogs: logs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // TOURNAMENT ANALYTICS (Admin)
  app.get('/api/admin/analytics', async (req, res) => {
    try {
      const students = await getAllStudentsFromFirestore();
      const resultsSnap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'gameResults')));
      const validResults: GameResult[] = [];
      resultsSnap.forEach((d) => {
        const r = d.data() as GameResult;
        if (!r.isVoided) validResults.push(r);
      });

      const xpSnap = await withFirestoreRetry(() => getDocs(collection(firestoreDb, 'xpHistory')));
      const xpHistory: XpHistoryEntry[] = [];
      xpSnap.forEach((d) => xpHistory.push(d.data() as XpHistoryEntry));
      xpHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const totalParticipants = students.length;
      const totalGamesPlayed = validResults.length;
      const resultsXpSum = validResults.reduce((acc, r) => acc + (r.xpAwarded || 0), 0);
      const studentsXpSum = students.reduce((acc, s) => acc + (s.xp || 0), 0);
      const totalXpAwarded = Math.max(resultsXpSum, studentsXpSum);

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

      const sortedStudents = [...students].sort((a, b) => (b.xp || 0) - (a.xp || 0));
      const currentLeader =
        sortedStudents.length > 0
          ? sortedStudents[0].fullName + ' (' + sortedStudents[0].gamerTag + ')'
          : 'None';

      const totalWins = students.reduce((acc, s) => acc + (s.wins || 0), 0);
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
        },
        xpHistory
      });
    } catch (err) {
      console.error('Analytics error in Cloud Firestore:', err);
      res.status(500).json({ error: 'Failed to calculate analytics' });
    }
  });

  // Export Express app for Vercel Serverless Functions
  export default app;

  // Startup configuration for local environments
  if (!process.env.VERCEL) {
    const startLocalServer = async () => {
      await ensureSchemaAndInitialData();
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
    };

    startLocalServer().catch((err) => {
      console.error('Failed to start local server:', err);
    });
  }
