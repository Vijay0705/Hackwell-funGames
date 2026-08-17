import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { createServer as createViteServer } from 'vite';
import { User, GameResult, XpHistoryEntry, AuditLogEntry, RankTier, EventGame } from './src/types.js';
import {
  INITIAL_USERS,
  INITIAL_GAME_RESULTS,
  INITIAL_XP_HISTORY,
  INITIAL_AUDIT_LOGS,
  calculateRankTier
} from './src/server/seedData.js';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data_store.json');

// Mongoose Connection Setup if MONGODB_URI is provided
const MONGODB_URI = process.env.MONGODB_URI;

// Password Hashing Helpers
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash?: string): boolean {
  if (!combinedHash || !combinedHash.includes(':')) return false;
  try {
    const [salt, originalHash] = combinedHash.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch (e) {
    return false;
  }
}

// Mongoose Models for MongoDB
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  googleId: String,
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  fullName: { type: String, required: true },
  gamerTag: { type: String, required: true },
  avatar: String,
  department: String,
  teamName: String,
  studentId: String,
  role: { type: String, required: true },
  xp: { type: Number, default: 0 },
  rankTier: { type: String, default: 'Iron' },
  gamesPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  joinedAt: String
});

const gameResultSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  userGamerTag: String,
  userFullName: String,
  game: String,
  result: String,
  moviesWon: Number,
  xpAwarded: Number,
  isVoided: Boolean,
  voidReason: String,
  recordedByAdmin: String,
  createdAt: String
});

const xpHistorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  userGamerTag: String,
  game: String,
  result: String,
  amount: Number,
  performedBy: String,
  createdAt: String
});

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  action: String,
  performedBy: String,
  details: String,
  ipAddress: String,
  createdAt: String
});

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' }
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
const GameResultModel = mongoose.models.GameResult || mongoose.model('GameResult', gameResultSchema);
const XpHistoryModel = mongoose.models.XpHistory || mongoose.model('XpHistory', xpHistorySchema);
const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);

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

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
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
    } else {
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load local DB file, using initial data:', err);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save DB file:', err);
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

  saveDb();

  // If MongoDB is connected, sync admin account to MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      await UserModel.findOneAndUpdate(
        { email: new RegExp(`^${adminEmail.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i') } as any,
        {
          id: adminUser.id,
          email: adminEmail,
          passwordHash: hashedVijayPass,
          fullName: adminUser.fullName,
          gamerTag: adminUser.gamerTag,
          avatar: adminUser.avatar,
          department: adminUser.department,
          studentId: adminUser.studentId,
          role: 'ADMIN',
          xp: adminUser.xp || 0,
          rankTier: adminUser.rankTier || 'Iron',
          gamesPlayed: adminUser.gamesPlayed || 0,
          wins: adminUser.wins || 0,
          losses: adminUser.losses || 0,
          joinedAt: adminUser.joinedAt || '2025-01-01'
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Error syncing admin account into MongoDB:', err);
    }
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
    default:
      return 0;
  }
}

async function startServer() {
  loadDb();

  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Successfully connected to MongoDB');
    } catch (err) {
      console.warn('MongoDB connection error, falling back to local persistent file engine:', err);
    }
  }

  await ensureAdminExists();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Helper Auth middleware
  const getAuthUser = async (req: express.Request): Promise<User | null> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    let userId = db.sessions[token];

    if (!userId && mongoose.connection.readyState === 1) {
      try {
        const sessionDoc = await SessionModel.findOne({ token } as any).exec();
        if (sessionDoc) {
          userId = sessionDoc.userId;
        }
      } catch (err) {
        console.error('Error fetching session from MongoDB:', err);
      }
    }

    if (!userId) return null;

    let user: User | null = db.users.find((u) => u.id === userId) || null;

    if (!user && mongoose.connection.readyState === 1) {
      try {
        const userDoc = await UserModel.findOne({ id: userId } as any).exec();
        if (userDoc) {
          user = userDoc.toObject() as User;
        }
      } catch (err) {
        console.error('Error fetching user from MongoDB:', err);
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

  const logAudit = (action: AuditLogEntry['action'], performedBy: string, details: string, req?: express.Request) => {
    const entry: AuditLogEntry = {
      id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      action,
      performedBy,
      details,
      ipAddress: req?.ip || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    db.auditLogs.unshift(entry);
    saveDb();
  };

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
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
      let existingUsernameUser = db.users.find(
        (u) => u.gamerTag.toLowerCase() === trimmedUsername.toLowerCase()
      );

      if (!existingUsernameUser && mongoose.connection.readyState === 1) {
        const doc = await UserModel.findOne({
          gamerTag: new RegExp(`^${trimmedUsername.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i')
        } as any).exec();
        if (doc) {
          existingUsernameUser = doc.toObject() as User;
        }
      }

      if (existingUsernameUser) {
        return res.status(400).json({
          error: 'Username is already taken! Try another one. 👀'
        });
      }

      // Check existing account detection (same full name & team name)
      let existingAccount = db.users.find(
        (u) =>
          u.fullName.toLowerCase() === trimmedName.toLowerCase() &&
          (u.teamName?.toLowerCase() === trimmedTeam.toLowerCase() ||
            u.studentId.toLowerCase() === trimmedTeam.toLowerCase())
      );

      if (!existingAccount && mongoose.connection.readyState === 1) {
        const doc = await UserModel.findOne({
          fullName: new RegExp(`^${trimmedName.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i'),
          $or: [
            { teamName: new RegExp(`^${trimmedTeam.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i') },
            { studentId: new RegExp(`^${trimmedTeam.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i') }
          ]
        } as any).exec();
        if (doc) {
          existingAccount = doc.toObject() as User;
        }
      }

      if (existingAccount) {
        return res.status(400).json({
          error: 'Oops! You already exist! Try Logging In! 😎'
        });
      }

      // Hash password securely
      const passwordHash = hashPassword(password);
      const userId = 'usr_st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const email = `${trimmedUsername.toLowerCase()}@gamingarena.edu`;

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

      db.users.push(newUser);
      saveDb();

      if (mongoose.connection.readyState === 1) {
        try {
          await UserModel.create(newUser);
        } catch (e) {
          console.error('Failed to create user in MongoDB:', e);
        }
      }

      const token = 'token_st_' + Date.now() + '_' + newUser.id;
      db.sessions[token] = newUser.id;
      saveDb();

      if (mongoose.connection.readyState === 1) {
        try {
          await SessionModel.create({ token, userId: newUser.id });
        } catch (e) {
          console.error('Failed to create session in MongoDB:', e);
        }
      }

      const { passwordHash: _, ...safeUser } = newUser;
      res.status(201).json({
        success: true,
        message: 'Account registered successfully!',
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

      let user: User | null =
        db.users.find(
          (u) =>
            u.gamerTag.toLowerCase() === queryStr.toLowerCase() ||
            u.email.toLowerCase() === queryStr.toLowerCase()
        ) || null;

      if (!user && mongoose.connection.readyState === 1) {
        try {
          const doc = await UserModel.findOne({
            $or: [
              { gamerTag: new RegExp(`^${queryStr.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i') },
              { email: new RegExp(`^${queryStr.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i') }
            ]
          } as any).exec();
          if (doc) user = doc.toObject() as User;
        } catch (dbErr) {
          console.error('MongoDB lookup error during login:', dbErr);
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const token = 'token_st_' + Date.now() + '_' + user.id;
      db.sessions[token] = user.id;
      saveDb();

      if (mongoose.connection.readyState === 1) {
        try {
          await SessionModel.create({ token, userId: user.id });
        } catch (e) {
          console.error('Failed to create session in MongoDB:', e);
        }
      }

      const { passwordHash: _, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  // STUDENT AUTH: Google / Student Login
  app.post('/api/auth/student-google', (req, res) => {
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
    db.sessions[token] = user.id;
    saveDb();

    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  // ADMIN AUTH: Login (Supports both /api/auth/admin-login and /api/admin/admin-login)
  app.post(['/api/auth/admin-login', '/api/admin/admin-login'], async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      let adminUser: User | null = null;

      // Check MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const doc = await UserModel.findOne({
            email: new RegExp(`^${email.replace(/[-[\]{}()*+?^$|#\s]/g, '\\$&')}$`, 'i'),
            role: { $in: ['ADMIN', 'admin'] }
          } as any).exec();

          if (doc) {
            adminUser = doc.toObject() as User;
          }
        } catch (dbErr) {
          console.error('MongoDB query error during admin lookup:', dbErr);
          return res.status(500).json({ error: 'Unable to connect to the authentication service. Please try again.' });
        }
      }

      // Fallback to local DB if not found in Mongo or Mongo not connected
      if (!adminUser) {
        adminUser =
          db.users.find(
            (u) =>
              (u.role === 'ADMIN' || u.role === 'admin') &&
              u.email.toLowerCase() === email.toLowerCase()
          ) || null;
      }

      if (!adminUser) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      // Password verification
      const isValid = verifyPassword(password, adminUser.passwordHash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      // Create secure authenticated session
      const token = 'token_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2);

      try {
        db.sessions[token] = adminUser.id;
        saveDb();

        if (mongoose.connection.readyState === 1) {
          await SessionModel.create({ token, userId: adminUser.id });
        }
      } catch (sessErr) {
        console.error('Failed to create session:', sessErr);
        return res.status(500).json({ error: 'Authentication failed. Please try again.' });
      }

      logAudit('ADMIN_LOGIN', adminUser.email, 'Admin signed in successfully', req);

      const { passwordHash, ...safeUser } = adminUser;
      res.json({ token, user: { ...safeUser, role: 'ADMIN' } });
    } catch (err) {
      console.error('Unexpected admin login error:', err);
      res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  });

  // ADMIN FORGOT PASSWORD
  app.post('/api/admin/forgot-password', (req, res) => {
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

    logAudit('PASSWORD_RESET', admin.email, `Password reset token requested for ${admin.email}`, req);
    saveDb();

    res.json({ success: true, message: 'Password reset code generated.', resetToken });
  });

  // ADMIN RESET PASSWORD
  app.post('/api/admin/reset-password', (req, res) => {
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
      if (mongoose.connection.readyState === 1) {
        UserModel.updateOne({ email: admin.email }, { passwordHash: admin.passwordHash }).catch(console.error);
      }
    }

    delete db.adminResetTokens[resetToken];
    logAudit('PASSWORD_RESET', tokenData.email, `Password updated for admin ${tokenData.email}`, req);
    saveDb();

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
      delete db.sessions[token];
      saveDb();

      if (mongoose.connection.readyState === 1) {
        try {
          await SessionModel.deleteOne({ token });
        } catch (e) {
          console.error('Error deleting session from Mongo:', e);
        }
      }
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
    db.gameResults.unshift(newResult);

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
    db.xpHistory.unshift(newXpEntry);

    logAudit(
      'XP_UPDATE',
      admin.email,
      `Awarded +${xpAwarded} XP to ${student.fullName} (${student.gamerTag}) for ${game} [${result}]`,
      req
    );

    saveDb();

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

    db.xpHistory.unshift({
      id: 'xp_void_' + Date.now(),
      userId: result.userId,
      userGamerTag: result.userGamerTag,
      game: result.game,
      result: `VOIDED: ${voidReason}`,
      amount: -result.xpAwarded,
      performedBy: admin.email,
      createdAt: new Date().toISOString()
    });

    logAudit('RESULT_VOID', admin.email, `Voided game result ${resultId} for ${result.userGamerTag}. Reason: ${voidReason}`, req);

    saveDb();

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Gaming Arena College Leaderboard Server running on http://localhost:${PORT}`);
  });
}

startServer();

