import mongoose from 'mongoose';

const ProgressSchema = new mongoose.Schema({
  teamId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  totalScore: {
    type: Number,
    default: 0
  },
  roundScores: {
    type: Map,
    of: Number,
    default: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  },
  completedRounds: {
    type: [Number],
    default: []
  },
  activeTeam: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  stats: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  currentRound: {
    type: Number,
    default: 1
  },
  timestamp: {
    type: Number,
    default: () => Date.now()
  }
}, {
  timestamps: true
});

export const Progress = mongoose.model('Progress', ProgressSchema);
