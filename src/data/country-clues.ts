import { COUNTRY_NAMES } from "@/lib/countries-meta";
import type { ComponentType } from "react";
import { Camera, CreditCard, Milestone, Navigation, Zap } from "lucide-react";

export type DrivingSide = "left" | "right";

/**
 * ISO 3166-1 alpha-2 -> which side of the road traffic drives on.
 * Covers every code in COUNTRY_NAMES. Source: well-documented, stable
 * public data (CIA World Factbook / Wikipedia "list of countries by
 * driving side"); double-checked known former-colony exceptions (e.g.
 * Mozambique, Indonesia, Myanmar, Belize, Timor-Leste).
 * AQ/TF have no real traffic — "right" is a harmless placeholder.
 */
export const DRIVING_SIDE_BY_COUNTRY: Record<string, DrivingSide> = {
  AE: "right",
  AF: "right",
  AL: "right",
  AM: "right",
  AO: "right",
  AQ: "right",
  AR: "right",
  AT: "right",
  AU: "left",
  AZ: "right",
  BA: "right",
  BD: "left",
  BE: "right",
  BF: "right",
  BG: "right",
  BI: "right",
  BJ: "right",
  BN: "left",
  BO: "right",
  BR: "right",
  BS: "left",
  BT: "left",
  BW: "left",
  BY: "right",
  BZ: "right",
  CA: "right",
  CD: "right",
  CF: "right",
  CG: "right",
  CH: "right",
  CI: "right",
  CL: "right",
  CM: "right",
  CN: "right",
  CO: "right",
  CR: "right",
  CU: "right",
  CY: "left",
  CZ: "right",
  DE: "right",
  DJ: "right",
  DK: "right",
  DO: "right",
  DZ: "right",
  EC: "right",
  EE: "right",
  EG: "right",
  EH: "right",
  ER: "right",
  ES: "right",
  ET: "right",
  FI: "right",
  FJ: "left",
  FK: "left",
  FR: "right",
  GA: "right",
  GB: "left",
  GE: "right",
  GH: "right",
  GL: "right",
  GM: "right",
  GN: "right",
  GQ: "right",
  GR: "right",
  GT: "right",
  GW: "right",
  GY: "left",
  HN: "right",
  HR: "right",
  HT: "right",
  HU: "right",
  ID: "left",
  IE: "left",
  IL: "right",
  IN: "left",
  IQ: "right",
  IR: "right",
  IS: "right",
  IT: "right",
  JM: "left",
  JO: "right",
  JP: "left",
  KE: "left",
  KG: "right",
  KH: "right",
  KP: "right",
  KR: "right",
  KW: "right",
  KZ: "right",
  LA: "right",
  LB: "right",
  LK: "left",
  LR: "right",
  LS: "left",
  LT: "right",
  LU: "right",
  LV: "right",
  LY: "right",
  MA: "right",
  MD: "right",
  ME: "right",
  MG: "right",
  MK: "right",
  ML: "right",
  MM: "right",
  MN: "right",
  MR: "right",
  MW: "left",
  MX: "right",
  MY: "left",
  MZ: "left",
  NA: "left",
  NC: "right",
  NE: "right",
  NG: "right",
  NI: "right",
  NL: "right",
  NO: "right",
  NP: "left",
  NZ: "left",
  OM: "right",
  PA: "right",
  PE: "right",
  PG: "left",
  PH: "right",
  PK: "left",
  PL: "right",
  PR: "right",
  PS: "right",
  PT: "right",
  PY: "right",
  QA: "right",
  RO: "right",
  RS: "right",
  RU: "right",
  RW: "right",
  SA: "right",
  SB: "left",
  SD: "right",
  SE: "right",
  SI: "right",
  SK: "right",
  SL: "right",
  SN: "right",
  SO: "right",
  SR: "left",
  SS: "right",
  SV: "right",
  SY: "right",
  SZ: "left",
  TD: "right",
  TF: "right",
  TG: "right",
  TH: "left",
  TJ: "right",
  TL: "left",
  TM: "right",
  TN: "right",
  TR: "right",
  TT: "left",
  TW: "right",
  TZ: "left",
  UA: "right",
  UG: "left",
  US: "right",
  UY: "right",
  UZ: "right",
  VE: "right",
  VN: "right",
  VU: "right",
  XK: "right",
  YE: "right",
  ZA: "left",
  ZM: "left",
  ZW: "left",
};

if (process.env.NODE_ENV !== "production") {
  const missing = Object.keys(COUNTRY_NAMES).filter((cc) => !(cc in DRIVING_SIDE_BY_COUNTRY));
  if (missing.length > 0) {
    throw new Error(`DRIVING_SIDE_BY_COUNTRY is missing codes: ${missing.join(", ")}`);
  }
}

/** Driving side for a country code, if known. */
export function drivingSide(iso: string | null | undefined): DrivingSide | undefined {
  if (!iso) return undefined;
  return DRIVING_SIDE_BY_COUNTRY[iso.toUpperCase()];
}

/** Short reveal-screen fact, e.g. "Cars drive on the left here." */
export function drivingSideFact(iso: string | null | undefined): string | undefined {
  const side = drivingSide(iso);
  if (!side) return undefined;
  return side === "left" ? "Cars drive on the left here." : "Cars drive on the right here.";
}

export interface ClueCategory {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  body: string;
}

/**
 * General-purpose, non-country-specific clue reference. Deliberately text-only
 * for v1 — reference photos/diagrams per category would help but aren't
 * required to ship this; a nice follow-up once assets are sourced.
 */
export const CLUE_CATEGORIES: ClueCategory[] = [
  {
    id: "bollards",
    title: "Bollards",
    icon: Milestone,
    body: "The short posts lining roads vary a lot by country — plain concrete, reflective yellow-and-black, or thin metal poles. Shape, color, and spacing are some of the most reliable regional tells once you've seen a few examples, especially across Europe and former Soviet states.",
  },
  {
    id: "poles",
    title: "Utility poles",
    icon: Zap,
    body: "Wood vs. concrete vs. metal poles, and how many crossbars or transformers they carry, differ by region and utility company. Concrete poles are common across much of Latin America and Southeast Asia; wooden poles dominate North America and Northern Europe.",
  },
  {
    id: "plates",
    title: "License plates",
    icon: CreditCard,
    body: "Plate shape, color scheme, and font are often visible even at a distance and can narrow a guess to a single country or region instantly. The EU blue band with a country code, US state-specific plates, and yellow rear plates in the UK are classic examples.",
  },
  {
    id: "camera",
    title: "Street View camera generations",
    icon: Camera,
    body: "The car-mounted camera rig used to capture imagery changed over the years, leaving visible artifacts — a trekker's shadow, a visible car hood, stitching seams, or the amount of blur in the image. Recognizing the camera generation can hint at when (and sometimes where) coverage was captured.",
  },
  {
    id: "driving-side",
    title: "Driving side",
    icon: Navigation,
    body: "Left-hand vs. right-hand traffic is one of the fastest clues to read — check parked cars, lane markings, or which side the steering wheel sits on. Around a third of the world drives on the left, mostly former British territories plus a handful of historical exceptions like Indonesia, Thailand, and Mozambique.",
  },
];
