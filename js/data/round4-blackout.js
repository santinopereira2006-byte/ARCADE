/**
 * ARCADE - Round 4: BLACKOUT CODE
 * First-Year Engineering Tournament Memory Speed-Coding Game
 * 
 * Rules:
 * - Core programming logic in JavaScript tailored for 1st-year students
 * - 5 Rounds of progressive difficulty:
 *   - Round 1: Open Code (100 PTS) - Variables & Addition (Never disappears)
 *   - Round 2: 12-Second Blackout (150 PTS) - Even/Odd Modulo check
 *   - Round 3: 10-Second Blackout (200 PTS) - Max of two numbers (if-else)
 *   - Round 4: 4-Second Blackout (250 PTS) - Sum of 1 to N (for loop)
 *   - Round 5: Final Memory Sprint (300 PTS) - Factorial of N (10s Memorize -> 20s Blind Sprint)
 * Total Score: 1000 Points
 * Global Timer: 8 Minutes (480s)
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
    description: "Look at the code while typing. Type the variable declarations and sum to familiarize yourself with the editor.",
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
    difficulty: "EASY",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 5,     // Reappears for 5 seconds
    blackoutSeconds: 12,   // Disappears for 12 seconds
    reproduceSeconds: null,
    maxPoints: 150,
    description: "The code disappears for 12 seconds, then briefly reappears. Check if a number is even using modulo logic.",
    targetCode: `function isEven(num) {
  return num % 2 === 0;
}`
  },
  {
    level: 3,
    roundName: "ROUND 3 — 10 SECOND BLACKOUT",
    title: "ROUND 3: 10 SECOND BLACKOUT",
    subtitle: "Disappears for 10 seconds, then reappears",
    difficulty: "EASY → MEDIUM",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 5,     // Reappears for 5 seconds
    blackoutSeconds: 10,   // Disappears for 10 seconds
    reproduceSeconds: null,
    maxPoints: 200,
    description: "The code disappears for 10 seconds, then briefly reappears. Find the larger of two numbers using an if-else condition.",
    targetCode: `function getMax(a, b) {
  if (a > b) {
    return a;
  }
  return b;
}`
  },
  {
    level: 4,
    roundName: "ROUND 4 — 4 SECOND BLACKOUT",
    title: "ROUND 4: 4 SECOND BLACKOUT",
    subtitle: "Disappears for 4 seconds, then reappears",
    difficulty: "MEDIUM",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 4,     // Reappears for 4 seconds
    blackoutSeconds: 4,    // Disappears for 4 seconds
    reproduceSeconds: null,
    maxPoints: 250,
    description: "Rapid strobe rhythm! The code disappears for 4 seconds, then reappears. Calculate the sum from 1 to N using a loop.",
    targetCode: `function sumToN(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) {
    total += i;
  }
  return total;
}`
  },
  {
    level: 5,
    roundName: "ROUND 5 — FINAL MEMORY CHALLENGE",
    title: "ROUND 5: FINAL MEMORY CHALLENGE",
    subtitle: "Memorize for 10s -> Write for 20s (Auto-submit on expiry)",
    difficulty: "MEDIUM",
    languageName: "JavaScript",
    languageIcon: "⚡",
    visibleSeconds: 10,    // 10s memorization phase
    blackoutSeconds: 20,   // 20s blind reproduction sprint
    reproduceSeconds: 20,  // Auto-submit after 20s
    maxPoints: 300,
    description: "The ultimate memory sprint! Memorize the factorial function for 10 seconds, then reproduce it from memory in 20 seconds.",
    targetCode: `function factorial(n) {
  let fact = 1;
  for (let i = 1; i <= n; i++) {
    fact = fact * i;
  }
  return fact;
}`
  }
];
