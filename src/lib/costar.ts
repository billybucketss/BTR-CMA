import * as XLSX from "xlsx";
import type { Floorplan, Property } from "../types";

/**
 * Parses a CoStar multifamily export (.xlsx) into Property records.
 *
 * CoStar exports one row per property, with unit counts and asking rents
 * broken out by bedroom type. We map columns by their header text (not
 * position) so the parser survives the column shifts and blank cells that
 * appear in real CoStar exports.
 */

const STYLE_TO_TYPE: Record<string, string> = {
  townhome: "BTR TH",
  "single-family home": "BTR SF",
  "single family home": "BTR SF",
  duplex: "BTR SF",
  apartments: "APT",
  apartment: "APT",
};

function styleToType(style: unknown): string {
  const s = String(style || "").trim().toLowerCase();
  return STYLE_TO_TYPE[s] || (s ? "APT" : "APT");
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

/** Normalize a header cell for matching. */
function norm(h: unknown): string {
  return String(h || "").trim().toLowerCase();
}

export interface CostarParseResult {
  properties: Property[];
  skipped: number;
  warnings: string[];
}

export function parseCostarWorkbook(data: ArrayBuffer): CostarParseResult {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const warnings: string[] = [];
  if (!rows.length) return { properties: [], skipped: 0, warnings: ["Empty sheet"] };

  // Find header row: the one containing "Property Address" or "Property Name".
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].map(norm);
    if (cells.includes("property address") || cells.includes("property name")) {
      headerIdx = i;
      break;
    }
  }
  const header = rows[headerIdx].map(norm);

  const col = (name: string) => header.indexOf(name);
  const idx = {
    name: col("property name"),
    style: col("style"),
    address: col("property address"),
    city: col("city"),
    state: col("state"),
    submarket: col("submarket name"),
    status: col("building status"),
    year: col("year built"),
    studio: col("number of studio units"),
    br1: col("number of 1 bedroom units"),
    br2: col("number of 2 bedroom units"),
    br3: col("number of 3 bedroom units"),
    br4: col("number of 4 bedroom units"),
    avgSf: col("avg unit sf"),
    vacancy: col("vacancy %"),
    askUnit: col("avg asking/unit"),
    askSf: col("avg asking/sf"),
    rent1: col("one bedroom asking rent/unit"),
    rent2: col("two bedroom asking rent/unit"),
    rent3: col("three bedroom asking rent/unit"),
    rent4: col("four bedroom asking rent/unit"),
    concessions: col("avg concessions %"),
    amenities: col("amenities"),
    owner: col("owner name"),
    ownerContact: col("owner contact"),
    ownerCityStateZip: col("owner city state zip"),
    ownerPhone: col("owner phone"),
  };

  const get = (row: unknown[], i: number) => (i >= 0 ? row[i] : null);

  const properties: Property[] = [];
  let skipped = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const address = str(get(row, idx.address));
    let name = str(get(row, idx.name));

    // CoStar sometimes leaves Property Name blank — fall back to the address.
    if (!name && address) name = address;
    if (!name && !address) {
      skipped++;
      continue;
    }

    const avgSf = num(get(row, idx.avgSf));
    const zip = extractZip(str(get(row, idx.ownerCityStateZip)));

    // Build one floorplan per bedroom type that has a rent or a unit count.
    const buckets: Array<{ beds: number; rentCol: number; unitCol: number }> = [
      { beds: 1, rentCol: idx.rent1, unitCol: idx.br1 },
      { beds: 2, rentCol: idx.rent2, unitCol: idx.br2 },
      { beds: 3, rentCol: idx.rent3, unitCol: idx.br3 },
      { beds: 4, rentCol: idx.rent4, unitCol: idx.br4 },
    ];

    const floorplans: Floorplan[] = [];
    for (const b of buckets) {
      const rent = num(get(row, b.rentCol));
      const units = num(get(row, b.unitCol));
      if (rent == null && units == null) continue;
      floorplans.push({
        beds: b.beds,
        baths: null,
        sqft: avgSf, // CoStar gives a building-level average, not per-plan
        garage: null,
        subtype: null,
        rent,
        rent_psf: rent && avgSf ? Math.round((rent / avgSf) * 100) / 100 : null,
        units,
        flag: rent && avgSf ? "SF is building average" : null,
      });
    }

    // Fall back to a single blended floorplan if no per-bedroom detail exists.
    if (floorplans.length === 0) {
      const rent = num(get(row, idx.askUnit));
      if (rent != null || avgSf != null) {
        floorplans.push({
          beds: null,
          baths: null,
          sqft: avgSf,
          garage: null,
          subtype: null,
          rent,
          rent_psf: rent && avgSf ? Math.round((rent / avgSf) * 100) / 100 : null,
          units: null,
          flag: "Blended CoStar average",
        });
      }
    }

    const rents = floorplans.map((f) => f.rent).filter((x): x is number => x != null);
    const studioUnits = num(get(row, idx.studio)) || 0;
    const totalUnits = [idx.studio, idx.br1, idx.br2, idx.br3, idx.br4]
      .map((i) => num(get(row, i)) || 0)
      .reduce((a, b) => a + b, 0);

    properties.push({
      id: "cs-" + Date.now() + "-" + r,
      type: styleToType(get(row, idx.style)),
      name: name!,
      address,
      city: str(get(row, idx.city)),
      state: str(get(row, idx.state)),
      zip,
      unit_count: totalUnits > 0 ? String(totalUnits) : null,
      year_built: str(get(row, idx.year)),
      notes: buildNotes(row, idx, get, studioUnits),
      website: null,
      school_district: null,
      floorplans,
      rent_min: rents.length ? Math.min(...rents) : null,
      rent_max: rents.length ? Math.max(...rents) : null,
      source: "CoStar import",
      submarket: str(get(row, idx.submarket)),
      building_status: str(get(row, idx.status)),
      vacancy_pct: num(get(row, idx.vacancy)),
      avg_asking_unit: num(get(row, idx.askUnit)),
      avg_asking_sf: num(get(row, idx.askSf)),
      concessions_pct: num(get(row, idx.concessions)),
      amenities: str(get(row, idx.amenities)),
      owner_name: str(get(row, idx.owner)),
      owner_contact: str(get(row, idx.ownerContact)),
      owner_phone: str(get(row, idx.ownerPhone)),
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} row(s) skipped (no name or address).`);
  }

  return { properties, skipped, warnings };
}

function extractZip(cityStateZip: string | null): string | null {
  if (!cityStateZip) return null;
  const m = cityStateZip.match(/(\d{5})(?:-\d{4})?/);
  return m ? m[1] : null;
}

function buildNotes(
  row: unknown[],
  idx: Record<string, number>,
  get: (row: unknown[], i: number) => unknown,
  studioUnits: number
): string | null {
  const parts: string[] = [];
  const sub = str(get(row, idx.submarket));
  if (sub) parts.push(`Submarket: ${sub}.`);
  const vac = num(get(row, idx.vacancy));
  if (vac != null) parts.push(`Vacancy ${vac}%.`);
  const conc = num(get(row, idx.concessions));
  if (conc != null && conc > 0) parts.push(`Concessions ${conc}%.`);
  if (studioUnits > 0) parts.push(`${studioUnits} studio units.`);
  const am = str(get(row, idx.amenities));
  if (am) parts.push(`Amenities: ${am}.`);
  return parts.length ? parts.join(" ") : null;
}
