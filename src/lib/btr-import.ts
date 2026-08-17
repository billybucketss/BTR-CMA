import * as XLSX from "xlsx";
import type { Floorplan, Property } from "../types";

/**
 * Parses a BTR comp database spreadsheet (.xlsx) in the "Chicago format":
 *   Type | Name | Address | Unit Count | Year Built | Unit Mix/Rents | Notes | Website
 *
 * The Unit Mix/Rents column contains multi-line text blobs like:
 *   "3BR/2.5BA 1,986sqft 2-car garage - $4,395\n3BR/2.5BA 2,090sqft 2-car garage - $4,995"
 *
 * Some rows have rents in a separate column (e.g. column 11) — we check for that too.
 */

export interface BtrParseResult {
  properties: Property[];
  errors: BtrParseError[];
  warnings: string[];
}

export interface BtrParseError {
  row: number;
  name: string;
  field: string;
  message: string;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[$,%\s]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function norm(h: unknown): string {
  return String(h || "").trim().toLowerCase();
}

function parseFloorplans(
  unitMix: string | null,
  separateRents: string | null
): { floorplans: Floorplan[]; errors: string[] } {
  const floorplans: Floorplan[] = [];
  const errors: string[] = [];

  if (!unitMix) return { floorplans, errors };

  const lines = unitMix
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sepRentLines = separateRents
    ? separateRents
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check for subtype prefix (TH, SF, APT)
    let subtype: string | null = null;
    const prefixMatch = line.match(/^(TH|SF|APT)\s+/i);
    if (prefixMatch) {
      subtype = prefixMatch[1].toUpperCase();
      line = line.slice(prefixMatch[0].length);
    }

    // Beds/Baths: "3BR/2.5BA" or "4/2.5BA" or "3BR/3.5BA"
    const bedMatch = line.match(/(\d+)\s*(?:BR|B)?\s*\/\s*([\d.]+)\s*BA/i);
    const beds = bedMatch ? parseInt(bedMatch[1]) : null;
    const baths = bedMatch ? parseFloat(bedMatch[2]) : null;

    if (beds == null) {
      errors.push(`Line "${line.slice(0, 40)}…": couldn't parse beds/baths`);
      continue;
    }

    // SqFt: "1,986sqft" or "1986 sq ft"
    const sqftMatch = line.match(/([\d,]{3,})\s*(?:sq\s*ft|sqft)/i);
    let sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, "")) : null;

    // Flag suspicious sqft
    let flag: string | null = null;
    if (sqft && sqft > 10000) {
      flag = "Check sqft — unusually large";
    }

    // Garage: "2-car garage" or "no garage" or "0 car garage"
    const garageMatch = line.match(/(\d+)[\s-]*car\s*garage/i);
    const noGarage = /no garage|0\s*car\s*garage/i.test(line);
    const garage = garageMatch
      ? `${garageMatch[1]}-car`
      : noGarage
      ? "none"
      : null;

    // Rent: inline "$4,395" or "- $N/A"
    let rent: number | null = null;
    const rentMatch = line.match(/\$\s*([\d,]+)/);
    const isNA = /\$\s*N\/?A/i.test(line);

    if (rentMatch && !isNA) {
      rent = parseInt(rentMatch[1].replace(/,/g, ""));
    }

    // Fall back to separate rent column
    if (rent == null && i < sepRentLines.length) {
      const sepMatch = sepRentLines[i].match(/\$?\s*([\d,]+)/);
      if (sepMatch) {
        rent = parseInt(sepMatch[1].replace(/,/g, ""));
      }
    }

    const rentPsf = rent && sqft ? Math.round((rent / sqft) * 100) / 100 : null;

    floorplans.push({
      beds,
      baths,
      sqft,
      garage,
      subtype,
      rent,
      rent_psf: rentPsf,
      flag,
    });
  }

  return { floorplans, errors };
}

function extractCityStateZip(address: string): {
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  // Match ", City, ST 12345" pattern
  const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
  if (m) {
    return { city: m[1].trim(), state: m[2], zip: m[3] || null };
  }
  return { city: null, state: null, zip: null };
}

export function parseBtrCompWorkbook(data: ArrayBuffer): BtrParseResult {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const warnings: string[] = [];
  const errors: BtrParseError[] = [];

  if (!rows.length) return { properties: [], errors, warnings: ["Empty sheet"] };

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].map(norm);
    if (cells.includes("name") && (cells.includes("address") || cells.includes("type"))) {
      headerIdx = i;
      break;
    }
  }
  const header = rows[headerIdx].map(norm);

  // Map columns by name
  const col = (name: string) => header.indexOf(name);
  const idx = {
    type: col("type"),
    name: col("name"),
    address: col("address"),
    unitCount: col("unit count"),
    yearBuilt: col("year built"),
    unitMix: col("unit mix/rents"),
    notes: col("notes"),
    website: col("website"),
  };

  // Check for required columns
  if (idx.name === -1 && idx.address === -1) {
    return {
      properties: [],
      errors,
      warnings: [
        'Could not find "Name" or "Address" columns. Make sure the header row contains these column names.',
      ],
    };
  }

  // Check for separate rent column (sometimes in column 11+)
  let rentColIdx = -1;
  for (let c = 8; c < header.length; c++) {
    // Look for a column that's not named but might have rent data
    if (header[c] === "" || header[c] === "none" || header[c] === "null") {
      // Check first data row to see if it looks like rents
      if (rows.length > headerIdx + 1) {
        const val = str(rows[headerIdx + 1][c]);
        if (val && /\$?\d/.test(val)) {
          rentColIdx = c;
          break;
        }
      }
    }
  }

  // Also look for school district column
  let schoolColIdx = -1;
  for (let c = 0; c < header.length; c++) {
    if (header[c].includes("school") || header[c].includes("district")) {
      schoolColIdx = c;
      break;
    }
  }

  const get = (row: unknown[], i: number) => (i >= 0 ? row[i] : null);
  const properties: Property[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const name = str(get(row, idx.name));
    const address = str(get(row, idx.address));

    if (!name && !address) {
      continue;
    }

    const propName = name || address || "Unknown";
    const rowNum = r + 1; // 1-indexed for user display

    // Parse address components
    const addrParts = address ? extractCityStateZip(address) : { city: null, state: null, zip: null };

    // Parse unit mix
    const unitMixText = str(get(row, idx.unitMix));
    const separateRents = rentColIdx >= 0 ? str(get(row, rentColIdx)) : null;
    const { floorplans, errors: fpErrors } = parseFloorplans(unitMixText, separateRents);

    // Log floorplan parse errors
    fpErrors.forEach((msg) => {
      errors.push({
        row: rowNum,
        name: propName,
        field: "Unit Mix",
        message: msg,
      });
    });

    // Validate required fields
    if (!name) {
      errors.push({ row: rowNum, name: propName, field: "Name", message: "Missing property name — used address instead" });
    }
    if (!address) {
      errors.push({ row: rowNum, name: propName, field: "Address", message: "Missing address" });
    }
    if (floorplans.length === 0 && unitMixText) {
      errors.push({ row: rowNum, name: propName, field: "Unit Mix", message: "Could not parse any floorplans from the unit mix text" });
    }
    if (floorplans.length === 0 && !unitMixText) {
      errors.push({ row: rowNum, name: propName, field: "Unit Mix", message: "No unit mix data" });
    }

    // Check for flagged sqft
    floorplans.forEach((fp, i) => {
      if (fp.flag) {
        errors.push({
          row: rowNum,
          name: propName,
          field: `Floorplan ${i + 1}`,
          message: fp.flag,
        });
      }
    });

    const rents = floorplans.map((f) => f.rent).filter((x): x is number => x != null);
    const type = str(get(row, idx.type));
    const unitCount = str(get(row, idx.unitCount));
    const yearBuilt = str(get(row, idx.yearBuilt));
    const website = str(get(row, idx.website));

    // Validate unit count
    if (unitCount) {
      const parsed = num(unitCount);
      if (parsed == null || parsed <= 0) {
        errors.push({ row: rowNum, name: propName, field: "Unit Count", message: `Unusual unit count: "${unitCount}"` });
      }
    }

    properties.push({
      id: "btr-" + Date.now() + "-" + r,
      type: type || "BTR TH",
      name: propName,
      address,
      city: addrParts.city,
      state: addrParts.state,
      zip: addrParts.zip,
      unit_count: unitCount,
      year_built: yearBuilt,
      notes: str(get(row, idx.notes)),
      website,
      school_district: schoolColIdx >= 0 ? str(get(row, schoolColIdx)) : null,
      floorplans,
      rent_min: rents.length ? Math.min(...rents) : null,
      rent_max: rents.length ? Math.max(...rents) : null,
      source: "BTR Comp Import",
    });
  }

  if (properties.length === 0) {
    warnings.push("No properties found in the spreadsheet.");
  }

  return { properties, errors, warnings };
}
