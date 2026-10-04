import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  teamId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  accessCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  members: {
    type: String,
    default: ""
  },
  department: {
    type: String,
    default: "General Engineering"
  },
  registeredAt: {
    type: String,
    default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  },
  status: {
    type: String,
    enum: ["ready", "in-game", "in-progress", "completed"],
    default: "ready"
  },
  score: {
    type: Number,
    default: 0
  },
  tier: {
    type: String,
    default: "—"
  },
  roundScores: {
    type: Map,
    of: Number,
    default: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  }
}, {
  timestamps: true
});

export const Team = mongoose.model('Team', TeamSchema);
