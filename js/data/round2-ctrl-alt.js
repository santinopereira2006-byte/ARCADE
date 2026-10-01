/**
 * ARCADE - Round 2: CTRL + ALT + GUESS Data
 * Progressive visual technology identification with 4-stage unblur/crop system
 * Stage 1: 20 pts | Stage 2: 15 pts | Stage 3: 10 pts | Stage 4: 5 pts
 * Total points: 100 (5 questions x max 20 points)
 */

export const ROUND2_TECH_QUESTIONS = [
  {
    id: "r2-q1",
    round: 2,
    type: "progressive-reveal",
    category: "DevOps & Cloud",
    question: "IDENTIFY THIS CONTAINERIZATION & CLOUD PLATFORM LOGO",
    hint: "Think blue maritime creature carrying shipping containers...",
    imgSrc: "assets/docker.png",
    svgContent: `
      <svg viewBox="0 0 200 200" class="tech-graphic-svg" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" rx="20" fill="#0d1b2a"/>
        <!-- Whale body -->
        <path d="M 30 115 C 30 75 140 75 170 115 C 160 145 70 145 30 115 Z" fill="#0db7ed"/>
        <path d="M 170 115 Q 190 100 185 85 Q 170 100 160 112" fill="#0db7ed"/>
        <!-- Eye -->
        <circle cx="50" cy="110" r="4" fill="#0d1b2a"/>
        <!-- Container blocks -->
        <rect x="70" y="85" width="14" height="12" fill="#fff" rx="1"/>
        <rect x="88" y="85" width="14" height="12" fill="#fff" rx="1"/>
        <rect x="106" y="85" width="14" height="12" fill="#fff" rx="1"/>
        <rect x="79" y="70" width="14" height="12" fill="#fff" rx="1"/>
        <rect x="97" y="70" width="14" height="12" fill="#fff" rx="1"/>
        <rect x="88" y="55" width="14" height="12" fill="#fff" rx="1"/>
      </svg>
    `,
    options: ["Kubernetes", "Podman", "Docker", "Containerd"],
    correctAnswer: "Docker",
    explanation: "Docker's iconic blue whale carries standardized software containers, revolutionized cloud deployment since 2013."
  },
  {
    id: "r2-q2",
    round: 2,
    type: "progressive-reveal",
    category: "Developer Tools",
    question: "IDENTIFY THIS POPULAR CODE EDITOR / IDE LOGO",
    hint: "Microsoft's ubiquitous ribbon-fold editor used by millions of devs...",
    imgSrc: "assets/vscode.jpg",
    svgContent: `
      <svg viewBox="0 0 200 200" class="tech-graphic-svg" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" rx="20" fill="#1e1e1e"/>
        <!-- Origami style ribbon folds -->
        <path d="M 145 35 L 50 110 L 25 90 L 145 35 Z" fill="#0065a9"/>
        <path d="M 145 165 L 50 90 L 25 110 L 145 165 Z" fill="#007acc"/>
        <path d="M 50 90 L 145 35 L 175 52 L 145 100 L 50 90 Z" fill="#1f9cf0"/>
        <path d="M 50 110 L 145 165 L 175 148 L 145 100 L 50 110 Z" fill="#007acc"/>
        <path d="M 145 100 L 175 52 L 175 148 Z" fill="#0065a9"/>
      </svg>
    `,
    options: ["Sublime Text", "Atom", "IntelliJ IDEA", "Visual Studio Code"],
    correctAnswer: "Visual Studio Code",
    explanation: "Visual Studio Code (VS Code), released in 2015, is an open-source source-code editor developed by Microsoft using Electron."
  },
  {
    id: "r2-q3",
    round: 2,
    type: "progressive-reveal",
    category: "System Error & Diagnostics",
    question: "NAME THIS INFAMOUS OPERATING SYSTEM CRASH SCREEN",
    hint: "Featuring a sad emoticon :( and stopcode memory dumps...",
    imgSrc: "assets/bluescreenofdeath.png",
    svgContent: `
      <svg viewBox="0 0 200 200" class="tech-graphic-svg" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" rx="20" fill="#0078d7"/>
        <text x="35" y="80" font-family="'Segoe UI', sans-serif" font-size="46" font-weight="300" fill="#ffffff">:(</text>
        <text x="35" y="115" font-family="'Segoe UI', sans-serif" font-size="11" fill="#ffffff">Your PC ran into a problem</text>
        <text x="35" y="130" font-family="'Segoe UI', sans-serif" font-size="11" fill="#ffffff">and needs to restart.</text>
        <rect x="35" y="145" width="25" height="25" fill="#ffffff" opacity="0.9"/>
        <text x="68" y="162" font-family="monospace" font-size="9" fill="#ffffff">STOP: 0x0000007E</text>
      </svg>
    `,
    options: ["Kernel Panic", "BSOD (Blue Screen of Death)", "Guru Meditation", "Red Screen of Death"],
    correctAnswer: "BSOD (Blue Screen of Death)",
    explanation: "The Windows Blue Screen of Death (BSOD), officially known as a Stop Error or Bug Check, halts Windows when a fatal kernel fault occurs."
  },
  {
    id: "r2-q4",
    round: 2,
    type: "progressive-reveal",
    category: "Version Control & Git",
    question: "IDENTIFY THIS ESSENTIAL DEVELOPER PLATFORM MASCOT",
    hint: "The tentacled feline creature guarding your pull requests...",
    imgSrc: "assets/octocat.png",
    svgContent: `
      <svg viewBox="0 0 200 200" class="tech-graphic-svg" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" rx="20" fill="#24292e"/>
        <!-- Octocat silhouette -->
        <circle cx="100" cy="100" r="70" fill="#ffffff"/>
        <path d="M 100 40 C 60 40 45 65 45 95 C 45 125 65 145 80 152 L 80 135 C 75 133 65 128 60 115 C 65 115 70 118 78 124 C 85 122 92 121 100 121 C 108 121 115 122 122 124 C 130 118 135 115 140 115 C 135 128 125 133 120 135 L 120 152 C 135 145 155 125 155 95 C 155 65 140 40 100 40 Z" fill="#24292e"/>
        <polygon points="56,52 48,28 72,42" fill="#24292e"/>
        <polygon points="144,52 152,28 128,42" fill="#24292e"/>
      </svg>
    `,
    options: ["GitHub Octocat", "GitLab Tanuki", "Bitbucket Atlas", "Docker Moby"],
    correctAnswer: "GitHub Octocat",
    explanation: "Mona the Octocat is GitHub's official mascot, created by graphic designer Simon Oxley. It combines an octopus with a cat."
  },
  {
    id: "r2-q5",
    round: 2,
    type: "progressive-reveal",
    category: "Hardware & Architecture",
    question: "IDENTIFY THIS HIGH-PERFORMANCE COMPUTING & GPU TITAN",
    hint: "Green claw mark logo powering modern AI neural networks...",
    imgSrc: "assets/nvidia.png",
    svgContent: `
      <svg viewBox="0 0 200 200" class="tech-graphic-svg" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" rx="20" fill="#000000"/>
        <!-- NVIDIA Eye / Claw Spiral -->
        <path d="M 100 40 C 135 40 160 65 160 98 C 160 132 135 158 100 158 C 72 158 48 140 42 118 C 50 128 65 138 88 138 C 112 138 132 120 132 98 C 132 76 112 58 88 58 C 65 58 50 68 42 78 C 48 56 72 40 100 40 Z" fill="#76b900"/>
        <circle cx="88" cy="98" r="16" fill="#76b900"/>
      </svg>
    `,
    options: ["AMD Radeon", "Intel Arc", "NVIDIA", "Qualcomm Snapdragon"],
    correctAnswer: "NVIDIA",
    explanation: "NVIDIA, founded in 1993, uses the vibrant neon-green claw/eye emblem, dominating modern GPU architecture and AI compute."
  }
];
