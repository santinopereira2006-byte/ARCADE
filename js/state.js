/**
 * ARCADE - Central State Store
 * Manages tournament progression, scores across all 4 rounds, stats, and tier rankings
 */

export class ArcadeState {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentScreen = "home"; // "home" | "how-to-play" | "game" | "between-round" | "results" | "tie-breaker"
    this.presentationMode = false;
    this.currentRound = 1; // 1: Scale Wars, 2: CTRL+ALT+GUESS, 3: Tech Meme Battle, 4: Blackout Build, 5: Retro Blast
    this.currentQuestionIndex = 0;
    this.totalScore = 0;
    this.highestPossibleScore = 650;
    this.isAnswerLocked = false;

    this.roundScores = {
      1: 0, // Scale Wars (max 100)
      2: 0, // CTRL+ALT+GUESS (max 100)
      3: 0, // Tech Meme Battle (max 150: 75 trivia + 75 creation)
      4: 0, // Blackout Build (max 200: 50 + 70 + 80)
      5: 0  // Retro Blast (max 100)
    };

    this.stats = {
      totalCorrect: 0,
      totalIncorrect: 0,
      totalPassed: 0,
      roundStats: {
        1: { correct: 0, incorrect: 0, passed: 0 },
        2: { correct: 0, incorrect: 0, passed: 0 },
        3: { correct: 0, incorrect: 0, passed: 0 },
        4: { correct: 0, incorrect: 0, passed: 0 },
        5: { correct: 0, incorrect: 0, passed: 0, hits: 0, misses: 0, accuracy: 100 }
      }
    };

    // Team / Participant Registration Info
    this.activeTeam = {
      id: null,
      name: "Challenger",
      members: "",
      department: "General Engineering",
      isGuest: false
    };

    // Round-specific state
    this.round2Stage = 1; // 1 (20 pts), 2 (15 pts), 3 (10 pts), 4 (5 pts)
    this.round2FiftyFiftyUsed = false;
    this.round2EliminatedOptions = [];
    this.round3Phase = "trivia"; // "trivia" or "creation"
    this.round3TriviaIndex = 0;
    this.round3CreationScore = 0;
    this.round3CreatedMeme = null;

    this.round4LevelIndex = 0; // 0 (Level 1), 1 (Level 2), 2 (Level 3)
    this.round4Phase = "visibility"; // "visibility" | "blackout" | "review" | "completed"
    this.round4CodeBuffer = "";

    this.round5Stats = {
      shotsFired: 0,
      targetsHit: 0,
      targetsMissed: 0,
      bombsHit: 0,
      accuracy: 100
    };
  }

  setTeam(teamData) {
    this.activeTeam = {
      id: teamData.id || "team-" + Date.now(),
      name: teamData.name || "Challenger",
      members: teamData.members || "",
      department: teamData.department || "General Engineering",
      isGuest: Boolean(teamData.isGuest)
    };
  }

  addPoints(points, round = this.currentRound) {
    const pts = Math.max(0, points);
    this.totalScore += pts;
    this.roundScores[round] = (this.roundScores[round] || 0) + pts;
  }

  recordResult(type, pointsAwarded = 0, round = this.currentRound) {
    if (type === "correct") {
      this.stats.totalCorrect++;
      if (this.stats.roundStats[round]) this.stats.roundStats[round].correct++;
      this.addPoints(pointsAwarded, round);
    } else if (type === "incorrect") {
      this.stats.totalIncorrect++;
      if (this.stats.roundStats[round]) this.stats.roundStats[round].incorrect++;
      if (pointsAwarded > 0) {
        this.addPoints(pointsAwarded, round);
      }
    } else if (type === "passed") {
      this.stats.totalPassed++;
      if (this.stats.roundStats[round]) this.stats.roundStats[round].passed++;
    }
  }

  getAccuracy() {
    const totalAttempted = this.stats.totalCorrect + this.stats.totalIncorrect;
    if (totalAttempted === 0) return 0;
    return Math.round((this.stats.totalCorrect / totalAttempted) * 100);
  }

  getPerformanceTier() {
    const score = this.totalScore;
    if (score >= 580) {
      return {
        tier: "S",
        title: "SUPREME ARCADE ARCHITECT",
        color: "#00f0ff",
        badgeClass: "tier-s",
        comment: "Flawless technical execution across all 5 disciplines. God-tier observation, recall, code precision, and target reflex under pressure."
      };
    } else if (score >= 500) {
      return {
        tier: "A",
        title: "ALPHA ESPORTS OPERATOR",
        color: "#10b981",
        badgeClass: "tier-a",
        comment: "Outstanding tournament performance. Exceptional speed on progressive reveals, steady hands in the blackout phase, and rapid blaster aim."
      };
    } else if (score >= 400) {
      return {
        tier: "B",
        title: "CYBER SPECIALIST",
        color: "#f59e0b",
        badgeClass: "tier-b",
        comment: "Strong showing with solid fundamentals in scale intuition, tech recognition, code syntax, and reflex accuracy."
      };
    } else if (score >= 300) {
      return {
        tier: "C",
        title: "ROOKIE RUNNER",
        color: "#8b5cf6",
        badgeClass: "tier-c",
        comment: "Respectable effort. Sharpen your memory typing, progressive visual recognition, and aim precision to conquer the arena."
      };
    } else {
      return {
        tier: "D",
        title: "RECRUIT CALIBRATION",
        color: "#ef4444",
        badgeClass: "tier-d",
        comment: "System overload. Revisit your technical manuals, calibrate your scale intuition and blaster aim, and re-enter the battle!"
      };
    }
  }
}

export const state = new ArcadeState();
