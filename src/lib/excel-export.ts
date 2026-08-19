import * as XLSX from "xlsx";

/* Types mirrored from CMABuilder */
interface SubjectFloorplan {
  name: string;
  beds: number;
  baths: number;
  sqft: number;
  garage: string;
  units: number;
  askingRent: number;
}
interface Subject {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  yearBuilt: string;
  totalUnits: number;
  floorplans: SubjectFloorplan[];
}
interface CompEntry {
  name: string;
  yearBuilt: string;
  sqft: number;
  baths: number;
  garage: string;
  units: number;
  askingRent: number;
  rentPsf: number;
  weight: number;
}
interface Bucket {
  beds: number;
  comps: CompEntry[];
}

function weightedAvg(comps: CompEntry[], field: "askingRent" | "rentPsf"): number | null {
  const tw = comps.reduce((s, c) => s + c.weight, 0);
  if (tw === 0) return null;
  return comps.reduce((s, c) => s + c[field] * c.weight, 0) / tw;
}

/**
 * Builds an .xlsx shaped like the Sonoma Trails CMA and triggers a download.
 * Uses SheetJS (already a dependency) so it runs entirely in the browser.
 */
export function exportCMAtoExcel(cmaName: string, subject: Subject, buckets: Bucket[]) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: CMA ──
  const rows: (string | number | null)[][] = [];

  // Title block
  rows.push([subject.name || cmaName || "CMA"]);
  rows.push([[subject.city, subject.state].filter(Boolean).join(", ")]);
  rows.push([subject.address || ""]);
  rows.push([`Year Built: ${subject.yearBuilt || "—"}    Total Units: ${subject.totalUnits || "—"}`]);
  rows.push([]);

  // Subject floorplans table
  rows.push(["SUBJECT PROPERTY"]);
  rows.push(["Floorplan", "Beds", "Baths", "SqFt", "Garage", "Units", "Asking Rent", "Rent/SF"]);
  subject.floorplans.forEach((fp) => {
    rows.push([
      fp.name || "",
      fp.beds,
      fp.baths,
      fp.sqft || null,
      fp.garage || "",
      fp.units || null,
      fp.askingRent || null,
      fp.askingRent && fp.sqft ? Math.round((fp.askingRent / fp.sqft) * 100) / 100 : null,
    ]);
  });
  rows.push([]);
  rows.push([]);

  // Per-bedroom comp tables
  buckets.forEach((bucket) => {
    if (bucket.comps.length === 0) return;
    rows.push([`${bucket.beds} Bedroom Comps`]);
    rows.push([
      "Comp #",
      "Weight %",
      "Comp Name",
      "Year Built",
      "SqFt",
      "Baths",
      "Garage",
      "# Units",
      "Asking Rent",
      "Rent/SF",
    ]);
    bucket.comps.forEach((c, i) => {
      rows.push([
        i + 1,
        c.weight,
        c.name,
        c.yearBuilt || "",
        c.sqft || null,
        c.baths || null,
        c.garage || "",
        c.units || null,
        c.askingRent || null,
        c.rentPsf || null,
      ]);
    });
    // AVG row
    const totalW = bucket.comps.reduce((s, c) => s + c.weight, 0);
    const wRent = weightedAvg(bucket.comps, "askingRent");
    const wPsf = weightedAvg(bucket.comps, "rentPsf");
    rows.push([
      "WTD AVG",
      totalW,
      "",
      "",
      "",
      "",
      "",
      "",
      wRent != null ? Math.round(wRent) : null,
      wPsf != null ? Math.round(wPsf * 100) / 100 : null,
    ]);
    rows.push([]);
    rows.push([]);
  });

  // Benchmark summary
  rows.push(["BENCHMARK SUMMARY"]);
  rows.push(["Beds", "Comps", "Wtd Avg Rent", "Wtd Avg $/SF", "Subject Rent", "Delta"]);
  buckets.forEach((bucket) => {
    if (bucket.comps.length === 0) return;
    const wRent = weightedAvg(bucket.comps, "askingRent");
    const wPsf = weightedAvg(bucket.comps, "rentPsf");
    const subFps = subject.floorplans.filter((fp) => fp.beds === bucket.beds);
    const subRent =
      subFps.length > 0 ? subFps.reduce((s, fp) => s + fp.askingRent, 0) / subFps.length : null;
    const delta = wRent != null && subRent != null ? subRent - wRent : null;
    rows.push([
      `${bucket.beds}BR`,
      bucket.comps.length,
      wRent != null ? Math.round(wRent) : null,
      wPsf != null ? Math.round(wPsf * 100) / 100 : null,
      subRent != null ? Math.round(subRent) : null,
      delta != null ? Math.round(delta) : null,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 10 }, { wch: 10 }, { wch: 28 }, { wch: 11 }, { wch: 9 },
    { wch: 8 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 9 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "CMA");

  // ── Sheet 2: Address Map (flat comp list) ──
  const mapRows: (string | number | null)[][] = [];
  mapRows.push(["Type", "Name", "Address", "City", "State", "Beds", "Baths", "SqFt", "Units", "Asking Rent", "Rent/SF"]);
  // Subject first
  subject.floorplans.forEach((fp) => {
    mapRows.push([
      "SUBJECT", subject.name, subject.address, subject.city, subject.state,
      fp.beds, fp.baths, fp.sqft || null, fp.units || null, fp.askingRent || null,
      fp.askingRent && fp.sqft ? Math.round((fp.askingRent / fp.sqft) * 100) / 100 : null,
    ]);
  });
  buckets.forEach((bucket) => {
    bucket.comps.forEach((c) => {
      mapRows.push([
        "COMP", c.name, "", "", "", bucket.beds, c.baths || null, c.sqft || null,
        c.units || null, c.askingRent || null, c.rentPsf || null,
      ]);
    });
  });
  const mapWs = XLSX.utils.aoa_to_sheet(mapRows);
  mapWs["!cols"] = [
    { wch: 10 }, { wch: 26 }, { wch: 28 }, { wch: 16 }, { wch: 7 },
    { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 9 },
  ];
  XLSX.utils.book_append_sheet(wb, mapWs, "Address Map");

  // Trigger download
  const safeName = (cmaName || subject.name || "CMA").replace(/[^a-z0-9]/gi, "_");
  XLSX.writeFile(wb, `${safeName}_CMA.xlsx`);
}
