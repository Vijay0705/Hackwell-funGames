var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  calculateXpForGame: () => calculateXpForGame,
  default: () => server_default,
  hashPassword: () => hashPassword,
  verifyPassword: () => verifyPassword
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// src/data/games.ts
function calculateRankTier(xp) {
  if (xp >= 200) return "Grand master";
  if (xp >= 150) return "Legend";
  if (xp >= 100) return "Nova";
  if (xp >= 50) return "Blaze";
  return "Spark";
}

// src/server/seedData.ts
var INITIAL_AUDIT_LOGS = [
  {
    id: "audit_1",
    action: "ADMIN_LOGIN",
    performedBy: "ivijaysa@gmail.com",
    details: "System initialized with zero student records. Ready for real participant registrations.",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];

// server.ts
import_dotenv.default.config({ path: [".env", "env"] });
(0, import_firestore.setLogLevel)("error");
var PORT = process.env.PORT || 3e3;
function hashPassword(password) {
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const hash = import_crypto.default.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, combinedHash) {
  if (!combinedHash) return false;
  if (!combinedHash.includes(":")) {
    return password === combinedHash;
  }
  try {
    const [salt, originalHash] = combinedHash.split(":");
    const hash = import_crypto.default.scryptSync(password, salt, 64).toString("hex");
    return import_crypto.default.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
  } catch (e) {
    return false;
  }
}
function calculateXpForGame(game, result, moviesWon) {
  switch (game) {
    case "Chess":
      return result === "WIN" ? 50 : 0;
    case "UNO":
      return result === "WIN" ? 25 : 0;
    case "Drawasourous / Scribble.io":
      return result === "WIN" ? 10 : 0;
    case "Among Us":
      return result === "WIN" ? 15 : 0;
    case "Antakshiri":
      return result === "WIN" ? 10 : 0;
    case "Dumb Charades": {
      const count = Math.max(0, parseInt(String(moviesWon || 0), 10) || 0);
      return count * 5;
    }
    case "Guess the PIN":
      return result === "CORRECT WITHIN TIME" ? 10 : 0;
    case "Free Fire / BGMI":
      return result === "WIN" ? 60 : 0;
    default:
      return 0;
  }
}
var firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyAIOWlMHhnzfcVUzCGULbdfS6IzqJItASY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "hackwell-fungames.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "hackwell-fungames",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "hackwell-fungames.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "206289606816",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:206289606816:web:5c71780d13f2ef274ed1c5",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PDBGNEYX7S"
};
var appInstance = (0, import_app.getApps)().length === 0 ? (0, import_app.initializeApp)(firebaseConfig) : (0, import_app.getApp)();
var firestoreDb = (0, import_firestore.getFirestore)(appInstance);
async function withFirestoreRetry(op, retries = 3, delayMs = 200) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      const isOffline = err?.code === "unavailable" || err?.message && String(err.message).toLowerCase().includes("client is offline");
      if (isOffline && i < retries - 1) {
        await new Promise((res) => setTimeout(res, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
function stripPasswordHash(user) {
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    rankTier: calculateRankTier(safeUser.xp || 0)
  };
}
async function getUserById(userId) {
  if (!userId || typeof userId !== "string" || userId === "null" || userId === "undefined") return null;
  try {
    const snap = await withFirestoreRetry(() => (0, import_firestore.getDoc)((0, import_firestore.doc)(firestoreDb, "users", userId)));
    if (snap.exists()) {
      const data = snap.data();
      return { ...data, id: data.id || snap.id };
    }
    const q = (0, import_firestore.query)((0, import_firestore.collection)(firestoreDb, "users"), (0, import_firestore.where)("id", "==", userId));
    const snapQ = await withFirestoreRetry(() => (0, import_firestore.getDocs)(q));
    if (!snapQ.empty) {
      const data = snapQ.docs[0].data();
      return { ...data, id: data.id || snapQ.docs[0].id };
    }
  } catch (err) {
    if (err?.code === "unavailable" || String(err?.message).includes("client is offline")) {
      console.warn(`[Firestore Offline] Transient network issue reading user profile document ${userId}`);
    } else {
      console.error(`Error fetching user ${userId} from Firestore:`, err);
    }
  }
  return null;
}
async function getUserByGamerTag(gamerTag) {
  if (!gamerTag || !gamerTag.trim()) return null;
  try {
    const q = (0, import_firestore.query)((0, import_firestore.collection)(firestoreDb, "users"), (0, import_firestore.where)("gamerTag", "==", gamerTag.trim()));
    const snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)(q));
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    const allSnap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "users")));
    for (const d of allSnap.docs) {
      const u = d.data();
      if (u.gamerTag && u.gamerTag.toLowerCase() === gamerTag.trim().toLowerCase()) {
        return u;
      }
    }
  } catch (err) {
    console.error(`Error finding user by gamerTag ${gamerTag}:`, err);
  }
  return null;
}
async function getUserByEmail(email) {
  if (!email || !email.trim()) return null;
  try {
    const q = (0, import_firestore.query)((0, import_firestore.collection)(firestoreDb, "users"), (0, import_firestore.where)("email", "==", email.trim()));
    const snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)(q));
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    const allSnap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "users")));
    for (const d of allSnap.docs) {
      const u = d.data();
      if (u.email && u.email.toLowerCase() === email.trim().toLowerCase()) {
        return u;
      }
    }
  } catch (err) {
    console.error(`Error finding user by email ${email}:`, err);
  }
  return null;
}
async function getAllStudentsFromFirestore() {
  try {
    const snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "users")));
    const students = [];
    snap.forEach((docSnap) => {
      const u = docSnap.data();
      const roleStr = String(u.role || "").toLowerCase();
      if (u.id === "usr_admin_vijay" || roleStr === "admin") return;
      const fullName = u.fullName || u.gamerTag || (u.email ? u.email.split("@")[0] : "");
      const gamerTag = u.gamerTag || fullName || (u.email ? u.email.split("@")[0] : "");
      if (!fullName && !gamerTag && !u.email) return;
      const xp = typeof u.xp === "number" ? u.xp : 0;
      students.push({
        ...u,
        id: u.id || docSnap.id,
        fullName: fullName || "Anonymous Player",
        gamerTag: gamerTag || "player",
        email: u.email || `${(gamerTag || "player").toLowerCase()}@gamingarena.edu`,
        department: u.department || "CSE",
        teamName: u.teamName || u.studentId || "N/A",
        studentId: u.studentId || "ST-000",
        role: u.role || "student",
        avatar: u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(gamerTag || docSnap.id)}`,
        xp,
        rankTier: calculateRankTier(xp),
        gamesPlayed: typeof u.gamesPlayed === "number" ? u.gamesPlayed : 0,
        wins: typeof u.wins === "number" ? u.wins : 0,
        losses: typeof u.losses === "number" ? u.losses : 0,
        joinedAt: u.joinedAt || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      });
    });
    return students;
  } catch (err) {
    console.error("Error fetching all students from Firestore:", err);
    return [];
  }
}
async function logAudit(action, performedBy, details, req) {
  try {
    const entry = {
      id: "audit_" + Date.now() + "_" + Math.floor(Math.random() * 1e3),
      action,
      performedBy,
      details,
      ipAddress: req?.ip || "127.0.0.1",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "auditLogs", entry.id), entry));
  } catch (err) {
    console.error("Failed to write audit log to Firestore:", err);
  }
}
var inFlightSessions = /* @__PURE__ */ new Map();
async function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === "null" || token === "undefined") return null;
  if (inFlightSessions.has(token)) {
    return inFlightSessions.get(token);
  }
  const sessionPromise = (async () => {
    try {
      const sessionSnap = await withFirestoreRetry(() => (0, import_firestore.getDoc)((0, import_firestore.doc)(firestoreDb, "sessions", token)));
      if (!sessionSnap.exists()) return null;
      const sessionData = sessionSnap.data();
      const userId = sessionData?.userId;
      if (!userId || typeof userId !== "string" || userId === "null" || userId === "undefined") return null;
      return await getUserById(userId);
    } catch (err) {
      if (err?.code === "unavailable" || String(err?.message).includes("client is offline")) {
        console.warn(`[Firestore Offline] Transient network issue resolving session token: ${token.substring(0, 12)}...`);
      } else if (err?.code === "permission-denied") {
        console.warn("\u26A0\uFE0F Firestore permission denied while resolving auth session.");
      } else {
        console.error("Error resolving auth user session from Firestore:", err);
      }
      return null;
    } finally {
      inFlightSessions.delete(token);
    }
  })();
  inFlightSessions.set(token, sessionPromise);
  return sessionPromise;
}
async function getAdminUser(req) {
  const user = await getAuthUser(req);
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "admin") return null;
  return user;
}
async function ensureSchemaAndInitialData() {
  const adminEmail = "ivijaysa@gmail.com";
  const hashedVijayPass = hashPassword("vijay007");
  try {
    const adminDocRef = (0, import_firestore.doc)(firestoreDb, "users", "usr_admin_vijay");
    const adminSnap = await withFirestoreRetry(() => (0, import_firestore.getDoc)(adminDocRef));
    if (!adminSnap.exists()) {
      const adminUser = {
        id: "usr_admin_vijay",
        email: adminEmail,
        fullName: "Vijay S (Admin)",
        gamerTag: "Admin_Vijay",
        avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150",
        department: "Esports Commission",
        studentId: "ADM-2025-01",
        role: "ADMIN",
        passwordHash: hashedVijayPass,
        xp: 0,
        rankTier: "Spark",
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        joinedAt: "2025-01-01"
      };
      await withFirestoreRetry(() => (0, import_firestore.setDoc)(adminDocRef, adminUser));
      console.log("\u2705 Admin account (ivijaysa@gmail.com) verified and initialized in Cloud Firestore");
    }
    const auditSnap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "auditLogs")));
    if (auditSnap.empty) {
      const initialLog = {
        id: "audit_init_1001",
        action: "ADMIN_LOGIN",
        performedBy: adminEmail,
        details: "Cloud Firestore database schema verified according to db_schema.json specification.",
        ipAddress: "127.0.0.1",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "auditLogs", initialLog.id), initialLog));
    }
    const gameResultsSnap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "gameResults")));
    if (gameResultsSnap.empty) {
      console.log("\u{1F504} Seeding initial gameResults and xpHistory into Cloud Firestore...");
      const sampleResults = [
        {
          id: "res_seed_101",
          userId: "usr_st_1786962058384_uunvj",
          userGamerTag: "nidthish",
          userFullName: "nidthish",
          game: "Chess",
          result: "WIN",
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 864e5).toISOString()
        },
        {
          id: "res_seed_102",
          userId: "usr_st_1786962058384_uunvj",
          userGamerTag: "nidthish",
          userFullName: "nidthish",
          game: "Free Fire / BGMI",
          result: "WIN",
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 432e5).toISOString()
        },
        {
          id: "res_seed_103",
          userId: "usr_st_1787058329051_g0rwb",
          userGamerTag: "barath789",
          userFullName: "Barath",
          game: "Chess",
          result: "WIN",
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 216e5).toISOString()
        },
        {
          id: "res_seed_104",
          userId: "usr_st_1787120282490_av5lu",
          userGamerTag: "premii13",
          userFullName: "premii",
          game: "UNO",
          result: "WIN",
          xpAwarded: 50,
          isVoided: false,
          recordedByAdmin: adminEmail,
          createdAt: new Date(Date.now() - 108e5).toISOString()
        }
      ];
      for (const resDoc of sampleResults) {
        const xpDoc = {
          id: "xp_" + resDoc.id,
          userId: resDoc.userId,
          userGamerTag: resDoc.userGamerTag,
          game: resDoc.game,
          result: resDoc.result,
          amount: resDoc.xpAwarded,
          performedBy: adminEmail,
          createdAt: resDoc.createdAt
        };
        await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "gameResults", resDoc.id), resDoc));
        await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "xpHistory", xpDoc.id), xpDoc));
      }
      console.log("\u2705 Default Cloud Firestore match results & XP transaction history successfully written.");
    }
  } catch (err) {
    console.error("Error ensuring schema in Cloud Firestore:", err);
  }
}
var schemaInitializedPromise = null;
function ensureSchemaInitialized() {
  if (!schemaInitializedPromise) {
    schemaInitializedPromise = ensureSchemaAndInitialData().catch((err) => {
      console.error("Failed to initialize schema:", err);
      schemaInitializedPromise = null;
    });
  }
  return schemaInitializedPromise;
}
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "10mb" }));
app.use(async (req, res, next) => {
  try {
    await ensureSchemaInitialized();
  } catch (e) {
  }
  next();
});
app.get("/api/health", async (req, res) => {
  res.json({
    status: "ok",
    database: "Cloud Firestore",
    projectId: firebaseConfig.projectId,
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, username, department, teamName, password, confirmPassword } = req.body;
    if (!name || !username || !department || !teamName || !password || !confirmPassword) {
      return res.status(400).json({
        error: "All fields (Name, Username, Department, Team Name, Password, and Confirm Password) are required."
      });
    }
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedDept = department.trim().toUpperCase();
    const trimmedTeam = teamName.trim();
    const ALLOWED_DEPARTMENTS = ["CSE", "AIDS", "AIML", "IT", "CSBS", "ESPORTS COMMISSION"];
    if (!ALLOWED_DEPARTMENTS.includes(trimmedDept)) {
      return res.status(400).json({
        error: "Invalid department. Allowed departments are CSE, AIDS, AIML, IT, CSBS, Esports Commission."
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match. Please verify your Password and Confirm Password."
      });
    }
    const existingUserByTag = await getUserByGamerTag(trimmedUsername);
    if (existingUserByTag) {
      return res.status(400).json({
        error: "Username is already taken! Try another one. \u{1F440}"
      });
    }
    const allStudents = await getAllStudentsFromFirestore();
    const duplicateAccount = allStudents.find(
      (u) => u.fullName.toLowerCase() === trimmedName.toLowerCase() && (u.teamName?.toLowerCase() === trimmedTeam.toLowerCase() || u.studentId?.toLowerCase() === trimmedTeam.toLowerCase())
    );
    if (duplicateAccount) {
      return res.status(400).json({
        error: "Oops! You already exist! Try Logging In! \u{1F60E}"
      });
    }
    const passwordHash = hashPassword(password);
    const userId = "usr_st_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const email = `${trimmedUsername.toLowerCase()}@gamingarena.edu`;
    const token = "token_st_" + Date.now() + "_" + userId;
    const newUser = {
      id: userId,
      email,
      passwordHash,
      fullName: trimmedName,
      gamerTag: trimmedUsername,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`,
      department: trimmedDept,
      teamName: trimmedTeam,
      studentId: trimmedTeam,
      role: "student",
      xp: 0,
      rankTier: "Spark",
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      joinedAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "users", newUser.id), newUser);
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "sessions", token), {
      token,
      userId: newUser.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.status(201).json({
      success: true,
      message: "Account registered successfully in Cloud Firestore!",
      token,
      user: stripPasswordHash(newUser)
    });
  } catch (err) {
    console.error("Registration error in Cloud Firestore:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const queryStr = username.trim();
    let user = await getUserByGamerTag(queryStr);
    if (!user) {
      user = await getUserByEmail(queryStr);
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const token = "token_st_" + Date.now() + "_" + user.id;
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "sessions", token), {
      token,
      userId: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ token, user: stripPasswordHash(user) });
  } catch (err) {
    console.error("Login error in Cloud Firestore:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});
app.post("/api/auth/student-google", async (req, res) => {
  try {
    const { email, fullName, avatar, googleId, department, studentId, gamerTag } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Google account email is required" });
    }
    let user = await getUserByEmail(email);
    if (!user) {
      const username = gamerTag || email.split("@")[0] || "Player";
      user = {
        id: "usr_st_" + Date.now(),
        googleId: googleId || "g_" + Date.now(),
        email,
        fullName: fullName || username,
        gamerTag: username,
        avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        department: department || "CSE",
        teamName: studentId || "Team Apex",
        studentId: studentId || "ST-" + Math.floor(1e3 + Math.random() * 9e3),
        role: "student",
        xp: 0,
        rankTier: "Spark",
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        joinedAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "users", user.id), user);
    } else {
      const updates = {};
      if (fullName) updates.fullName = fullName;
      if (avatar) updates.avatar = avatar;
      if (googleId) updates.googleId = googleId;
      if (Object.keys(updates).length > 0) {
        await (0, import_firestore.updateDoc)((0, import_firestore.doc)(firestoreDb, "users", user.id), updates);
        user = { ...user, ...updates };
      }
    }
    const token = "token_st_" + Date.now() + "_" + user.id;
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "sessions", token), {
      token,
      userId: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ token, user: stripPasswordHash(user) });
  } catch (err) {
    console.error("Google sign-in error:", err);
    res.status(500).json({ error: "Google authentication failed." });
  }
});
app.post(["/api/auth/admin-login", "/api/admin/admin-login"], async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }
    const adminUser = await getUserByEmail(email);
    if (!adminUser || adminUser.role !== "ADMIN" && adminUser.role !== "admin") {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }
    const isValid = verifyPassword(password, adminUser.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }
    const token = "token_adm_" + Date.now() + "_" + Math.random().toString(36).substring(2);
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "sessions", token), {
      token,
      userId: adminUser.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await logAudit("ADMIN_LOGIN", adminUser.email, "Admin signed in successfully", req);
    res.json({ token, user: { ...stripPasswordHash(adminUser), role: "ADMIN" } });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});
app.post("/api/admin/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await getUserByEmail(email || "");
    if (!admin || admin.role !== "ADMIN" && admin.role !== "admin") {
      return res.status(404).json({ error: "No admin account found with that email address" });
    }
    const resetToken = "reset_" + Date.now() + "_" + Math.floor(Math.random() * 1e4);
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "adminResetTokens", resetToken), {
      email: admin.email,
      expiresAt: Date.now() + 36e5
    });
    await logAudit("PASSWORD_RESET", admin.email, `Password reset token requested for ${admin.email}`, req);
    res.json({ success: true, message: "Password reset code generated.", resetToken });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
});
app.post("/api/admin/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required" });
    }
    const tokenDocRef = (0, import_firestore.doc)(firestoreDb, "adminResetTokens", resetToken);
    const tokenSnap = await (0, import_firestore.getDoc)(tokenDocRef);
    if (!tokenSnap.exists()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    const tokenData = tokenSnap.data();
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      await (0, import_firestore.deleteDoc)(tokenDocRef);
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    const admin = await getUserByEmail(tokenData.email);
    if (admin) {
      await (0, import_firestore.updateDoc)((0, import_firestore.doc)(firestoreDb, "users", admin.id), {
        passwordHash: hashPassword(newPassword)
      });
    }
    await (0, import_firestore.deleteDoc)(tokenDocRef);
    await logAudit("PASSWORD_RESET", tokenData.email, `Password updated for admin ${tokenData.email}`, req);
    res.json({ success: true, message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace("Bearer ", "").trim() : "";
  if (!token || token === "null" || token === "undefined") {
    return res.status(200).json({ user: null });
  }
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(200).json({ user: null });
    res.json({ user: stripPasswordHash(user) });
  } catch (err) {
    const isOffline = err?.code === "unavailable" || String(err?.message).includes("client is offline");
    if (isOffline) {
      return res.status(503).json({ error: "Database temporarily offline", code: "unavailable" });
    }
    res.status(500).json({ error: "Failed to fetch user session" });
  }
});
app.post("/api/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(firestoreDb, "sessions", token));
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});
app.get("/api/leaderboard", async (req, res) => {
  try {
    const { search } = req.query;
    let students = await getAllStudentsFromFirestore();
    if (search) {
      const queryStr = search.toLowerCase();
      students = students.filter(
        (u) => u.gamerTag.toLowerCase().includes(queryStr) || u.fullName.toLowerCase().includes(queryStr) || u.department.toLowerCase().includes(queryStr) || u.studentId.toLowerCase().includes(queryStr)
      );
    }
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
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Error fetching live leaderboard from Firestore:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});
app.get("/api/users", async (req, res) => {
  try {
    const students = await getAllStudentsFromFirestore();
    res.json({ users: students.map(stripPasswordHash) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch players" });
  }
});
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Player profile not found" });
    const resultsSnap = await (0, import_firestore.getDocs)(
      (0, import_firestore.query)((0, import_firestore.collection)(firestoreDb, "gameResults"), (0, import_firestore.where)("userId", "==", user.id))
    );
    const userResults = [];
    resultsSnap.forEach((d) => {
      const r = d.data();
      if (!r.isVoided) {
        userResults.push(r);
      }
    });
    userResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const xpSnap = await (0, import_firestore.getDocs)(
      (0, import_firestore.query)((0, import_firestore.collection)(firestoreDb, "xpHistory"), (0, import_firestore.where)("userId", "==", user.id))
    );
    const userXpHistory = [];
    xpSnap.forEach((d) => {
      userXpHistory.push(d.data());
    });
    userXpHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({
      user: stripPasswordHash(user),
      gameResults: userResults,
      xpHistory: userXpHistory
    });
  } catch (err) {
    console.error("Error fetching player profile from Firestore:", err);
    res.status(500).json({ error: "Failed to fetch player details" });
  }
});
app.post("/api/admin/update-points", async (req, res) => {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({ error: "403 / Access Denied: Admin authorization required" });
    }
    const { userId, game, result, moviesWon } = req.body;
    if (!userId || !game || !result) {
      return res.status(400).json({ error: "Missing required parameters: userId, game, result" });
    }
    const student = await getUserById(userId);
    if (!student) {
      return res.status(404).json({ error: "Selected student participant not found" });
    }
    const xpAwarded = calculateXpForGame(game, result, moviesWon);
    const isWin = result === "WIN" || result === "CORRECT WITHIN TIME" || game === "Dumb Charades" && (moviesWon || 0) > 0;
    const newXp = Math.max(0, (student.xp || 0) + xpAwarded);
    const newRankTier = calculateRankTier(newXp);
    const newGamesPlayed = (student.gamesPlayed || 0) + 1;
    const newWins = isWin ? (student.wins || 0) + 1 : student.wins || 0;
    const newLosses = !isWin ? (student.losses || 0) + 1 : student.losses || 0;
    const updatedStudent = {
      ...student,
      xp: newXp,
      rankTier: newRankTier,
      gamesPlayed: newGamesPlayed,
      wins: newWins,
      losses: newLosses
    };
    const resultId = "res_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const xpId = "xp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const newResult = {
      id: resultId,
      userId: student.id,
      userGamerTag: student.gamerTag,
      userFullName: student.fullName,
      game,
      result,
      xpAwarded,
      isVoided: false,
      recordedByAdmin: admin.email,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (game === "Dumb Charades") {
      newResult.moviesWon = Math.max(0, parseInt(String(moviesWon || 0), 10) || 0);
    }
    const newXpEntry = {
      id: xpId,
      userId: student.id,
      userGamerTag: student.gamerTag,
      game,
      result: game === "Dumb Charades" ? `WIN (${newResult.moviesWon || 0} Movies)` : result,
      amount: xpAwarded,
      performedBy: admin.email,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "users", student.id), updatedStudent, { merge: true }));
    await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "gameResults", newResult.id), newResult));
    await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "xpHistory", newXpEntry.id), newXpEntry));
    await logAudit(
      "XP_UPDATE",
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
    console.error("Error recording points in Cloud Firestore:", err);
    res.status(500).json({ error: "Failed to record event match result" });
  }
});
app.get("/api/admin/game-results", async (req, res) => {
  try {
    let snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "gameResults")));
    if (snap.empty) {
      await ensureSchemaAndInitialData();
      snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "gameResults")));
    }
    const results = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data) {
        results.push({
          id: d.id,
          ...data
        });
      }
    });
    results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ gameResults: results });
  } catch (err) {
    console.error("Error fetching game results:", err);
    res.status(500).json({ error: "Failed to fetch game results" });
  }
});
app.post("/api/admin/void-result", async (req, res) => {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({ error: "403 / Access Denied: Admin authorization required" });
    }
    const { resultId, voidReason } = req.body;
    if (!resultId || !voidReason) {
      return res.status(400).json({ error: "resultId and voidReason are required" });
    }
    const resultDocRef = (0, import_firestore.doc)(firestoreDb, "gameResults", resultId);
    const resultSnap = await withFirestoreRetry(() => (0, import_firestore.getDoc)(resultDocRef));
    if (!resultSnap.exists()) {
      return res.status(404).json({ error: "Game result record not found" });
    }
    const result = resultSnap.data();
    if (result.isVoided) {
      return res.status(400).json({ error: "This game result has already been voided" });
    }
    const student = await getUserById(result.userId);
    let updatedStudent = void 0;
    if (student) {
      const isWin = result.result === "WIN" || result.result === "CORRECT WITHIN TIME" || result.game === "Dumb Charades" && (result.moviesWon || 0) > 0;
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
      await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "users", student.id), updatedStudent, { merge: true }));
    }
    await withFirestoreRetry(
      () => (0, import_firestore.updateDoc)(resultDocRef, {
        isVoided: true,
        voidReason
      })
    );
    const voidXpEntry = {
      id: "xp_void_" + Date.now(),
      userId: result.userId,
      userGamerTag: result.userGamerTag,
      game: result.game,
      result: `VOIDED: ${voidReason}`,
      amount: -result.xpAwarded,
      performedBy: admin.email,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await withFirestoreRetry(() => (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "xpHistory", voidXpEntry.id), voidXpEntry));
    await logAudit(
      "RESULT_VOID",
      admin.email,
      `Voided game result ${resultId} for ${result.userGamerTag}. Reason: ${voidReason}`,
      req
    );
    res.json({
      success: true,
      result: { ...result, isVoided: true, voidReason },
      user: updatedStudent ? stripPasswordHash(updatedStudent) : void 0
    });
  } catch (err) {
    console.error("Error voiding result in Cloud Firestore:", err);
    res.status(500).json({ error: "Failed to void result" });
  }
});
app.get(["/api/xp/history", "/api/admin/xp-history"], async (req, res) => {
  try {
    let snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "xpHistory")));
    if (snap.empty) {
      await ensureSchemaAndInitialData();
      snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "xpHistory")));
    }
    const history = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data) {
        history.push({
          id: d.id,
          ...data
        });
      }
    });
    history.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ xpHistory: history });
  } catch (err) {
    console.error("Error fetching XP history:", err);
    res.status(500).json({ error: "Failed to fetch XP history" });
  }
});
app.get("/api/admin/audit-logs", async (req, res) => {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({ error: "403 / Access Denied: Admin authorization required" });
    }
    const snap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "auditLogs")));
    const logs = [];
    snap.forEach((d) => logs.push(d.data()));
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ auditLogs: logs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});
app.get("/api/admin/analytics", async (req, res) => {
  try {
    const students = await getAllStudentsFromFirestore();
    const resultsSnap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "gameResults")));
    const validResults = [];
    resultsSnap.forEach((d) => {
      const r = d.data();
      if (!r.isVoided) validResults.push(r);
    });
    const xpSnap = await withFirestoreRetry(() => (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "xpHistory")));
    const xpHistory = [];
    xpSnap.forEach((d) => xpHistory.push(d.data()));
    xpHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const totalParticipants = students.length;
    const totalGamesPlayed = validResults.length;
    const resultsXpSum = validResults.reduce((acc, r) => acc + (r.xpAwarded || 0), 0);
    const studentsXpSum = students.reduce((acc, s) => acc + (s.xp || 0), 0);
    const totalXpAwarded = Math.max(resultsXpSum, studentsXpSum);
    const gameCounts = {};
    validResults.forEach((r) => {
      gameCounts[r.game] = (gameCounts[r.game] || 0) + 1;
    });
    let mostPlayedGame = "None";
    let maxCount = 0;
    Object.entries(gameCounts).forEach(([game, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostPlayedGame = game;
      }
    });
    const sortedStudents = [...students].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const currentLeader = sortedStudents.length > 0 ? sortedStudents[0].fullName + " (" + sortedStudents[0].gamerTag + ")" : "None";
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
    console.error("Analytics error in Cloud Firestore:", err);
    res.status(500).json({ error: "Failed to calculate analytics" });
  }
});
var server_default = app;
var isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER || process.env.VERCEL_ENV);
var isDirectRun = Boolean(process.argv[1]?.endsWith("server.ts") || process.env.START_SERVER === "true");
if (!isVercel && isDirectRun) {
  const startLocalServer = async () => {
    await ensureSchemaAndInitialData();
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = import_path.default.join(process.cwd(), "dist");
      app.use(import_express.default.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(import_path.default.join(distPath, "index.html"));
      });
    }
    app.listen(PORT, () => {
      console.log(`\u{1F3AE} Gaming Arena College Leaderboard Server running on http://localhost:${PORT}`);
    });
  };
  startLocalServer().catch((err) => {
    console.error("Failed to start local server:", err);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  calculateXpForGame,
  hashPassword,
  verifyPassword
});
//# sourceMappingURL=server.cjs.map
