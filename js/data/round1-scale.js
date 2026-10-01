/**
 * ARCADE - Round 1: Scale Wars Data
 * Fictional character size challenges (Comparison & Height Estimation)
 * Total points: 100 (5 questions x 20 points)
 */

export const SCALE_WARS_CHARACTERS = {
  pikachu: {
    id: "pikachu",
    name: "Pikachu",
    franchise: "Pokémon",
    heightM: 0.4,
    heightFt: "1'4\"",
    weightKg: 6.0,
    category: "Pocket Class",
    color: "#ffdd44",
    glbSrc: "pikachu/source/pikachu2.glb",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><ellipse cx="80" cy="115" rx="46" ry="52" fill="#ffdd44" opacity="0.9"/><polygon points="35,65 15,15 48,45" fill="#ffdd44"/><polygon points="125,65 145,15 112,45" fill="#ffdd44"/><circle cx="55" cy="118" r="8" fill="#ef4444"/><circle cx="105" cy="118" r="8" fill="#ef4444"/><circle cx="68" cy="100" r="5" fill="#fff"/><circle cx="92" cy="100" r="5" fill="#fff"/></svg>`
  },

  mario: {
    id: "mario",
    name: "Mario",
    franchise: "Nintendo",
    heightM: 1.55,
    heightFt: "5'1\"",
    weightKg: 65,
    category: "Standard Humanoid",
    color: "#ef4444",
    glbSrc: "mario-mini/source/mario.glb",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><circle cx="80" cy="38" r="22" fill="#ef4444" opacity="0.9"/><path d="M 48 68 L 112 68 L 100 130 L 60 130 Z" fill="#ef4444" opacity="0.9"/><path d="M 64 130 L 58 190 M 96 130 L 102 190" stroke="#ef4444" stroke-width="12"/></svg>`
  },
  masterchief: {
    id: "masterchief",
    name: "Master Chief",
    franchise: "Halo",
    heightM: 2.18,
    heightFt: "7'2\"",
    weightKg: 450,
    category: "Super Soldier",
    color: "#22c55e",
    glbSrc: "masterchief/scene.gltf",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><polygon points="65,18 95,18 102,44 80,52 58,44" fill="#22c55e"/><polygon points="36,60 124,60 112,120 48,120" fill="#22c55e"/><path d="M 60 120 L 54 192 M 100 120 L 106 192" stroke="#22c55e" stroke-width="12"/></svg>`
  },
  hulk: {
    id: "hulk",
    name: "The Incredible Hulk",
    franchise: "Marvel",
    heightM: 2.6,
    heightFt: "8'6\"",
    weightKg: 635,
    category: "Heavy Colossus",
    color: "#10b981",
    glbSrc: "hulk/scene.gltf",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><path d="M 68 32 Q 80 18 92 32 Q 80 44 68 32 Z" fill="#10b981"/><path d="M 24 60 Q 80 40 136 60 L 122 125 L 38 125 Z" fill="#10b981"/><path d="M 56 125 L 48 192 M 104 125 L 112 192" stroke="#10b981" stroke-width="16"/></svg>`
  },
  clifford: {
    id: "clifford",
    name: "Clifford the Big Red Dog",
    franchise: "Scholastic",
    heightM: 7.62,
    heightFt: "25'0\"",
    weightKg: 3800,
    category: "Giant Canine",
    color: "#ef4444",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><ellipse cx="80" cy="85" rx="35" ry="30" fill="#ef4444"/><path d="M 45 110 Q 80 90 115 110 L 120 185 L 40 185 Z" fill="#ef4444"/><circle cx="80" cy="98" r="7" fill="#000"/></svg>`
  },
  optimus: {
    id: "optimus",
    name: "Optimus Prime",
    franchise: "Transformers",
    heightM: 8.5,
    heightFt: "28'0\"",
    weightKg: 4300,
    category: "Cybertronian Leader",
    color: "#0284c7",
    glbSrc: "optimus_prime/scene.gltf",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><polygon points="68,14 92,14 98,32 62,32" fill="#0284c7"/><polygon points="22,46 58,36 102,36 138,46 128,76 102,125 58,125 32,76" fill="#0284c7"/><path d="M 64 125 L 56 195 M 96 125 L 104 195" stroke="#0284c7" stroke-width="14"/></svg>`
  },
  megatron: {
    id: "megatron",
    name: "Megatron",
    franchise: "Transformers",
    heightM: 10.67,
    heightFt: "35'0\"",
    weightKg: 5700,
    category: "Decepticon Leader",
    color: "#a855f7",
    glbSrc: "megatron/scene.gltf",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><polygon points="80,10 60,35 100,35" fill="#a855f7"/><polygon points="40,35 70,35 60,70 30,55" fill="#a855f7"/><polygon points="120,35 90,35 100,70 130,55" fill="#a855f7"/><polygon points="50,75 110,75 95,130 65,130" fill="#a855f7" opacity="0.9"/><path d="M 65 130 L 52 195 M 95 130 L 108 195" stroke="#a855f7" stroke-width="14"/><circle cx="70" cy="55" r="4" fill="#ff0055"/><circle cx="90" cy="55" r="4" fill="#ff0055"/></svg>`
  },
  iron_giant: {
    id: "iron_giant",
    name: "The Iron Giant",
    franchise: "The Iron Giant",
    heightM: 15.24,
    heightFt: "50'0\"",
    weightKg: 50000,
    category: "Alien Automaton",
    color: "#38bdf8",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><polygon points="68,15 92,15 98,35 62,35" fill="#38bdf8"/><polygon points="25,50 60,40 100,40 135,50 125,80 100,130 60,130 35,80" fill="#38bdf8"/><path d="M 68 130 L 60 205 M 92 130 L 100 205" stroke="#38bdf8" stroke-width="14"/></svg>`
  },
  colossal_titan: {
    id: "colossal_titan",
    name: "Colossal Titan",
    franchise: "Attack on Titan",
    heightM: 60.0,
    heightFt: "196'10\"",
    weightKg: 850000,
    category: "Wall-Breaker Titan",
    color: "#f97316",
    silhouetteSrc: "assets/colossaltitan_silhouette.png",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><circle cx="80" cy="35" r="16" fill="#ef4444"/><path d="M 28 64 L 132 64 L 118 135 L 42 135 Z" fill="#ef4444"/><path d="M 58 135 L 50 198 M 102 135 L 110 198" stroke="#ef4444" stroke-width="20"/></svg>`
  },
  godzilla: {
    id: "godzilla",
    name: "Godzilla (Monsterverse)",
    franchise: "Monsterverse Alpha",
    heightM: 119.8,
    heightFt: "393'0\"",
    weightKg: 99634000,
    category: "King of the Monsters",
    color: "#06b6d4",
    silhouetteSrc: "assets/godzilla_silhouette.png",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><polygon points="50,26 40,12 56,22" fill="#06b6d4"/><polygon points="40,50 20,34 46,45" fill="#06b6d4"/><path d="M 88 36 L 118 40 L 112 60 L 92 60 L 112 120 L 122 185 L 132 196 L 82 196 L 56 180 L 46 145 L 56 80 L 72 40 Z" fill="#06b6d4" opacity="0.95"/></svg>`
  },
  shai_hulud: {
    id: "shai_hulud",
    name: "Shai-Hulud Sandworm",
    franchise: "Dune",
    heightM: 400.0,
    heightFt: "1312'0\"",
    weightKg: 450000000,
    category: "Apex Xenobiological Leviathan",
    color: "#d97706",
    svg: `<svg viewBox="0 0 160 200" class="holo-svg"><ellipse cx="80" cy="50" rx="55" ry="38" fill="#d97706"/><ellipse cx="80" cy="50" rx="34" ry="22" fill="#090d16"/><path d="M 25 50 Q 35 140 70 196 L 90 196 Q 125 140 135 50" fill="#d97706"/></svg>`
  },
  lugia: {
    id: "lugia",
    name: "Lugia",
    franchise: "Pokémon",
    heightM: 5.2,
    heightFt: "17'1\"",
    weightKg: 216.0,
    category: "Diving Pokémon (Psychic/Flying)",
    color: "#ffffff",
    svg: `<svg viewBox="0 0 200 200" class="holo-svg lugia-sil-svg" fill="#f8fafc"><path d="M 95 145 C 90 155 85 168 78 180 C 75 185 82 188 88 182 C 100 168 108 150 115 130 C 122 110 118 90 110 75 C 105 65 100 50 102 38 C 103 30 98 25 90 28 C 82 31 75 38 78 48 C 80 55 88 65 92 78 C 80 82 60 70 45 60 C 35 52 25 58 28 68 C 32 78 48 90 62 98 C 45 100 30 105 20 115 C 15 120 18 126 26 124 C 40 120 60 115 75 110 C 68 125 58 140 48 152 C 42 158 48 165 56 160 C 70 148 82 135 90 118 C 96 128 100 140 95 145 Z M 130 65 C 145 55 165 48 180 50 C 188 51 189 60 182 66 C 170 75 152 82 138 88 C 155 92 172 98 182 108 C 188 114 184 122 175 120 C 160 116 142 108 128 102 C 140 118 150 135 156 150 C 160 158 152 165 144 158 C 132 145 122 128 118 112 Z" /></svg>`
  },
  vw_beetle: {
    id: "vw_beetle",
    name: "Volkswagen Beetle",
    franchise: "Automotive Reference",
    heightM: 1.50,
    lengthM: 4.07,
    lengthFt: "13.35 ft",
    category: "Standard Reference Vehicle",
    color: "#2a2e39",
    svg: `<svg viewBox="0 0 240 120" class="holo-svg beetle-sil-svg"><path d="M 15 88 C 15 80 22 75 32 75 C 40 75 52 75 60 70 C 70 60 85 30 120 25 C 160 20 195 45 210 70 C 220 72 232 75 232 85 C 232 90 225 94 218 94 L 202 94 C 200 80 185 70 170 70 C 155 70 140 80 138 94 L 82 94 C 80 80 65 70 50 70 C 35 70 20 80 18 94 L 8 94 C 5 94 2 91 2 88 L 15 88 Z" fill="#1e2433" /><path d="M 90 60 C 95 45 110 35 125 33 L 125 60 Z M 135 33 C 155 35 175 48 185 60 L 135 60 Z" fill="#0f172a" opacity="0.9" /><circle cx="50" cy="94" r="18" fill="#111827" stroke="#64748b" stroke-width="4" /><circle cx="50" cy="94" r="8" fill="#94a3b8" /><circle cx="170" cy="94" r="18" fill="#111827" stroke="#64748b" stroke-width="4" /><circle cx="170" cy="94" r="8" fill="#94a3b8" /></svg>`
  }
};

export const ROUND1_SCALE_QUESTIONS = [
  {
    id: "r1-q1",
    round: 1,
    type: "comparison",
    question: "WHO IS TALLER?",
    characterA: "mario",
    characterB: "pikachu",
    options: ["mario", "pikachu"],
    correctAnswer: "mario",
    timeLimit: 15,
    points: 20,
    explanation: "Mario stands at 1.55 m (5'1\"), while Pikachu is 0.40 m (1'4\"). Mario is nearly 4x taller!"
  },
  {
    id: "r1-q2",
    round: 1,
    type: "comparison",
    question: "WHO IS TALLER?",
    characterA: "masterchief",
    characterB: "hulk",
    options: ["masterchief", "hulk"],
    correctAnswer: "hulk",
    timeLimit: 15,
    points: 20,
    explanation: "The Incredible Hulk stands 2.60 m (8'6\"), towering over Master Chief in Spartan armor at 2.18 m (7'2\")."
  },
  {
    id: "r1-q3",
    round: 1,
    type: "size_it_up",
    question: "HOW BIG IS MEGATRON?",
    subPrompt: "Guess: Megatron · Decepticon Leader · Height | Reference: Optimus Prime · 8.50 m",
    character: "megatron",
    referenceItem: "optimus",
    referenceLabel: "Optimus Prime 8.50 m · 27.89 ft tall",
    referenceLengthM: 8.50,
    correctNumber: 10.67,
    unit: "metres",
    minM: 1.0,
    maxM: 20.0,
    initialM: 6.00,
    tolerance: [
      { maxDiff: 0.60, points: 20, label: "🎯 PINPOINT ACCURACY" },
      { maxDiff: 1.50, points: 15, label: "⚡ EXCELLENT ESTIMATE" },
      { maxDiff: 3.00, points: 10, label: "👍 CLOSE ESTIMATE" },
      { maxDiff: 5.00, points: 5, label: "🔍 ROUGH ESTIMATE" }
    ],
    timeLimit: 30,
    points: 20,
    explanation: "Megatron stands at an intimidating 10.67 m (35'0\" / 35.00 ft) — towering over Optimus Prime who stands at 8.50 m (27'11\" / 28.00 ft)!"
  },
  {
    id: "r1-q4",
    round: 1,
    type: "estimation",
    question: "ESTIMATE THE HEIGHT OF THE COLOSSAL TITAN",
    character: "colossal_titan",
    correctNumber: 60.0,
    unit: "metres",
    tolerance: [
      { maxDiff: 3.0, points: 20, label: "PINPOINT ACCURACY" },
      { maxDiff: 8.0, points: 15, label: "EXCELLENT ESTIMATE" },
      { maxDiff: 15.0, points: 10, label: "CLOSE CALL" },
      { maxDiff: 25.0, points: 5, label: "ROUGH ESTIMATE" }
    ],
    timeLimit: 20,
    points: 20,
    referenceScale: { human: 1.8, car: 4.5, building: 30, target: 60.0 },
    explanation: "The Colossal Titan stands at exactly 60.0 metres (197 ft), towering 10 metres above the 50-metre Wall Maria."
  },
  {
    id: "r1-q5",
    round: 1,
    type: "estimation",
    question: "ESTIMATE THE HEIGHT OF GODZILLA (MONSTERVERSE)",
    character: "godzilla",
    correctNumber: 119.8,
    unit: "metres",
    tolerance: [
      { maxDiff: 5.0, points: 20, label: "PINPOINT ACCURACY" },
      { maxDiff: 15.0, points: 15, label: "EXCELLENT ESTIMATE" },
      { maxDiff: 30.0, points: 10, label: "CLOSE CALL" },
      { maxDiff: 50.0, points: 5, label: "ROUGH ESTIMATE" }
    ],
    timeLimit: 20,
    points: 20,
    referenceScale: { human: 1.8, car: 4.5, building: 30, target: 119.8 },
    explanation: "Godzilla (Monsterverse Alpha) stands at exactly 119.8 metres (393 ft) tall — nearly double the height of the Colossal Titan!"
  }
];
