import type { Property } from "../types";

export const TYPE_STYLE: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  "BTR TH": { label: "TH", bg: "#E7EFE9", fg: "#2E5D4B" },
  "BTR SF": { label: "SF", bg: "#EAEAF3", fg: "#42457A" },
  "BTR TH/SF": { label: "TH/SF", bg: "#F0EBE2", fg: "#8A6A2A" },
  APT: { label: "APT", bg: "#F2E7E7", fg: "#8A3A3A" },
};

export function typeStyle(t: string) {
  return TYPE_STYLE[t] || { label: t || "—", bg: "#ECECEC", fg: "#555" };
}

export const fmtRent = (n: number | null | undefined) =>
  n == null ? "—" : "$" + n.toLocaleString();

export const fmtPsf = (n: number | null | undefined) =>
  n == null ? "—" : "$" + n.toFixed(2);

export function avgPsfOf(p: Property): number | null {
  const x = p.floorplans.map((f) => f.rent_psf).filter((v): v is number => v != null);
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
}

/**
 * Builds a clean, geocodable address string without duplicating city/state/zip.
 * Many database rows already have the full "St, City, ST ZIP" in the address
 * field, so blindly appending city/state/zip again produces malformed input
 * that geocoders reject.
 */
export function buildAddress(p: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const addr = (p.address || "").trim();
  const city = (p.city || "").trim();
  const state = (p.state || "").trim();
  const zip = (p.zip || "").trim();

  // If the address already contains the city (case-insensitive), it's already full.
  if (addr && city && addr.toLowerCase().includes(city.toLowerCase())) {
    return addr;
  }
  // Otherwise assemble from the parts we have.
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? " " + zip : "");
  return [addr, cityStateZip].filter(Boolean).join(", ");
}

/** A coarse "City, ST" fallback for when the full street address won't geocode. */
export function cityStateFallback(p: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string | undefined {
  const city = (p.city || "").trim();
  const state = (p.state || "").trim();
  if (city && state) return `${city}, ${state}`;
  // Try to pull "City, ST" out of a full address string
  const addr = (p.address || "").trim();
  const m = addr.match(/,\s*([^,]+),\s*([A-Z]{2})/);
  if (m) return `${m[1].trim()}, ${m[2]}`;
  return undefined;
}
