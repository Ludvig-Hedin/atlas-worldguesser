// One-time generator for the landing-page dotted globe.
// Samples an evenly distributed Fibonacci sphere, keeps points that fall on
// real land (Natural Earth 50m), and writes public/globe.json as [lat, lon]
// pairs in radians. Run: node scripts/gen-globe.mjs
import { writeFileSync } from "node:fs";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

const SOURCES = [
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/physical/ne_50m_land.json",
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json",
];

const CANDIDATES = 42000; // pre-mask samples; ~29% land → ~12k kept
const DEG = Math.PI / 180;

async function loadLand() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log("land:", url.split("/").slice(-1)[0]);
        return await res.json();
      }
    } catch {
      /* try next */
    }
  }
  throw new Error("could not fetch Natural Earth land");
}

function bboxOf(geom) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const scan = (coords) => {
    for (const c of coords) {
      if (typeof c[0] === "number") {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      } else scan(c);
    }
  };
  scan(geom.coordinates);
  return [minX, minY, maxX, maxY];
}

const land = await loadLand();
const feats = land.features.map((f) => ({ f, bbox: bboxOf(f.geometry) }));

const points = [];
const golden = Math.PI * (3 - Math.sqrt(5));

for (let i = 0; i < CANDIDATES; i++) {
  const y = 1 - (i / (CANDIDATES - 1)) * 2;
  const latDeg = (Math.asin(y) / DEG);
  let lonDeg = (((i * golden) / DEG) % 360);
  if (lonDeg > 180) lonDeg -= 360;

  // Ice cap: guarantee Antarctica ring (polygon-in-polygon is unreliable at the pole).
  let onLand = latDeg < -62;

  if (!onLand) {
    const pt = [lonDeg, latDeg];
    for (const { f, bbox } of feats) {
      if (lonDeg < bbox[0] || lonDeg > bbox[2] || latDeg < bbox[1] || latDeg > bbox[3]) continue;
      if (booleanPointInPolygon(pt, f)) {
        onLand = true;
        break;
      }
    }
  }

  if (onLand) {
    points.push([+(latDeg * DEG).toFixed(4), +(lonDeg * DEG).toFixed(4)]);
  }
}

writeFileSync("public/globe.json", JSON.stringify(points));
console.log(`wrote public/globe.json — ${points.length} land points`);
