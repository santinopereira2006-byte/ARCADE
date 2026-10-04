import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { Team } from './server/models/Team.js';
import { Leaderboard } from './server/models/Leaderboard.js';
import { Progress } from './server/models/Progress.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/arcade_tournament";
const ADMIN_PASSPHRASE = process.env.ADMIN_PASSPHRASE || "CSI2026";

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend assets from project root with proper MIME types
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.glb')) {
      res.setHeader('Content-Type', 'model/gltf-binary');
    } else if (filePath.endsWith('.gltf')) {
      res.setHeader('Content-Type', 'model/gltf+json');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'text/javascript');
    }
  }
}));

// Default leaderboard sample entries
const DEFAULT_LEADERBOARD = [
  {
    id: "entry-01",
    name: "Santino Pereira",
    department: "AI & Data Science (SY)",
    score: 625,
    maxScore: 650,
    tier: "S",
    tierTitle: "Supreme Arcade Architect",
    badgeClass: "tier-s",
    roundScores: { "1": 100, "2": 100, "3": 145, "4": 190, "5": 90 },
    accuracy: 96,
    date: "2026-09-24",
    time: "18:45"
  },
  {
    id: "entry-02",
    name: "Darpan & Harikrishna",
    department: "Computer Engineering (SY)",
    score: 575,
    maxScore: 650,
    tier: "A",
    tierTitle: "Elite Cyber-Operative",
    badgeClass: "tier-a",
    roundScores: { "1": 95, "2": 90, "3": 135, "4": 170, "5": 85 },
    accuracy: 91,
    date: "2026-09-24",
    time: "19:15"
  },
  {
    id: "entry-03",
    name: "Team CipherSquad",
    department: "Information Technology",
    score: 540,
    maxScore: 650,
    tier: "A",
    tierTitle: "Elite Cyber-Operative",
    badgeClass: "tier-a",
    roundScores: { "1": 90, "2": 85, "3": 125, "4": 160, "5": 80 },
    accuracy: 87,
    date: "2026-09-24",
    time: "19:50"
  },
  {
    id: "entry-04",
    name: "NeuralKnights",
    department: "AI & Machine Learning",
    score: 490,
    maxScore: 650,
    tier: "B",
    tierTitle: "Tactical Arcade Specialist",
    badgeClass: "tier-b",
    roundScores: { "1": 85, "2": 80, "3": 110, "4": 140, "5": 75 },
    accuracy: 82,
    date: "2026-09-24",
    time: "20:10"
  },
  {
    id: "entry-05",
    name: "ByteBrawlers",
    department: "Electronics & Telecomm",
    score: 450,
    maxScore: 650,
    tier: "B",
    tierTitle: "Tactical Arcade Specialist",
    badgeClass: "tier-b",
    roundScores: { "1": 80, "2": 75, "3": 95, "4": 130, "5": 70 },
    accuracy: 78,
    date: "2026-09-24",
    time: "20:30"
  }
];

// Helper to seed initial leaderboard if collection is empty
async function seedDefaultLeaderboardIfEmpty() {
  try {
    const count = await Leaderboard.countDocuments();
    if (count === 0) {
      console.log("Seeding default leaderboard entries into MongoDB...");
      await Leaderboard.insertMany(DEFAULT_LEADERBOARD);
    }
  } catch (err) {
    console.warn("Could not check/seed leaderboard:", err.message);
  }
}

// MongoDB Connection State
let isDbConnected = false;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
}).then(() => {
  isDbConnected = true;
  console.log("==================================================");
  console.log("  CONNECTED TO MONGODB SUCCESSFULLY");
  console.log(`  Target: ${MONGODB_URI.includes('@') ? 'MongoDB Atlas Cloud' : MONGODB_URI}`);
  console.log("==================================================");
  seedDefaultLeaderboardIfEmpty();
}).catch((err) => {
  isDbConnected = false;
  console.warn("==================================================");
  console.warn("  WARNING: Could not connect to MongoDB!");
  console.warn("  Error:", err.message);
  console.warn("  The app is running, but database features will fall back to local storage.");
  console.warn("  To use MongoDB, make sure MongoDB is running or set your Atlas URI in .env");
  console.warn("==================================================");
});

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.warn("MongoDB disconnected.");
});

mongoose.connection.on('connected', () => {
  isDbConnected = true;
  console.log("MongoDB re-connected.");
});

// SSE (Server-Sent Events) for real-time live sync across devices
const sseClients = new Set();

function broadcastEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ==========================================
// API ROUTES
// ==========================================

// 1. Health & DB Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    dbConnected: isDbConnected && mongoose.connection.readyState === 1,
    dbState: mongoose.connection.readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    activeConnections: sseClients.size,
    timestamp: Date.now()
  });
});

// 2. Authentication
app.post('/api/auth/admin-login', (req, res) => {
  const { passphrase } = req.body || {};
  if (String(passphrase || "").trim().toUpperCase() === ADMIN_PASSPHRASE.toUpperCase()) {
    return res.json({
      success: true,
      role: 'admin',
      loginTime: new Date().toISOString()
    });
  }
  return res.status(401).json({ success: false, error: 'Invalid admin passphrase.' });
});

app.post('/api/auth/participant-login', async (req, res) => {
  const { teamName, accessCode } = req.body || {};
  const normalizedName = String(teamName || "").trim();
  const normalizedCode = String(accessCode || "").trim().toUpperCase();

  if (!normalizedName || !normalizedCode) {
    return res.status(400).json({ success: false, error: 'Team name and access code are required.' });
  }

  if (!isDbConnected) {
    return res.status(503).json({ success: false, error: 'Database offline. Use offline mode.' });
  }

  try {
    const team = await Team.findOne({
      name: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      accessCode: normalizedCode
    });

    if (!team) {
      return res.status(401).json({ success: false, error: 'Team name or access code not found.' });
    }

    res.json({
      success: true,
      role: 'participant',
      team: {
        id: team.teamId,
        name: team.name,
        members: team.members,
        department: team.department,
        status: team.status,
        score: team.score,
        tier: team.tier,
        accessCode: team.accessCode
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Teams / Roster
app.get('/api/teams', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const teams = await Team.find().sort({ createdAt: 1 });
    const formatted = teams.map(t => ({
      id: t.teamId,
      name: t.name,
      members: t.members,
      department: t.department,
      accessCode: t.accessCode,
      registeredAt: t.registeredAt,
      status: t.status,
      score: t.score,
      tier: t.tier,
      roundScores: t.roundScores instanceof Map ? Object.fromEntries(t.roundScores) : (t.roundScores || {})
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const { name, members, department, accessCode } = req.body || {};
    const teamId = req.body.id || `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let code = (accessCode || "").trim().toUpperCase();
    if (!code) {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let isUnique = false;
      while (!isUnique) {
        code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
        const existing = await Team.findOne({ accessCode: code });
        if (!existing) isUnique = true;
      }
    }

    const team = new Team({
      teamId,
      name: (name || "Challenger").trim(),
      members: (members || "").trim(),
      department: (department || "General Engineering").trim(),
      accessCode: code,
      registeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'ready',
      score: 0,
      tier: '—',
      roundScores: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
    });

    await team.save();

    const formatted = {
      id: team.teamId,
      name: team.name,
      members: team.members,
      department: team.department,
      accessCode: team.accessCode,
      registeredAt: team.registeredAt,
      status: team.status,
      score: team.score,
      tier: team.tier,
      roundScores: Object.fromEntries(team.roundScores || new Map())
    };

    broadcastEvent('teams_updated', { action: 'create', team: formatted });
    res.status(201).json(formatted);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Team name or access code already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/teams/:id', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const { status, score, tier, roundScores } = req.body || {};
    const update = {};
    if (status !== undefined) update.status = status;
    if (score !== undefined) update.score = score;
    if (tier !== undefined) update.tier = tier;
    if (roundScores !== undefined) update.roundScores = roundScores;

    const updated = await Team.findOneAndUpdate(
      { teamId: req.params.id },
      { $set: update },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Team not found.' });

    const formatted = {
      id: updated.teamId,
      name: updated.name,
      members: updated.members,
      department: updated.department,
      accessCode: updated.accessCode,
      registeredAt: updated.registeredAt,
      status: updated.status,
      score: updated.score,
      tier: updated.tier,
      roundScores: updated.roundScores instanceof Map ? Object.fromEntries(updated.roundScores) : (updated.roundScores || {})
    };

    broadcastEvent('teams_updated', { action: 'update', team: formatted });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    await Team.deleteOne({ teamId: req.params.id });
    broadcastEvent('teams_updated', { action: 'delete', teamId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teams', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    await Team.deleteMany({});
    broadcastEvent('teams_updated', { action: 'clear' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const entries = await Leaderboard.find().sort({ score: -1 });
    const formatted = entries.map(e => ({
      id: e.id,
      name: e.name,
      department: e.department,
      score: e.score,
      maxScore: e.maxScore,
      tier: e.tier,
      tierTitle: e.tierTitle,
      badgeClass: e.badgeClass,
      roundScores: e.roundScores instanceof Map ? Object.fromEntries(e.roundScores) : (e.roundScores || {}),
      accuracy: e.accuracy,
      date: e.date,
      time: e.time
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const data = req.body || {};
    const name = String(data.name || "Anonymous Challenger").trim();
    const score = parseInt(data.score, 10) || 0;

    const existing = await Leaderboard.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });

    let entry;
    if (existing) {
      if (score >= existing.score) {
        existing.score = score;
        existing.department = data.department || existing.department;
        existing.maxScore = data.maxScore || existing.maxScore;
        existing.tier = data.tier || existing.tier;
        existing.tierTitle = data.tierTitle || existing.tierTitle;
        existing.badgeClass = data.badgeClass || existing.badgeClass;
        existing.roundScores = data.roundScores || existing.roundScores;
        existing.accuracy = data.accuracy || existing.accuracy;
        existing.date = new Date().toISOString().split("T")[0];
        existing.time = new Date().toTimeString().split(" ")[0].substring(0, 5);
        await existing.save();
      }
      entry = existing;
    } else {
      entry = new Leaderboard({
        id: data.id || `entry-${Date.now()}`,
        name,
        department: data.department || "General Engineering",
        score,
        maxScore: data.maxScore || 650,
        tier: data.tier || "B",
        tierTitle: data.tierTitle || "Contender",
        badgeClass: data.badgeClass || "tier-b",
        roundScores: data.roundScores || {},
        accuracy: data.accuracy || 0,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().split(" ")[0].substring(0, 5)
      });
      await entry.save();
    }

    const formatted = {
      id: entry.id,
      name: entry.name,
      department: entry.department,
      score: entry.score,
      maxScore: entry.maxScore,
      tier: entry.tier,
      tierTitle: entry.tierTitle,
      badgeClass: entry.badgeClass,
      roundScores: entry.roundScores instanceof Map ? Object.fromEntries(entry.roundScores) : (entry.roundScores || {}),
      accuracy: entry.accuracy,
      date: entry.date,
      time: entry.time
    };

    broadcastEvent('leaderboard_updated', { action: 'update', entry: formatted });
    res.status(201).json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leaderboard/reset', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    await Leaderboard.deleteMany({});
    await Leaderboard.insertMany(DEFAULT_LEADERBOARD);
    broadcastEvent('leaderboard_updated', { action: 'reset' });
    res.json({ success: true, count: DEFAULT_LEADERBOARD.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Game Progress API
app.get('/api/progress/:teamId', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const progress = await Progress.findOne({ teamId: req.params.teamId });
    if (!progress) return res.status(404).json({ error: 'No progress found' });
    res.json({
      teamId: progress.teamId,
      totalScore: progress.totalScore,
      roundScores: progress.roundScores instanceof Map ? Object.fromEntries(progress.roundScores) : (progress.roundScores || {}),
      completedRounds: progress.completedRounds,
      activeTeam: progress.activeTeam,
      stats: progress.stats,
      currentRound: progress.currentRound,
      timestamp: progress.timestamp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/progress/:teamId', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    const data = req.body || {};
    const updated = await Progress.findOneAndUpdate(
      { teamId: req.params.teamId },
      {
        $set: {
          totalScore: data.totalScore || 0,
          roundScores: data.roundScores || {},
          completedRounds: data.completedRounds || [],
          activeTeam: data.activeTeam || {},
          stats: data.stats || {},
          currentRound: data.currentRound || 1,
          timestamp: Date.now()
        }
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, progress: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/progress/:teamId', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database offline' });
  try {
    await Progress.deleteOne({ teamId: req.params.teamId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback: any other request goes to index.html
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`ARCADE server running at http://localhost:${PORT}`);
  console.log(`Press Ctrl + C to stop`);
});
