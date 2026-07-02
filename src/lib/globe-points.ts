// Dotted-globe point cloud. Generated procedurally at module load so we ship no
// multi-thousand-entry literal: an evenly distributed Fibonacci sphere, masked
// to a coarse approximation of Earth's land so the spinning globe reads as a
// world map rather than a solid ball. Points are [lat, lon] in radians.
//
// Purely decorative (see GlobeBackground). Deterministic — no Math.random — so
// the same globe renders every load.

export type GlobePoint = readonly [lat: number, lon: number];

const DEG = Math.PI / 180;

// Coarse land regions as [latMin, latMax, lonMin, lonMax] in degrees. Rough on
// purpose — combined with jitter they suggest continents without a huge dataset.
const LAND: readonly [number, number, number, number][] = [
  // North America
  [30, 70, -140, -62],
  [60, 72, -165, -140],
  [15, 30, -116, -88],
  [8, 16, -92, -78],
  // Greenland
  [60, 82, -55, -20],
  // South America
  [-55, 12, -82, -34],
  // Europe
  [36, 60, -10, 40],
  [58, 71, 4, 30],
  [50, 59, -9, 2],
  // Africa
  [-35, 37, -17, 52],
  // Asia
  [8, 60, 40, 150],
  [55, 76, 60, 180],
  [20, 45, 48, 88],
  [8, 30, 68, 90],
  // Southeast Asia + islands
  [-10, 28, 95, 141],
  [30, 46, 129, 146],
  // Australia
  [-40, -10, 113, 154],
  // New Zealand
  [-47, -34, 166, 179],
  // Antarctica
  [-90, -63, -180, 180],
];

function isLand(latDeg: number, lonDeg: number): boolean {
  for (const [a, b, c, d] of LAND) {
    if (latDeg >= a && latDeg <= b && lonDeg >= c && lonDeg <= d) return true;
  }
  return false;
}

// Small deterministic hash → [0,1) for jitter, seeded by point index.
function rand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generate(count: number): GlobePoint[] {
  const points: GlobePoint[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // 1 → -1
    const latDeg = Math.asin(y) / DEG;
    const lonDeg = (((i * golden) / DEG) % 360) - 180;

    // Jitter the coastline test so land edges look organic, not boxy.
    const jLat = (rand(i) - 0.5) * 6;
    const jLon = (rand(i + 9999) - 0.5) * 6;
    if (!isLand(latDeg + jLat, lonDeg + jLon)) continue;

    points.push([latDeg * DEG, lonDeg * DEG]);
  }
  return points;
}

export const GLOBE_POINTS: readonly GlobePoint[] = generate(22000);
