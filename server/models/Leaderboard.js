import mongoose from 'mongoose';

const LeaderboardSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    default: "General Engineering"
  },
  score: {
    type: Number,
    required: true,
    default: 0,
    index: -1
  },
  maxScore: {
    type: Number,
    default: 650
  },
  tier: {
    type: String,
    default: "B"
  },
  tierTitle: {
    type: String,
    default: "Contender"
  },
  badgeClass: {
    type: String,
    default: "tier-b"
  },
  roundScores: {
    type: Map,
    of: Number,
    default: {}
  },
  accuracy: {
    type: Number,
    default: 0
  },
  date: {
    type: String,
    default: () => new Date().toISOString().split("T")[0]
  },
  time: {
    type: String,
    default: () => new Date().toTimeString().split(" ")[0].substring(0, 5)
  }
}, {
  timestamps: true
});

export const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);
