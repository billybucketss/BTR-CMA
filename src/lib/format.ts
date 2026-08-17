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
