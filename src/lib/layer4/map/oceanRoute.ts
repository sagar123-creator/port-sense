import { densifyPath, pathLengthKm, type LatLng } from "@/lib/layer4/geo/haversine";

export type { LatLng };

export interface RoutePoint {
  readonly id?: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * Water waypoints on published Indian coastal / trunk sea lanes
 * (Kochi–Tuticorin–Chennai, west-coast corridor, Bay of Bengal).
 * Schematic — not live AIS. Stays in water (Adam’s Bridge is too shallow,
 * so west↔east still passes south of Galle, then up the Tamil coast).
 */
const WP = {
  jnptOff: [18.95, 71.85],
  ratnagiri: [16.9, 72.55],
  goaOff: [15.35, 73.35],
  mangaloreOff: [12.85, 74.35],
  cochinOff: [9.85, 75.85],
  alleppey: [9.35, 76.05],
  trivandrum: [8.25, 76.65],
  comorin: [7.75, 77.55],
  tuticorin: [8.65, 78.55],
  galle: [5.85, 80.2],
  eastSL: [8.05, 82.05],
  nagapattinam: [10.75, 80.25],
  pondy: [11.9, 80.05],
  chennaiOff: [13.1, 80.45],
  nellore: [14.45, 80.25],
  kakinada: [16.95, 82.55],
  vizagOff: [17.7, 83.55],
  paradip: [20.25, 86.85],
  kolkataMouth: [21.0, 88.05],
  laccadive: [10.5, 72.2],
  mumbaiWest: [18.7, 67.4],
  arabian: [16.6, 64.2],
  oman: [22.6, 60.4],
  hormuz: [25.15, 57.15],
  jebelApp: [25.2, 55.2],
  colomboOff: [6.7, 79.35],
  nicobar: [6.9, 93.6],
  malaccaW: [5.85, 95.55],
  malacca: [2.85, 100.55],
  singaporeApp: [1.15, 103.95],
  karimata: [2.4, 108.6],
  scs: [10.8, 112.8],
  luzonW: [17.6, 118.4],
  luzonStrait: [21.4, 121.6],
  philSea: [26.2, 136.5],
  wpac: [31.2, 155.0],
  dateline: [33.4, 175.8],
  epac: [34.1, -155.0],
  laApp: [33.65, -121.4],
  salalah: [14.7, 54.15],
  aden: [12.55, 47.4],
  bab: [13.15, 43.05],
  redSea: [20.4, 38.15],
  suezS: [27.5, 34.15],
  suezN: [31.85, 32.35],
  med: [36.2, 18.4],
  gibraltar: [35.9, -6.2],
  biscay: [45.4, -8.6],
  channel: [50.2, 0.2],
  rotterdamApp: [52.05, 3.7],
} as const satisfies Record<string, LatLng>;

function isWestCoast(lng: number, id?: string): boolean {
  if (id === "jnpt" || id === "cochin") return true;
  if (id === "chennai" || id === "vizag" || id === "kolkata") return false;
  return lng < 76.5;
}

function originOff(from: RoutePoint): LatLng {
  switch (from.id) {
    case "jnpt":
      return WP.jnptOff;
    case "cochin":
      return WP.cochinOff;
    case "chennai":
      return WP.chennaiOff;
    case "vizag":
      return WP.vizagOff;
    case "kolkata":
      return WP.kolkataMouth;
    default:
      return isWestCoast(from.lng, from.id) ? [from.lat, from.lng - 1.4] : [from.lat, from.lng + 1.4];
  }
}

function destKind(to: RoutePoint): "gulf" | "lax" | "sin" | "rtm" | "cmb" | "domestic" {
  const id = to.id ?? "";
  if (id === "AEJEA") return "gulf";
  if (id === "USGEN") return "lax";
  if (id === "SGSIN") return "sin";
  if (id === "NLRTM") return "rtm";
  if (id === "LKCMB") return "cmb";
  if (to.lng >= 50 && to.lng <= 60 && to.lat >= 22 && to.lat <= 28) return "gulf";
  if (to.lng < -100 && to.lat >= 30 && to.lat <= 36) return "lax";
  if (to.lng >= 103 && to.lng <= 105 && to.lat >= 1 && to.lat <= 2) return "sin";
  if (to.lat >= 50 && to.lng >= 3 && to.lng <= 6) return "rtm";
  if (to.lng >= 79.4 && to.lng <= 80.3 && to.lat >= 6.6 && to.lat <= 7.2) return "cmb";
  return "domestic";
}

const TO_GULF: LatLng[] = [WP.arabian, WP.oman, WP.hormuz, WP.jebelApp];
const TO_SUEZ: LatLng[] = [
  WP.salalah,
  WP.aden,
  WP.bab,
  WP.redSea,
  WP.suezS,
  WP.suezN,
  WP.med,
  WP.gibraltar,
  WP.biscay,
  WP.channel,
  WP.rotterdamApp,
];
const TO_MALACCA: LatLng[] = [WP.nicobar, WP.malaccaW, WP.malacca, WP.singaporeApp];
const TO_PACIFIC: LatLng[] = [
  WP.karimata,
  WP.scs,
  WP.luzonW,
  WP.luzonStrait,
  WP.philSea,
  WP.wpac,
  WP.dateline,
  WP.epac,
  WP.laApp,
];

/** Arabian Sea trunk toward Gulf / Suez — west, not down the peninsula. */
function westExit(from: RoutePoint): LatLng[] {
  const off = originOff(from);
  if (from.id === "jnpt") return [off, WP.mumbaiWest];
  return [off, WP.laccadive];
}

/** West-coast marine corridor, north → south. */
const WEST_LANE: readonly LatLng[] = [
  WP.jnptOff,
  WP.ratnagiri,
  WP.goaOff,
  WP.mangaloreOff,
  WP.cochinOff,
  WP.alleppey,
  WP.trivandrum,
  WP.comorin,
];

/** Bay of Bengal coastal corridor, north → south. */
const EAST_LANE: readonly LatLng[] = [
  WP.kolkataMouth,
  WP.paradip,
  WP.vizagOff,
  WP.kakinada,
  WP.nellore,
  WP.chennaiOff,
  WP.pondy,
  WP.nagapattinam,
];

function nearestIndex(lane: readonly LatLng[], point: LatLng): number {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lane.length; i += 1) {
    const wp = lane[i]!;
    const d = (wp[0] - point[0]) ** 2 + (wp[1] - point[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function alongLane(lane: readonly LatLng[], from: LatLng, to: LatLng): LatLng[] {
  const a = nearestIndex(lane, from);
  const b = nearestIndex(lane, to);
  if (a === b) return [lane[a]!];
  const step = a < b ? 1 : -1;
  const out: LatLng[] = [];
  for (let i = a; i !== b; i += step) out.push(lane[i]!);
  out.push(lane[b]!);
  return out;
}

function southAlongWestCoast(from: RoutePoint): LatLng[] {
  return alongLane(WEST_LANE, originOff(from), WP.comorin);
}

function westCoastApproach(to: RoutePoint): LatLng[] {
  return alongLane(WEST_LANE, WP.comorin, originOff(to));
}

/**
 * Kochi–Tuticorin–Chennai coastal corridor.
 * Adam’s Bridge is too shallow, so the lane still threads south of Galle,
 * then north along the Tamil coast — the density you see on marine traffic.
 */
function westToEastCoastal(from: RoutePoint): LatLng[] {
  return [
    ...southAlongWestCoast(from),
    WP.tuticorin,
    WP.galle,
    WP.eastSL,
    WP.nagapattinam,
    WP.pondy,
  ];
}

function eastToWestCoastal(from: RoutePoint): LatLng[] {
  const off = originOff(from);
  return [
    ...alongLane(EAST_LANE, off, WP.nagapattinam),
    WP.eastSL,
    WP.galle,
    WP.tuticorin,
    WP.comorin,
  ];
}

function domesticLane(from: RoutePoint, to: RoutePoint): LatLng[] {
  const start: LatLng = [from.lat, from.lng];
  const end: LatLng = [to.lat, to.lng];
  const fromWest = isWestCoast(from.lng, from.id);
  const toWest = isWestCoast(to.lng, to.id);
  const fromOff = originOff(from);
  const toOff = originOff(to);

  if (fromWest && toWest) {
    return [start, ...alongLane(WEST_LANE, fromOff, toOff), end];
  }
  if (!fromWest && !toWest) {
    return [start, ...alongLane(EAST_LANE, fromOff, toOff), end];
  }
  if (fromWest) {
    return [start, ...westToEastCoastal(from), toOff, end];
  }
  return [start, ...eastToWestCoastal(from), ...westCoastApproach(to), end];
}

/** Schematic water path from origin to destination. Stays at sea; not AIS. */
export function buildOceanRoute(from: RoutePoint, to: RoutePoint): LatLng[] {
  const start: LatLng = [from.lat, from.lng];
  const end: LatLng = [to.lat, to.lng];
  const kind = destKind(to);
  const west = isWestCoast(from.lng, from.id);

  if (kind === "gulf") {
    return west
      ? [start, ...westExit(from), ...TO_GULF, end]
      : [start, ...eastToWestCoastal(from), WP.laccadive, ...TO_GULF, end];
  }

  if (kind === "cmb") {
    return west
      ? [start, ...southAlongWestCoast(from), WP.colomboOff, end]
      : [start, originOff(from), WP.nagapattinam, WP.galle, WP.colomboOff, end];
  }

  if (kind === "sin") {
    return west
      ? [start, ...southAlongWestCoast(from), WP.tuticorin, WP.galle, ...TO_MALACCA, end]
      : [start, originOff(from), WP.nagapattinam, WP.eastSL, WP.galle, ...TO_MALACCA, end];
  }

  if (kind === "rtm") {
    return west
      ? [start, ...westExit(from), WP.arabian, ...TO_SUEZ, end]
      : [start, ...eastToWestCoastal(from), WP.laccadive, WP.arabian, ...TO_SUEZ, end];
  }

  if (kind === "lax") {
    return west
      ? [start, ...southAlongWestCoast(from), WP.tuticorin, WP.galle, ...TO_MALACCA, ...TO_PACIFIC, end]
      : [start, originOff(from), WP.nagapattinam, WP.eastSL, WP.galle, ...TO_MALACCA, ...TO_PACIFIC, end];
  }

  return domesticLane(from, to);
}

export function oceanRouteWithKm(
  from: RoutePoint,
  to: RoutePoint,
): { path: LatLng[]; km: number } {
  const path = densifyPath(buildOceanRoute(from, to), 28);
  return { path, km: Math.round(pathLengthKm(path)) };
}
