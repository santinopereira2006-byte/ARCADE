/**
 * ARCADE - Round 4: BLACKOUT CODE
 * Professional Esports / College Tech-Event Memory Speed-Coding Game
 * 
 * Rules:
 * - Single designated coding language per round (JavaScript)
 * - 5 Rounds of increasing difficulty
 * - Global 8-Minute (480s) Timer shared across all rounds
 * - Round 1: Open Code (100 PTS) - Code remains visible throughout (Never disappears)
 * - Round 2: 12-Second Blackout (150 PTS) - Disappears for 12s, then reappears for 5s
 * - Round 3: 10-Second Blackout (200 PTS) - Disappears for 10s, then reappears for 4s
 * - Round 4: 4-Second Blackout (250 PTS) - Disappears for 4s, then reappears for 3s
 * - Round 5: Final Memory Challenge (300 PTS) - 10s Memorize -> 10s Blind Reproduction Sprint (Auto-submit)
 * Total Score: 1000 Points
 */

export const ROUND4_CONFIG = {
  gameTitle: "BLACKOUT CODE",
  totalRoundSeconds: 480, // 8 minutes global timer
  totalLevels: 5,
  maxPoints: 1000,
  scoreScale: [100, 150, 200, 250, 300]
};

export const BLACKOUT_LEVELS = [
  {
    level: 1,
    roundName: "ROUND 1 — OPEN CODE",
    title: "ROUND 1: OPEN CODE",
    subtitle: "Constant visibility throughout (Zero Blackout)",
    difficulty: "EASY",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: null, // Always visible
    blackoutSeconds: 0,
    reproduceSeconds: null,
    maxPoints: 100,
    description: "Look at the code while typing. Type the code accurately to introduce yourself to the mechanics.",
    targetCode: `let x = 10;
let y = 20;
let sum = x + y;
console.log(sum);`
  },
  {
    level: 2,
    roundName: "ROUND 2 — 12 SECOND BLACKOUT",
    title: "ROUND 2: 12 SECOND BLACKOUT",
    subtitle: "Disappears for 12 seconds, then reappears",
    difficulty: "EASY → MEDIUM",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 5,     // Reappears for 5 seconds
    blackoutSeconds: 12,   // Disappears for 12 seconds
    reproduceSeconds: null,
    maxPoints: 150,
    description: "The code disappears for 12 seconds, then briefly reappears. Memorize the snippet and keep typing through blackout!",
    targetCode: `function getEvens(arr) {
  return arr.filter(n => n % 2 === 0);
}`
  },
  {
    level: 3,
    roundName: "ROUND 3 — 10 SECOND BLACKOUT",
    title: "ROUND 3: 10 SECOND BLACKOUT",
    subtitle: "Disappears for 10 seconds, then reappears",
    difficulty: "MEDIUM",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 4,     // Reappears for 4 seconds
    blackoutSeconds: 10,   // Disappears for 10 seconds
    reproduceSeconds: null,
    maxPoints: 200,
    description: "The code disappears for 10 seconds, then briefly reappears. Type the string logic from memory.",
    targetCode: `function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}`
  },
  {
    level: 4,
    roundName: "ROUND 4 — 4 SECOND BLACKOUT",
    title: "ROUND 4: 4 SECOND BLACKOUT",
    subtitle: "Disappears for 4 seconds, then reappears",
    difficulty: "HARD",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 3,     // Reappears for 3 seconds
    blackoutSeconds: 4,    // Disappears for 4 seconds
    reproduceSeconds: null,
    maxPoints: 250,
    description: "Rapid strobe rhythm! The code disappears for 4 seconds, then reappears for 3 seconds. Type without breaking momentum.",
    targetCode: `function countFrequencies(items) {
  const map = {};
  for (const item of items) {
    map[item] = (map[item] || 0) + 1;
  }
  return map;
}`
  },
  {
    level: 5,
    roundName: "ROUND 5 — FINAL MEMORY CHALLENGE",
    title: "ROUND 5: FINAL MEMORY CHALLENGE",
    subtitle: "Memorize for 10s -> Write for 10s (Auto-submit on expiry)",
    difficulty: "VERY HARD",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 10,    // 10s memorization phase
    blackoutSeconds: 10,   // 10s blind reproduction sprint
    reproduceSeconds: 10,  // Auto-submit after 10s
    maxPoints: 300,
    description: "The ultimate memory & typing test! Memorize the code shown for 10 seconds, then reproduce from memory in 10 seconds.",
    targetCode: `async function processQueue(tasks, limit) {
  const results = [];
  while (tasks.length > 0 && results.length < limit) {
    const task = tasks.shift();
    results.push(await task.execute());
  }
  return results;
}`
  }
];
