/**
 * ARCADE - Round 3: Tech Meme Battle Data
 * Phase A: Meme Identification (5 questions x 15 pts = 75 pts)
 * Phase B: Meme Creation Studio (Organizer Rubric: 25+25+25 = 75 pts)
 * Total points: 150
 */

export const ROUND3_MEME_TRIVIA = [
  {
    id: "r3-m1",
    round: 3,
    phase: "trivia",
    type: "choice",
    question: "COMPLETE THE CLASSIC DEVELOPER EXCUSE PUNCHLINE",
    setupText: "“It works on my machine...”",
    svgMeme: `
      <svg viewBox="0 0 320 200" class="meme-svg-preview">
        <rect width="320" height="200" fill="#1e293b" rx="12"/>
        <text x="160" y="55" font-family="'Impact', sans-serif" font-size="20" fill="#fff" text-anchor="middle" stroke="#000" stroke-width="1">IT WORKS ON MY MACHINE</text>
        <circle cx="160" cy="110" r="32" fill="#3b82f6"/>
        <path d="M 148 100 Q 160 125 172 100" stroke="#fff" stroke-width="4" fill="none"/>
        <text x="160" y="175" font-family="'Impact', sans-serif" font-size="18" fill="#ffdd44" text-anchor="middle">???</text>
      </svg>
    `,
    options: [
      "“Then explain why staging just crashed!”",
      "“Then we'll ship your machine to the customer!”",
      "“Then run the entire production cluster on your laptop!”",
      "“Then don't ever dare restart your computer!”"
    ],
    correctAnswer: "“Then we'll ship your machine to the customer!”",
    points: 15,
    timeLimit: 20,
    explanation: "The historic tech response to 'It works on my machine' is 'Then we will ship your machine to the client!', which humorously led to the invention of Docker!"
  },
  {
    id: "r3-m2",
    round: 3,
    phase: "trivia",
    type: "choice",
    question: "THE FINAL EXAM",
    setupText: "👨‍🏫 Prof: “Similar to class.” | 👨‍🎓 Student: “I wasn't in class.” | 👨‍🏫 Prof: “You sat front row.” — Student reply?",
    svgMeme: `
      <svg viewBox="0 0 320 200" class="meme-svg-preview">
        <rect width="320" height="200" fill="#0f172a" rx="12" stroke="#3b82f6" stroke-width="2"/>
        <!-- Professor Bubble 1 -->
        <rect x="15" y="16" width="290" height="34" rx="6" fill="#1e293b" stroke="#60a5fa" stroke-width="1.2"/>
        <text x="25" y="38" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="#93c5fd">👨‍🏫 Prof: “The question is similar to what we discussed.”</text>
        <!-- Student Bubble 1 -->
        <rect x="40" y="56" width="265" height="32" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
        <text x="50" y="77" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="#fde68a">👨‍🎓 Student: “Sir, I wasn't in that class.”</text>
        <!-- Professor Bubble 2 -->
        <rect x="15" y="94" width="290" height="34" rx="6" fill="#1e293b" stroke="#60a5fa" stroke-width="1.2"/>
        <text x="25" y="116" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="#93c5fd">👨‍🏫 Prof: “You were sitting in the front row.”</text>
        <!-- Student Punchline Bubble -->
        <rect x="40" y="136" width="265" height="46" rx="6" fill="#312e81" stroke="#ec4899" stroke-width="1.8"/>
        <text x="172" y="164" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="800" fill="#f472b6" text-anchor="middle">👨‍🎓 Student: “???”</text>
      </svg>
    `,
    options: [
      "👨‍🎓 Student: “My body was there, but my mind was sleeping.”",
      "👨‍🎓 Student: “That was just my hologram, Professor.”",
      "👨‍🎓 Student: “Physically, yes.”",
      "👨‍🎓 Student: “I was spiritually absent from that lecture.”"
    ],
    correctAnswer: "👨‍🎓 Student: “Physically, yes.”",
    points: 15,
    timeLimit: 20,
    explanation: "The legendary college lecture defense: Present in body, completely disconnected in spirit."
  },
  {
    id: "r3-m3",
    round: 3,
    phase: "trivia",
    type: "choice",
    question: "PROGRAMMER VS BUG",
    setupText: "🐛 Programmer: “I fixed one bug.” — What does the code respond?",
    svgMeme: `
      <svg viewBox="0 0 320 200" class="meme-svg-preview">
        <rect width="320" height="200" fill="#0f172a" rx="12" stroke="#22c55e" stroke-width="2"/>
        <!-- Programmer dialogue bubble -->
        <rect x="20" y="24" width="280" height="44" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="35" y="51" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="600" fill="#38bdf8">🐛 Programmer: “I fixed one bug.”</text>
        <!-- Bug swarm counter -->
        <circle cx="160" cy="112" r="28" fill="#ef4444" opacity="0.2"/>
        <text x="160" y="122" font-family="sans-serif" font-size="28" text-anchor="middle">🐛 × 17</text>
        <!-- Code response bubble -->
        <rect x="20" y="144" width="280" height="44" rx="8" fill="#1e293b" stroke="#f43f5e" stroke-width="1.5"/>
        <text x="160" y="171" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="700" fill="#f43f5e" text-anchor="middle">💻 Code: “???”</text>
      </svg>
    `,
    options: [
      "💻 Code: “Congratulations. Here are 17 new ones.”",
      "💻 Code: “Great job. Now 3 critical race conditions awoke.”",
      "💻 Code: “That bug was actually holding the entire app together.”",
      "💻 Code: “SyntaxError on line 1: Unexpected success.”"
    ],
    correctAnswer: "💻 Code: “Congratulations. Here are 17 new ones.”",
    points: 15,
    timeLimit: 20,
    explanation: "Fixing one bug only to spawn 17 brand-new regressions is the eternal law of software engineering (99 little bugs in the code... take one down, patch it around, 127 little bugs in the code)."
  },
  {
    id: "r3-m4",
    round: 3,
    phase: "trivia",
    type: "choice",
    question: "THE DEADLINE",
    setupText: "👨‍💻 1 week before deadline: “I'll start tomorrow.” — How does the developer act 2 hours before deadline?",
    svgMeme: `
      <svg viewBox="0 0 320 200" class="meme-svg-preview">
        <rect width="320" height="200" fill="#090d16" rx="12" stroke="#f59e0b" stroke-width="2"/>
        <!-- 1 week before -->
        <rect x="20" y="20" width="280" height="50" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
        <text x="32" y="42" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="#10b981">📅 1 WEEK BEFORE DEADLINE:</text>
        <text x="32" y="58" font-family="'Segoe UI', sans-serif" font-size="12" fill="#e2e8f0">👨‍💻 “I'll start tomorrow.”</text>
        <!-- Clock danger -->
        <circle cx="160" cy="100" r="18" fill="#ef4444" opacity="0.2"/>
        <text x="160" y="106" font-family="'Impact', sans-serif" font-size="16" fill="#f59e0b" text-anchor="middle">⏳ 2 HOURS LEFT</text>
        <!-- 2 hours before -->
        <rect x="20" y="130" width="280" height="50" rx="8" fill="#2d1515" stroke="#ef4444" stroke-width="2"/>
        <text x="32" y="152" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="800" fill="#ef4444">🚨 2 HOURS BEFORE DEADLINE:</text>
        <text x="32" y="170" font-family="'Impact', sans-serif" font-size="14" fill="#fbbf24" letter-spacing="1">👨‍💻 “???”</text>
      </svg>
    `,
    options: [
      "👨‍💻 2 hours before deadline: “Let me just rewrite this in a better framework.”",
      "👨‍💻 2 hours before deadline: “Git push origin main --force and pray.”",
      "👨‍💻 2 hours before deadline: “Coffee is no longer a beverage, it's blood.”",
      "👨‍💻 2 hours before deadline: “WE NEED TO LOCK IN.”"
    ],
    correctAnswer: "👨‍💻 2 hours before deadline: “WE NEED TO LOCK IN.”",
    points: 15,
    timeLimit: 20,
    explanation: "Parkinson's Law of Developer Procrastination: 1 week before = 'I'll start tomorrow', 2 hours before = 'WE NEED TO LOCK IN' with 4 energy drinks and panic commits."
  },
  {
    id: "r3-m5",
    round: 3,
    phase: "trivia",
    type: "choice",
    question: "DEBUGGING",
    setupText: "👨‍💻 “I'll just change this one line.” 💻 Entire website stops working. What is the developer's reaction?",
    svgMeme: `
      <svg viewBox="0 0 320 200" class="meme-svg-preview">
        <rect width="320" height="200" fill="#18181b" rx="12" stroke="#a855f7" stroke-width="2"/>
        <!-- One line change -->
        <rect x="20" y="20" width="280" height="42" rx="8" fill="#27272a" stroke="#a855f7" stroke-width="1.5"/>
        <text x="35" y="46" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="600" fill="#c084fc">👨‍💻 “I'll just change this one line.”</text>
        <!-- Disaster alert -->
        <rect x="20" y="72" width="280" height="50" rx="8" fill="#450a0a" stroke="#ef4444" stroke-width="1.5"/>
        <text x="35" y="94" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="#f87171">💥 CRITICAL FAILURE:</text>
        <text x="35" y="110" font-family="monospace" font-size="12" fill="#fca5a5">💻 Entire website stops working.</text>
        <!-- Dev reaction box -->
        <rect x="20" y="132" width="280" height="48" rx="8" fill="#18181b" stroke="#eab308" stroke-width="1.5"/>
        <text x="160" y="162" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="700" fill="#fef08a" text-anchor="middle">👨‍💻 Reaction: ???</text>
      </svg>
    `,
    options: [
      "👨‍💻: “Ctrl+Z! Ctrl+Z! CTRL+Z IMMEDIATELY!”",
      "👨‍💻: “Interesting.”",
      "👨‍💻: “Who wrote this cursed architecture anyway? ...Oh wait, I did.”",
      "👨‍💻: “It was working fine on localhost 30 seconds ago.”"
    ],
    correctAnswer: "👨‍💻: “Interesting.”",
    points: 15,
    timeLimit: 20,
    explanation: "When a tiny 1-line syntax tweak spontaneously combusts the entire server infrastructure into ruins, true developers don't panic—they just mutter: '...Interesting.'"
  }
];

export const MEME_CREATOR_PROMPTS = [
  {
    id: "prompt-1",
    title: "Debugging at 2:00 AM",
    description: "Create a meme capturing the sanity-draining sensation of hunting a missing semicolon or phantom bug in the dead of night."
  },
  {
    id: "prompt-2",
    title: "AI Writing All the Code",
    description: "Create a meme about prompt engineering vs. traditional software developers reading hallucinated Python imports."
  },
  {
    id: "prompt-3",
    title: "Deploying on Friday",
    description: "Create a meme about the brave/foolish soul who triggers a production deploy 10 minutes before the weekend begins."
  }
];

export const MEME_TEMPLATES = [
  {
    id: "drake",
    name: "Drake Disapprove / Approve",
    imgSrc: "assets/drake.jpg",
    topPlaceholder: "Writing 50 lines of unit tests",
    bottomPlaceholder: "Testing directly in production",
    accentColor: "#f59e0b"
  },
  {
    id: "dicaprio",
    name: "Leonardo DiCaprio Pointing",
    imgSrc: "assets/dicaprio.jpg",
    topPlaceholder: "Me watching the junior dev",
    bottomPlaceholder: "Fixing a bug by deleting the test suite",
    accentColor: "#38bdf8"
  },
  {
    id: "button",
    name: "Two Buttons (Daily Struggle)",
    imgSrc: "assets/button.jpg",
    topPlaceholder: "Fix technical debt properly",
    bottomPlaceholder: "Add another // TODO comment",
    accentColor: "#ef4444"
  },
  {
    id: "boyfriend",
    name: "Distracted Boyfriend",
    imgSrc: "assets/boyfriend.jpg",
    topPlaceholder: "A shiny new JavaScript framework",
    bottomPlaceholder: "The stable project due in 2 days",
    accentColor: "#ec4899"
  }
];
