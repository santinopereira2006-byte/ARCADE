/**
 * ARCADE - Round 5: RETRO BLAST (CYBERPUNK PRECISION TARGET SIMULATOR)
 * Fast-paced synthwave Aim Labs clone adapted as Tournament Round 5.
 * Timers and countdown despawns removed per event requirements.
 */

export const ROUND5_RETRO_BLAST_CONFIG = {
  id: "round5-retro-blast",
  roundNumber: 5,
  title: "RETRO BLAST",
  category: "Cyberpunk Precision Target Simulator",
  maxScore: 100,
  waves: [
    {
      waveNumber: 1,
      name: "GRID CLEAR",
      desc: "3 waves: 5, 5, then 10 simultaneous neon targets.",
      targetWaves: [5, 5, 10],
      totalTargets: 20,
      pointsPerTarget: 1.25,
      maxWavePoints: 25,
      ammo: Infinity,
      timeLimit: 0
    },
    {
      waveNumber: 2,
      name: "REFLEX SNAP",
      desc: "30 rapid reflex targets with 35 ammo. Instant next target on hit!",
      totalTargets: 30,
      pointsPerTarget: 1.17,
      maxWavePoints: 35,
      ammo: 35,
      timeLimit: 0
    },
    {
      waveNumber: 3,
      name: "PRECISION & HAZARDS",
      desc: "Sequential stream: blue targets & red hazard buttons one-by-one. 30 ammo, 45s clock. Avoid red bombs!",
      totalTargets: 30,
      totalBombs: 10,
      pointsPerTarget: 1.34,
      bombPenalty: 2,
      maxWavePoints: 40,
      ammo: 30,
      timeLimit: 45,
      itemLifespan: 1700
    }
  ]
};
