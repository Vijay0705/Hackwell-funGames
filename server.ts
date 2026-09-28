import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { User, GameResult, XpHistoryEntry, AuditLogEntry, RankTier, EventGame } from './src/types';
import { calculateRankTier } from './src/server/seedData';

dotenv.config({ path: ['.env', 'env'] });

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
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAIOWlMHhnzfcVUzCGULbdfS6IzqJItASY',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'hackwell-fungames.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'hackwell-fungames',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'hackwell-fungames.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '206289606816',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:206289606816:web:5c71780d13f2ef274ed1c5',
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-PDBGNEYX7S'
};

const FIREBASE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const FIREBASE_API_KEY = firebaseConfig.apiKey;

function objToFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'number') {
      fields[key] = { integerValue: String(Math.floor(value)) };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((v) =>
            typeof v === 'number'
              ? { integerValue: String(Math.floor(v)) }
              : typeof v === 'boolean'
              ? { booleanValue: v }
              : { stringValue: String(v) }
          )
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: objToFirestoreFields(value) } };
    }
  }
  return fields;
}

function firestoreFieldsToObj(fields?: Record<string, any>): Record<string, any> {
  if (!fields) return {};
  const obj: Record<string, any> = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj) continue;
    if ('stringValue' in valObj) obj[key] = valObj.stringValue;
    else if ('integerValue' in valObj) obj[key] = parseInt(valObj.integerValue, 10);
    else if ('doubleValue' in valObj) obj[key] = parseFloat(valObj.doubleValue);
    else if ('booleanValue' in valObj) obj[key] = valObj.booleanValue;
    else if ('mapValue' in valObj) obj[key] = firestoreFieldsToObj(valObj.mapValue?.fields);
    else if ('arrayValue' in valObj) {
      const arr = valObj.arrayValue?.values || [];
      obj[key] = arr.map((item: any) => {
        if ('stringValue' in item) return item.stringValue;
        if ('integerValue' in item) return parseInt(item.integerValue, 10);
        if ('doubleValue' in item) return parseFloat(item.doubleValue);
        if ('booleanValue' in item) return item.booleanValue;
        if ('mapValue' in item) return firestoreFieldsToObj(item.mapValue?.fields);
        return null;
      });
    }
  }
  return obj;
}

async function fsGetDoc(collectionName: string, docId: string): Promise<Record<string, any> | null> {
  try {
    const url = `${FIREBASE_REST_BASE}/${collectionName}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.fields) return { id: docId };
    return { ...firestoreFieldsToObj(json.fields), id: docId };
  } catch (e) {
    return null;
  }
}

async function fsSetDoc(collectionName: string, docId: string, data: Record<string, any>): Promise<boolean> {
  try {
    const url = `${FIREBASE_REST_BASE}/${collectionName}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
    const fields = objToFirestoreFields(data);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function fsDeleteDoc(collectionName: string, docId: string): Promise<boolean> {
  try {
    const url = `${FIREBASE_REST_BASE}/${collectionName}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function fsGetCollection(collectionName: string): Promise<Record<string, any>[]> {
  try {
    const url = `${FIREBASE_REST_BASE}/${collectionName}?key=${FIREBASE_API_KEY}&pageSize=300`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const docs: Record<string, any>[] = [];
    if (json.documents && Array.isArray(json.documents)) {
      for (const d of json.documents) {
        const id = d.name ? d.name.split('/').pop() : '';
        const parsed = firestoreFieldsToObj(d.fields);
        if (id) docs.push({ ...parsed, id: parsed.id || id });
      }
    }
    return docs;
  } catch (e) {
    return [];
  }
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
  const docData = await fsGetDoc('users', userId);
  if (docData && docData.id) return docData as User;
  const allUsers = await fsGetCollection('users');
  return (allUsers.find((u) => u.id === userId) as User) || null;
}

async function getUserByGamerTag(gamerTag: string): Promise<User | null> {
  if (!gamerTag || !gamerTag.trim()) return null;
  const tagLower = gamerTag.trim().toLowerCase();
  const allUsers = await fsGetCollection('users');
  return (allUsers.find((u) => u.gamerTag && String(u.gamerTag).toLowerCase() === tagLower) as User) || null;
}

async function getUserByEmail(email: string): Promise<User | null> {
  if (!email || !email.trim()) return null;
  const emailLower = email.trim().toLowerCase();
  const allUsers = await fsGetCollection('users');
  return (allUsers.find((u) => u.email && String(u.email).toLowerCase() === emailLower) as User) || null;
}

async function getAllStudentsFromFirestore(): Promise<User[]> {
  try {
    const allDocs = await fsGetCollection('users');
    const students: User[] = [];
    for (const u of allDocs) {
      const roleStr = String(u.role || '').toLowerCase();
      if (u.id === 'usr_admin_vijay' || roleStr === 'admin') continue;

      const fullName = u.fullName || u.gamerTag || (u.email ? u.email.split('@')[0] : '');
      const gamerTag = u.gamerTag || fullName || (u.email ? u.email.split('@')[0] : '');
      if (!fullName && !gamerTag && !u.email) continue;

      const xp = typeof u.xp === 'number' ? u.xp : 0;
      students.push({
        ...(u as User),
        id: u.id,
        fullName: fullName || 'Anonymous Player',
        gamerTag: gamerTag || 'player',
        email: u.email || `${(gamerTag || 'player').toLowerCase()}@gamingarena.edu`,
        department: u.department || 'CSE',
        teamName: u.teamName || u.studentId || 'N/A',
        studentId: u.studentId || 'ST-000',
        role: u.role || 'student',
        avatar: u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(gamerTag || u.id)}`,
        xp,
        rankTier: calculateRankTier(xp),
        gamesPlayed: typeof u.gamesPlayed === 'number' ? u.gamesPlayed : 0,
        wins: typeof u.wins === 'number' ? u.wins : 0,
        losses: typeof u.losses === 'number' ? u.losses : 0,
        joinedAt: u.joinedAt || new Date().toISOString().split('T')[0]
      });
    }
    return students;
  } catch (err) {
    console.error('Error fetching all students from Firestore REST:', err);
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
    await fsSetDoc('auditLogs', entry.id, entry);
  } catch (err) {
    console.error('Failed to write audit log to Firestore REST:', err);
  }
}

async function getAuthUser(req: express.Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'null' || token === 'undefined') return null;

  try {
    const sessionData = await fsGetDoc('sessions', token);
    if (!sessionData || !sessionData.userId) return null;
    return await getUserById(sessionData.userId);
  } catch (err) {
    return null;
  }
}

async function getAdminUser(req: express.Request): Promise<User | null> {
  const user = await getAuthUser(req);
  if (!user) return null;
  if (user.role !== 'ADMIN' && user.role !== 'admin') return null;
  return user;
}

async function ensureSchemaAndInitialData() {
  const adminEmail = 'ivijaysa@gmail.com';
  const hashedVijayPass = hashPassword('vijay007');

  try {
    const adminDoc = await fsGetDoc('users', 'usr_admin_vijay');
    if (!adminDoc || !adminDoc.email) {
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
      await fsSetDoc('users', 'usr_admin_vijay', adminUser);
      console.log('✅ Admin account (ivijaysa@gmail.com) verified and initialized in Cloud Firestore REST');
    }

    const auditDocs = await fsGetCollection('auditLogs');
    if (auditDocs.length === 0) {
      const initialLog: AuditLogEntry = {
        id: 'audit_init_1001',
        action: 'ADMIN_LOGIN',
        performedBy: adminEmail,
        details: 'Cloud Firestore database schema verified according to db_schema.json specification.',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString()
      };
      await fsSetDoc('auditLogs', initialLog.id, initialLog);
    }
  } catch (err) {
    console.error('Error ensuring schema in Cloud Firestore REST:', err);
  }
}

let schemaInitializedPromise: Promise<void> | null = null;
function ensureSchemaInitialized() {
  if (!schemaInitializedPromise) {
    schemaInitializedPromise = ensureSchemaAndInitialData().catch((err) => {
      console.error('Failed to initialize schema:', err);
      schemaInitializedPromise = null;
    });
  }
  return schemaInitializedPromise;
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Middleware to ensure Firestore schema and admin user are initialized on every environment (including Vercel)
app.use(async (req, res, next) => {
  try {
    await ensureSchemaInitialized();
  } catch (e) {
    // Ignore schema init errors to avoid blocking request execution
  }
  next();
});

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

      // Write directly to Cloud Firestore REST
      await fsSetDoc('users', newUser.id, newUser);
      await fsSetDoc('sessions', token, {
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

      // Save session in Cloud Firestore REST
      await fsSetDoc('sessions', token, {
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
        await fsSetDoc('users', user.id, user);
      } else {
        const updates: Partial<User> = {};
        if (fullName) updates.fullName = fullName;
        if (avatar) updates.avatar = avatar;
        if (googleId) updates.googleId = googleId;
        if (Object.keys(updates).length > 0) {
          await fsSetDoc('users', user.id, { ...user, ...updates });
          user = { ...user, ...updates };
        }
      }

      const token = 'token_st_' + Date.now() + '_' + user.id;
      await fsSetDoc('sessions', token, {
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

      // Store admin session directly in Cloud Firestore REST
      await fsSetDoc('sessions', token, {
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
      await fsSetDoc('adminResetTokens', resetToken, {
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

      const tokenData = await fsGetDoc('adminResetTokens', resetToken);

      if (!tokenData || !tokenData.email) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      if (tokenData.expiresAt && Number(tokenData.expiresAt) < Date.now()) {
        await fsDeleteDoc('adminResetTokens', resetToken);
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const admin = await getUserByEmail(tokenData.email);
      if (admin) {
        await fsSetDoc('users', admin.id, {
          ...admin,
          passwordHash: hashPassword(newPassword)
        });
      }

      await fsDeleteDoc('adminResetTokens', resetToken);
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
          await fsDeleteDoc('sessions', token);
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

      // Query results and XP history directly from Cloud Firestore REST
      const allResults = await fsGetCollection('gameResults');
      const userResults = (allResults as GameResult[])
        .filter((r) => r.userId === user.id && !r.isVoided)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const allXpHistory = await fsGetCollection('xpHistory');
      const userXpHistory = (allXpHistory as XpHistoryEntry[])
        .filter((x) => x.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

      // Write directly to Cloud Firestore REST
      await fsSetDoc('users', student.id, updatedStudent);
      await fsSetDoc('gameResults', newResult.id, newResult);
      await fsSetDoc('xpHistory', newXpEntry.id, newXpEntry);
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
      let results = (await fsGetCollection('gameResults')) as GameResult[];
      if (results.length === 0) {
        await ensureSchemaAndInitialData();
        results = (await fsGetCollection('gameResults')) as GameResult[];
      }

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

      const result = (await fsGetDoc('gameResults', resultId)) as GameResult | null;

      if (!result) {
        return res.status(404).json({ error: 'Game result record not found' });
      }

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

        await fsSetDoc('users', student.id, updatedStudent);
      }

      // Mark result as voided
      const updatedResult = { ...result, isVoided: true, voidReason };
      await fsSetDoc('gameResults', resultId, updatedResult);

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

      await fsSetDoc('xpHistory', voidXpEntry.id, voidXpEntry);
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
      let history = (await fsGetCollection('xpHistory')) as XpHistoryEntry[];
      if (history.length === 0) {
        await ensureSchemaAndInitialData();
        history = (await fsGetCollection('xpHistory')) as XpHistoryEntry[];
      }

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
      const logs = (await fsGetCollection('auditLogs')) as AuditLogEntry[];
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
      const allResults = (await fsGetCollection('gameResults')) as GameResult[];
      const validResults = allResults.filter((r) => !r.isVoided);

      const xpHistory = (await fsGetCollection('xpHistory')) as XpHistoryEntry[];
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

  // Startup configuration for local environments (only when executed directly)
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER || process.env.VERCEL_ENV);
  const isDirectRun = Boolean(process.argv[1]?.endsWith('server.ts') || process.env.START_SERVER === 'true');
  if (!isVercel && isDirectRun) {
    const startLocalServer = async () => {
      await ensureSchemaAndInitialData();
      if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
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
