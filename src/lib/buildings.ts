import type { RoundResult } from "./types";

/** A curated iconic-building avatar, keyed by ISO 3166-1 alpha-2 country code. */
export interface BuildingDef {
  /** Country code, e.g. "FR". Doubles as the unlock key. */
  id: string;
  /** Building/landmark display name, e.g. "Eiffel Tower". */
  name: string;
  /** Static asset path, e.g. "/buildings/fr.png". */
  image: string;
}

/**
 * Curated set of countries with an iconic-building avatar.
 * Every code below is confirmed present in src/data/locations.ts, so a
 * correct guess for it is actually reachable in-game. Countries not in this
 * list simply have no unlockable building yet (players keep the default
 * gradient/initials avatar) — safe to extend this list over time.
 */
const RULES: BuildingDef[] = [
  { id: "FR", name: "Eiffel Tower", image: "/buildings/fr.png" },
  { id: "IT", name: "Colosseum", image: "/buildings/it.png" },
  { id: "IN", name: "Taj Mahal", image: "/buildings/in.png" },
  { id: "GB", name: "Big Ben", image: "/buildings/gb.png" },
  { id: "US", name: "Statue of Liberty", image: "/buildings/us.png" },
  { id: "EG", name: "Pyramids of Giza", image: "/buildings/eg.png" },
  { id: "CN", name: "Great Wall of China", image: "/buildings/cn.png" },
  { id: "AU", name: "Sydney Opera House", image: "/buildings/au.png" },
  { id: "BR", name: "Christ the Redeemer", image: "/buildings/br.png" },
  { id: "RU", name: "Saint Basil's Cathedral", image: "/buildings/ru.png" },
  { id: "DE", name: "Neuschwanstein Castle", image: "/buildings/de.png" },
  { id: "ES", name: "Sagrada Família", image: "/buildings/es.png" },
  { id: "JP", name: "Tokyo Tower", image: "/buildings/jp.png" },
  { id: "GR", name: "Parthenon", image: "/buildings/gr.png" },
  { id: "PE", name: "Machu Picchu", image: "/buildings/pe.png" },
  { id: "MX", name: "Chichén Itzá", image: "/buildings/mx.png" },
  { id: "TR", name: "Hagia Sophia", image: "/buildings/tr.png" },
  { id: "AE", name: "Burj Khalifa", image: "/buildings/ae.png" },
  { id: "KH", name: "Angkor Wat", image: "/buildings/kh.png" },
  { id: "JO", name: "Petra", image: "/buildings/jo.png" },
  { id: "CA", name: "CN Tower", image: "/buildings/ca.png" },
  { id: "PT", name: "Belém Tower", image: "/buildings/pt.png" },
  { id: "CZ", name: "Prague Castle", image: "/buildings/cz.png" },
  { id: "AT", name: "Schönbrunn Palace", image: "/buildings/at.png" },
  { id: "MA", name: "Hassan II Mosque", image: "/buildings/ma.png" },
  { id: "ID", name: "Borobudur", image: "/buildings/id.png" },
  { id: "KR", name: "Gyeongbokgung Palace", image: "/buildings/kr.png" },
  { id: "TH", name: "Grand Palace", image: "/buildings/th.png" },
  { id: "PL", name: "Wawel Castle", image: "/buildings/pl.png" },
  { id: "HU", name: "Hungarian Parliament Building", image: "/buildings/hu.png" },
  { id: "CH", name: "Chillon Castle", image: "/buildings/ch.png" },
  { id: "NL", name: "Kinderdijk Windmills", image: "/buildings/nl.png" },
  { id: "SE", name: "Stockholm City Hall", image: "/buildings/se.png" },
  { id: "NO", name: "Oslo Opera House", image: "/buildings/no.png" },
  { id: "DK", name: "Rosenborg Castle", image: "/buildings/dk.png" },
  { id: "FI", name: "Helsinki Cathedral", image: "/buildings/fi.png" },
  { id: "IE", name: "Dublin Castle", image: "/buildings/ie.png" },
  { id: "IS", name: "Hallgrímskirkja", image: "/buildings/is.png" },
  { id: "BE", name: "Atomium", image: "/buildings/be.png" },
  { id: "VN", name: "One Pillar Pagoda", image: "/buildings/vn.png" },
  { id: "PH", name: "Manila Cathedral", image: "/buildings/ph.png" },
  { id: "MY", name: "Petronas Towers", image: "/buildings/my.png" },
  { id: "NZ", name: "Sky Tower", image: "/buildings/nz.png" },
  { id: "ZA", name: "Union Buildings", image: "/buildings/za.png" },
  { id: "AR", name: "Casa Rosada", image: "/buildings/ar.png" },
  { id: "CO", name: "Las Lajas Sanctuary", image: "/buildings/co.png" },
  { id: "CL", name: "La Moneda Palace", image: "/buildings/cl.png" },
  { id: "CU", name: "El Capitolio", image: "/buildings/cu.png" },
  { id: "IR", name: "Azadi Tower", image: "/buildings/ir.png" },
  { id: "LB", name: "Beiteddine Palace", image: "/buildings/lb.png" },
  { id: "PK", name: "Badshahi Mosque", image: "/buildings/pk.png" },
  { id: "BD", name: "National Parliament House", image: "/buildings/bd.png" },
  { id: "LK", name: "Sigiriya", image: "/buildings/lk.png" },
  { id: "NP", name: "Boudhanath Stupa", image: "/buildings/np.png" },
  { id: "MM", name: "Shwedagon Pagoda", image: "/buildings/mm.png" },
  { id: "QA", name: "Museum of Islamic Art", image: "/buildings/qa.png" },
  { id: "KW", name: "Kuwait Towers", image: "/buildings/kw.png" },
  { id: "IQ", name: "Malwiya Tower", image: "/buildings/iq.png" },
  { id: "RO", name: "Bran Castle", image: "/buildings/ro.png" },
  { id: "BG", name: "Alexander Nevsky Cathedral", image: "/buildings/bg.png" },
  { id: "RS", name: "Church of Saint Sava", image: "/buildings/rs.png" },
  { id: "HR", name: "St. Mark's Church", image: "/buildings/hr.png" },
  { id: "EE", name: "Toompea Castle", image: "/buildings/ee.png" },
  { id: "LV", name: "House of the Black Heads", image: "/buildings/lv.png" },
  { id: "LT", name: "Trakai Island Castle", image: "/buildings/lt.png" },
  { id: "CY", name: "Kyrenia Castle", image: "/buildings/cy.png" },
  { id: "GE", name: "Narikala Fortress", image: "/buildings/ge.png" },
  { id: "AM", name: "Geghard Monastery", image: "/buildings/am.png" },
  { id: "AZ", name: "Flame Towers", image: "/buildings/az.png" },
  { id: "KZ", name: "Bayterek Tower", image: "/buildings/kz.png" },
  { id: "UZ", name: "Registan", image: "/buildings/uz.png" },
  { id: "MN", name: "Genghis Khan Equestrian Statue", image: "/buildings/mn.png" },
  { id: "TW", name: "Taipei 101", image: "/buildings/tw.png" },
  { id: "ET", name: "Lalibela Rock-Hewn Churches", image: "/buildings/et.png" },
  { id: "GH", name: "Cape Coast Castle", image: "/buildings/gh.png" },
  { id: "SN", name: "African Renaissance Monument", image: "/buildings/sn.png" },
  { id: "EC", name: "Basílica del Voto Nacional", image: "/buildings/ec.png" },
  { id: "BO", name: "Gate of the Sun, Tiwanaku", image: "/buildings/bo.png" },
  { id: "UY", name: "Palacio Salvo", image: "/buildings/uy.png" },
  { id: "GT", name: "Tikal", image: "/buildings/gt.png" },
  { id: "PA", name: "Miraflores Locks", image: "/buildings/pa.png" },
  { id: "MT", name: "St. John's Co-Cathedral", image: "/buildings/mt.png" },
  { id: "UA", name: "Saint Sophia Cathedral", image: "/buildings/ua.png" },
  { id: "BA", name: "Stari Most", image: "/buildings/ba.png" },
  { id: "SI", name: "Bled Island Church", image: "/buildings/si.png" },
  { id: "SK", name: "Bratislava Castle", image: "/buildings/sk.png" },
  { id: "BY", name: "National Library of Belarus", image: "/buildings/by.png" },
  { id: "MD", name: "Nativity Cathedral", image: "/buildings/md.png" },
  { id: "AL", name: "Et'hem Bey Mosque", image: "/buildings/al.png" },
  { id: "MK", name: "Stone Bridge", image: "/buildings/mk.png" },
  { id: "LU", name: "Grand Ducal Palace", image: "/buildings/lu.png" },
  { id: "XK", name: "Newborn Monument", image: "/buildings/xk.png" },
  { id: "CI", name: "Basilica of Our Lady of Peace", image: "/buildings/ci.png" },
  { id: "ML", name: "Great Mosque of Djenné", image: "/buildings/ml.png" },
  { id: "SD", name: "Pyramids of Meroë", image: "/buildings/sd.png" },
  { id: "MG", name: "Rova of Antananarivo", image: "/buildings/mg.png" },
  { id: "HT", name: "Citadelle Laferrière", image: "/buildings/ht.png" },
  { id: "PR", name: "Castillo San Felipe del Morro", image: "/buildings/pr.png" },
  { id: "HN", name: "Copán Ruins", image: "/buildings/hn.png" },
  { id: "NI", name: "Cathedral of León", image: "/buildings/ni.png" },
  { id: "DO", name: "Alcázar de Colón", image: "/buildings/do.png" },
  { id: "OM", name: "Royal Opera House Muscat", image: "/buildings/om.png" },
  { id: "YE", name: "Old City of Sana'a", image: "/buildings/ye.png" },
  { id: "SY", name: "Krak des Chevaliers", image: "/buildings/sy.png" },
  { id: "NC", name: "Tjibaou Cultural Centre", image: "/buildings/nc.png" },
  { id: "AF", name: "Blue Mosque of Mazar-i-Sharif", image: "/buildings/af.png" },
  { id: "BB", name: "Parliament Buildings", image: "/buildings/bb.png" },
  { id: "BF", name: "Grand Mosque of Bobo-Dioulasso", image: "/buildings/bf.png" },
  { id: "BH", name: "Bahrain World Trade Center", image: "/buildings/bh.png" },
  { id: "BJ", name: "Royal Palaces of Abomey", image: "/buildings/bj.png" },
  { id: "BW", name: "Three Dikgosi Monument", image: "/buildings/bw.png" },
  { id: "CM", name: "Reunification Monument", image: "/buildings/cm.png" },
  { id: "CR", name: "National Theatre of Costa Rica", image: "/buildings/cr.png" },
  { id: "CW", name: "Handelskade", image: "/buildings/cw.png" },
  { id: "DZ", name: "Martyrs' Memorial", image: "/buildings/dz.png" },
  { id: "FJ", name: "Sri Siva Subramaniya Temple", image: "/buildings/fj.png" },
  { id: "GM", name: "Arch 22", image: "/buildings/gm.png" },
  { id: "GY", name: "St. George's Cathedral", image: "/buildings/gy.png" },
  { id: "JM", name: "Devon House", image: "/buildings/jm.png" },
  { id: "KE", name: "Kenyatta International Convention Centre", image: "/buildings/ke.png" },
  { id: "KG", name: "Burana Tower", image: "/buildings/kg.png" },
  { id: "KN", name: "Brimstone Hill Fortress", image: "/buildings/kn.png" },
  { id: "KP", name: "Ryugyong Hotel", image: "/buildings/kp.png" },
  { id: "LA", name: "Pha That Luang", image: "/buildings/la.png" },
  { id: "LR", name: "Centennial Pavilion", image: "/buildings/lr.png" },
  { id: "LS", name: "Thaba Bosiu", image: "/buildings/ls.png" },
  { id: "MO", name: "Ruins of St. Paul's", image: "/buildings/mo.png" },
  { id: "MR", name: "Chinguetti Mosque", image: "/buildings/mr.png" },
  { id: "MV", name: "Grand Friday Mosque", image: "/buildings/mv.png" },
  { id: "MZ", name: "Maputo Railway Station", image: "/buildings/mz.png" },
  { id: "NA", name: "Christuskirche", image: "/buildings/na.png" },
  { id: "NE", name: "Grand Mosque of Niamey", image: "/buildings/ne.png" },
  { id: "NG", name: "National Mosque", image: "/buildings/ng.png" },
  { id: "PY", name: "Palacio de los López", image: "/buildings/py.png" },
  { id: "RW", name: "Kigali Convention Centre", image: "/buildings/rw.png" },
  { id: "SA", name: "Kingdom Centre Tower", image: "/buildings/sa.png" },
  { id: "SR", name: "Fort Zeelandia", image: "/buildings/sr.png" },
  { id: "SV", name: "Metropolitan Cathedral of San Salvador", image: "/buildings/sv.png" },
  { id: "TJ", name: "Ismoil Somoni Monument", image: "/buildings/tj.png" },
  { id: "TM", name: "Independence Monument", image: "/buildings/tm.png" },
  { id: "TN", name: "El Jem Amphitheater", image: "/buildings/tn.png" },
  { id: "TT", name: "Stollmeyer's Castle", image: "/buildings/tt.png" },
  { id: "TZ", name: "House of Wonders", image: "/buildings/tz.png" },
  { id: "UG", name: "Uganda National Mosque", image: "/buildings/ug.png" },
  { id: "VE", name: "Capitolio Nacional", image: "/buildings/ve.png" },
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(
  RULES.map((b) => [b.id, b]),
);

export const BUILDING_LIST: BuildingDef[] = RULES;

/** Curated accent-color swatches for the avatar background chip. Not gated by unlocks. */
export const AVATAR_COLORS: string[] = [
  "#64748b", // slate
  "#b45309", // amber
  "#15803d", // green
  "#0e7490", // cyan
  "#4338ca", // indigo
  "#a21caf", // fuchsia
  "#b91c1c", // red
  "#334155", // slate-dark
];

export const DEFAULT_AVATAR_COLOR = AVATAR_COLORS[0];

/** Country codes (from this game's results) that have a curated building AND were guessed correctly. */
export function evaluateBuildingUnlocks(results: readonly RoundResult[]): string[] {
  const hit = new Set<string>();
  for (const r of results) {
    if (r.countryCorrect && BUILDINGS[r.actual.countryCode]) {
      hit.add(r.actual.countryCode);
    }
  }
  return [...hit];
}

/** Given the building ids already owned, return only the newly unlocked ones from this game. */
export function newlyUnlockedBuildings(
  results: readonly RoundResult[],
  owned: readonly string[],
): string[] {
  const ownedSet = new Set(owned);
  return evaluateBuildingUnlocks(results).filter((id) => !ownedSet.has(id));
}
