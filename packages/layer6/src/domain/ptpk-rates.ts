/**
 * ₹ per tonne-km slabs supplied with the inland calculator (team screenshots).
 * Not a transporter quote. Distance for these bands is great-circle km.
 */
export type PtpkMode = "road" | "rail_bulk" | "rail_parcel";

export const PTPK_SOURCE =
  "Team ₹/t-km slabs × great-circle km. Not GPS highway, not a booked invoice.";

const ROAD: ReadonlyArray<readonly [number, number]> = [
  [50, 7.14],
  [100, 6.77],
  [200, 4.51],
  [500, 3.31],
  [1000, 2.95],
  [1500, 3.07],
  [2500, 3.04],
  [Number.POSITIVE_INFINITY, 2.71],
];

const RAIL_BULK: ReadonlyArray<readonly [number, number]> = [
  [100, 3.84],
  [200, 2.77],
  [500, 2.22],
  [1000, 2.07],
  [1500, 1.88],
  [2500, 1.8],
  [Number.POSITIVE_INFINITY, 1.43],
];

const RAIL_PARCEL: ReadonlyArray<readonly [number, number]> = [
  [200, 30.71],
  [500, 16.13],
  [1000, 15.31],
  [1500, 11.42],
  [2500, 10.19],
  [Number.POSITIVE_INFINITY, 9.25],
];

function lookup(distKm: number, bands: ReadonlyArray<readonly [number, number]>): number {
  const km = Math.max(0, distKm);
  for (const [limit, rate] of bands) {
    if (km <= limit) return rate;
  }
  return bands[bands.length - 1]![1];
}

export function getPtpkRate(distKm: number, mode: PtpkMode): number {
  if (mode === "road") return lookup(distKm, ROAD);
  if (mode === "rail_bulk") return lookup(distKm, RAIL_BULK);
  return lookup(distKm, RAIL_PARCEL);
}
