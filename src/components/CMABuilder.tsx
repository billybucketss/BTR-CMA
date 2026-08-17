import { useEffect, useMemo, useState } from "react";
import type { Floorplan, Property } from "../types";
import { buildAddress, cityStateFallback, fmtPsf, fmtRent, typeStyle } from "../lib/format";
import CMAMap from "./CMAMap";
import type { MapPin } from "./CMAMap";
import { useCMAs } from "../lib/cma-store";
import type { SavedCMA } from "../lib/cma-store";

/* ── Types ── */

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
  propertyId: string;
  floorplanIdx: number;
  name: string;
  yearBuilt: string;
  sqft: number;
  baths: number;
  garage: string;
  units: number;
  unitsAvail: number;
  askingRent: number;
  rentPsf: number;
  weight: number;
}

interface BedroomBucket {
  beds: number;
  comps: CompEntry[];
}

/* ── Helpers ── */

const BLANK_SUBJECT: Subject = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  yearBuilt: "",
  totalUnits: 0,
  floorplans: [],
};

function blankFp(): SubjectFloorplan {
  return { name: "", beds: 3, baths: 2.5, sqft: 0, garage: "2-car", units: 0, askingRent: 0 };
}

function weightedAvg(comps: CompEntry[], field: "askingRent" | "rentPsf"): number | null {
  const totalWeight = comps.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return null;
  return comps.reduce((s, c) => s + c[field] * c.weight, 0) / totalWeight;
}

function straightAvg(comps: CompEntry[], field: "askingRent" | "rentPsf"): number | null {
  const valid = comps.filter((c) => c[field] > 0);
  if (!valid.length) return null;
  return valid.reduce((s, c) => s + c[field], 0) / valid.length;
}

/* ── Comp Picker Modal ── */

function CompPicker({
  properties,
  beds,
  existingIds,
  onAdd,
  onClose,
}: {
  properties: Property[];
  beds: number;
  existingIds: Set<string>;
  onAdd: (entries: CompEntry[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Find all floorplans matching bedroom count across all properties
  const candidates = useMemo(() => {
    const out: Array<{ prop: Property; fp: Floorplan; fpIdx: number; key: string }> = [];
    properties.forEach((p) => {
      p.floorplans.forEach((fp, idx) => {
        if (fp.beds !== beds) return;
        const key = p.id + "-" + idx;
        if (existingIds.has(key)) return;
        out.push({ prop: p, fp, fpIdx: idx, key });
      });
    });
    return out;
  }, [properties, beds, existingIds]);

  const filtered = useMemo(() => {
    if (!q) return candidates;
    const lower = q.toLowerCase();
    return candidates.filter(
      (c) =>
        c.prop.name.toLowerCase().includes(lower) ||
        (c.prop.city || "").toLowerCase().includes(lower) ||
        (c.prop.address || "").toLowerCase().includes(lower)
    );
  }, [candidates, q]);

  const toggle = (key: string) => {
    const n = new Set(selected);
    n.has(key) ? n.delete(key) : n.add(key);
    setSelected(n);
  };

  const handleAdd = () => {
    const entries: CompEntry[] = [];
    selected.forEach((key) => {
      const c = candidates.find((x) => x.key === key);
      if (!c) return;
      entries.push({
        propertyId: c.prop.id,
        floorplanIdx: c.fpIdx,
        name: c.prop.name,
        yearBuilt: c.prop.year_built || "",
        sqft: c.fp.sqft || 0,
        baths: c.fp.baths || 0,
        garage: c.fp.garage || "",
        units: (c.fp as any).units || 0,
        unitsAvail: 0,
        askingRent: c.fp.rent || 0,
        rentPsf: c.fp.rent_psf || 0,
        weight: 0,
      });
    });
    onAdd(entries);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        className="w-full max-w-[620px] rounded-2xl bg-paper p-6 shadow-2xl"
      >
        <div className="mb-1 font-display text-lg font-semibold">
          Add {beds}BR comps from your database
        </div>
        <p className="mb-3 mt-0 text-[12.5px] text-[#8A897F]">
          Select properties with {beds}-bedroom floorplans to add as comps.
        </p>
        <input
          value={q}
          onChange={(e: any) => setQ(e.target.value)}
          placeholder="Search by name, city, address…"
          className="mb-3 w-full rounded-lg border border-[#E0DCD2] bg-white px-3 py-2 text-[13px]"
        />
        <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-[#8A897F]">
              No {beds}BR floorplans found in your database.
            </div>
          )}
          {filtered.map((c) => {
            const ts = typeStyle(c.prop.type);
            const checked = selected.has(c.key);
            return (
              <div
                key={c.key}
                onClick={() => toggle(c.key)}
                className={`flex cursor-pointer items-center gap-3 border-b border-[#F0EEE7] px-3 py-2.5 last:border-b-0 ${
                  checked ? "bg-[#F0F5F1]" : "hover:bg-[#FCFBF8]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.key)}
                  className="h-4 w-4 accent-pine"
                />
                <div
                  className="flex h-7 w-8 items-center justify-center rounded font-display text-[9px] font-bold"
                  style={{ background: ts.bg, color: ts.fg }}
                >
                  {ts.label}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{c.prop.name}</div>
                  <div className="text-[11px] text-[#8A897F]">
                    {c.fp.beds}BR/{c.fp.baths}BA · {c.fp.sqft ? c.fp.sqft.toLocaleString() + " sf" : "—"} ·{" "}
                    {c.prop.city}, {c.prop.state}
                  </div>
                </div>
                <div className="whitespace-nowrap text-right font-mono text-[12px] text-ink">
                  {fmtRent(c.fp.rent)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#DDD9CF] px-4 py-2 text-[13px] text-[#5A594F]"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selected.size === 0}
            className="rounded-lg border-none bg-pine px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            Add {selected.size} comp{selected.size !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bedroom Bucket Section ── */

function BucketSection({
  bucket,
  properties,
  onUpdate,
  onAddComps,
  onRemoveComp,
}: {
  bucket: BedroomBucket;
  properties: Property[];
  onUpdate: (comps: CompEntry[]) => void;
  onAddComps: () => void;
  onRemoveComp: (idx: number) => void;
}) {
  const totalWeight = bucket.comps.reduce((s, c) => s + c.weight, 0);
  const wAvgRent = weightedAvg(bucket.comps, "askingRent");
  const wAvgPsf = weightedAvg(bucket.comps, "rentPsf");
  const sAvgRent = straightAvg(bucket.comps, "askingRent");

  const setWeight = (i: number, val: string) => {
    const n = [...bucket.comps];
    n[i] = { ...n[i], weight: Number(val) || 0 };
    onUpdate(n);
  };

  const weightOk = totalWeight === 100 || bucket.comps.length === 0;

  return (
    <div className="mb-6 rounded-xl border border-line bg-paper">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h3 className="m-0 font-display text-[15px] font-semibold text-ink">
          {bucket.beds} Bedroom Comps
        </h3>
        <button
          onClick={onAddComps}
          className="rounded-md border border-[#CFE0D4] px-2.5 py-1 text-xs font-medium text-pine"
        >
          + Add comps from database
        </button>
      </div>

      {bucket.comps.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-[#8A897F]">
          No comps added yet. Pull them from your database.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[40px_1fr_60px_70px_70px_80px_80px_80px_36px] bg-[#F5F3EC] px-4 py-[7px] text-[10px] font-semibold uppercase tracking-wide text-[#8A897F]">
                <span>#</span>
                <span>Comp Name</span>
                <span className="text-right">Wt%</span>
                <span className="text-right">Year</span>
                <span className="text-right">SqFt</span>
                <span className="text-right">Garage</span>
                <span className="text-right">Rent</span>
                <span className="text-right">$/SF</span>
                <span></span>
              </div>
              {bucket.comps.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[40px_1fr_60px_70px_70px_80px_80px_80px_36px] items-center border-t border-[#F0EEE7] px-4 py-2 font-mono text-[12.5px] text-[#2A2C29]"
                >
                  <span className="text-[#8A897F]">{i + 1}</span>
                  <span className="truncate pr-2 font-body text-[13px] font-medium">{c.name}</span>
                  <input
                    type="number"
                    value={c.weight || ""}
                    onChange={(e: any) => setWeight(i, e.target.value)}
                    className="w-14 rounded border border-[#DDD9CF] px-1.5 py-1 text-right text-xs"
                    min={0}
                    max={100}
                  />
                  <span className="text-right text-[#8A897F]">{c.yearBuilt || "—"}</span>
                  <span className="text-right">{c.sqft ? c.sqft.toLocaleString() : "—"}</span>
                  <span className="text-right text-[#8A897F]">{c.garage || "—"}</span>
                  <span className="text-right">{fmtRent(c.askingRent || null)}</span>
                  <span className="text-right text-pine">{fmtPsf(c.rentPsf || null)}</span>
                  <button
                    onClick={() => onRemoveComp(i)}
                    className="border-none bg-transparent text-sm text-[#8A3A3A]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary row */}
          <div className="border-t border-line bg-[#F9F8F4] px-4 py-3">
            <div className="grid grid-cols-[40px_1fr_60px_70px_70px_80px_80px_80px_36px] items-center font-mono text-[12.5px]">
              <span></span>
              <span className="font-body text-[12px] font-semibold uppercase text-[#8A897F]">
                Weighted Avg
              </span>
              <span
                className={`text-right text-xs font-bold ${weightOk ? "text-pine" : "text-[#B45309]"}`}
              >
                {totalWeight}%
              </span>
              <span></span>
              <span></span>
              <span></span>
              <span className="text-right font-semibold text-ink">
                {wAvgRent != null ? fmtRent(Math.round(wAvgRent)) : "—"}
              </span>
              <span className="text-right font-semibold text-pine">
                {wAvgPsf != null ? fmtPsf(wAvgPsf) : "—"}
              </span>
              <span></span>
            </div>
            {!weightOk && (
              <div className="mt-1 text-[11px] text-[#B45309]">
                Weights must total 100% (currently {totalWeight}%)
              </div>
            )}
            {sAvgRent != null && wAvgRent != null && Math.round(sAvgRent) !== Math.round(wAvgRent) && (
              <div className="mt-1 text-[11px] text-[#8A897F]">
                Straight avg: {fmtRent(Math.round(sAvgRent))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main CMA Builder ── */

export default function CMABuilder({
  properties,
  addProperty,
}: {
  properties: Property[];
  addProperty: (p: Omit<Property, "id">) => void;
}) {
  const cmaStore = useCMAs();
  const [subject, setSubject] = useState<Subject>(BLANK_SUBJECT);
  const [buckets, setBuckets] = useState<BedroomBucket[]>([
    { beds: 2, comps: [] },
    { beds: 3, comps: [] },
    { beds: 4, comps: [] },
  ]);
  const [pickerBeds, setPickerBeds] = useState<number | null>(null);
  const [cmaName, setCmaName] = useState("");
  const [showSubjectForm, setShowSubjectForm] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [currentCmaId, setCurrentCmaId] = useState<string | null>(null);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Load a saved CMA into the builder
  const loadCMA = (cma: SavedCMA) => {
    setCmaName(cma.name);
    setSubject(cma.subject);
    setBuckets(cma.buckets);
    setCurrentCmaId(cma.id);
    setShowLoadPanel(false);
    setShowSubjectForm(true);
  };

  // Start a fresh CMA
  const newCMA = () => {
    if (
      (cmaName || subject.name || buckets.some((b) => b.comps.length > 0)) &&
      !confirm("Start a new CMA? Any unsaved changes will be lost.")
    ) {
      return;
    }
    setCmaName("");
    setSubject(BLANK_SUBJECT);
    setBuckets([
      { beds: 2, comps: [] },
      { beds: 3, comps: [] },
      { beds: 4, comps: [] },
    ]);
    setCurrentCmaId(null);
    setShowSubjectForm(true);
  };

  const handleSave = () => {
    if (!cmaName.trim()) {
      alert("Give your CMA a name before saving.");
      return;
    }
    const id = cmaStore.saveCMA(
      { name: cmaName.trim(), subject, buckets },
      currentCmaId || undefined
    );
    setCurrentCmaId(id);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const addSubjectToDatabase = () => {
    if (!subject.name.trim()) {
      alert("Your subject needs a name before adding it to the database.");
      return;
    }
    const floorplans: Floorplan[] = subject.floorplans.map((fp) => ({
      beds: fp.beds || null,
      baths: fp.baths || null,
      sqft: fp.sqft || null,
      garage: fp.garage || null,
      subtype: null,
      rent: fp.askingRent || null,
      rent_psf: fp.askingRent && fp.sqft ? Math.round((fp.askingRent / fp.sqft) * 100) / 100 : null,
      units: fp.units || null,
    }));
    const rents = floorplans.map((f) => f.rent).filter((x): x is number => x != null);
    addProperty({
      type: "BTR TH",
      name: subject.name.trim(),
      address: subject.address || null,
      city: subject.city || null,
      state: subject.state || null,
      zip: subject.zip || null,
      unit_count: subject.totalUnits ? String(subject.totalUnits) : null,
      year_built: subject.yearBuilt || null,
      notes: "Added from CMA Builder as subject property.",
      website: null,
      school_district: null,
      floorplans,
      rent_min: rents.length ? Math.min(...rents) : null,
      rent_max: rents.length ? Math.max(...rents) : null,
      source: "CMA subject",
    });
    alert(`"${subject.name}" added to your comp database.`);
  };

  const setSub = (k: keyof Subject, v: any) => setSubject((s) => ({ ...s, [k]: v }));

  const addSubjectFp = () =>
    setSubject((s) => ({ ...s, floorplans: [...s.floorplans, blankFp()] }));
  const setSubFp = (i: number, k: keyof SubjectFloorplan, v: any) =>
    setSubject((s) => ({
      ...s,
      floorplans: s.floorplans.map((fp, j) => (j === i ? { ...fp, [k]: v } : fp)),
    }));
  const rmSubFp = (i: number) =>
    setSubject((s) => ({ ...s, floorplans: s.floorplans.filter((_, j) => j !== i) }));

  const updateBucket = (beds: number, comps: CompEntry[]) =>
    setBuckets((b) => b.map((bk) => (bk.beds === beds ? { ...bk, comps } : bk)));

  const addCompsToBucket = (beds: number, entries: CompEntry[]) => {
    setBuckets((b) =>
      b.map((bk) => (bk.beds === beds ? { ...bk, comps: [...bk.comps, ...entries] } : bk))
    );
    setPickerBeds(null);
  };

  const removeComp = (beds: number, idx: number) =>
    setBuckets((b) =>
      b.map((bk) =>
        bk.beds === beds ? { ...bk, comps: bk.comps.filter((_, i) => i !== idx) } : bk
      )
    );

  const addBucket = () => {
    const maxBeds = Math.max(...buckets.map((b) => b.beds), 1);
    setBuckets([...buckets, { beds: maxBeds + 1, comps: [] }]);
  };

  // Summary across all buckets
  const summary = useMemo(() => {
    return buckets.map((bk) => {
      const wRent = weightedAvg(bk.comps, "askingRent");
      const wPsf = weightedAvg(bk.comps, "rentPsf");
      const subFps = subject.floorplans.filter((fp) => fp.beds === bk.beds);
      const subAvgRent =
        subFps.length > 0
          ? subFps.reduce((s, fp) => s + fp.askingRent, 0) / subFps.length
          : null;
      return {
        beds: bk.beds,
        compCount: bk.comps.length,
        weightedRent: wRent,
        weightedPsf: wPsf,
        subjectRent: subAvgRent,
        delta: wRent != null && subAvgRent != null ? subAvgRent - wRent : null,
      };
    });
  }, [buckets, subject]);

  const existingIds = (beds: number) => {
    const bk = buckets.find((b) => b.beds === beds);
    return new Set((bk?.comps || []).map((c) => c.propertyId + "-" + c.floorplanIdx));
  };

  const mapPins = useMemo((): MapPin[] => {
    const pins: MapPin[] = [];
    // Subject
    if (subject.name && (subject.address || subject.city)) {
      const avgRent =
        subject.floorplans.length > 0
          ? Math.round(
              subject.floorplans.reduce((s, fp) => s + fp.askingRent, 0) / subject.floorplans.length
            )
          : null;
      pins.push({
        label: subject.name,
        address: buildAddress(subject),
        fallback: cityStateFallback(subject),
        detail: avgRent ? `Asking: $${avgRent.toLocaleString()}` : undefined,
        isSubject: true,
      });
    }
    // Comps (deduplicate by property name + address)
    const seen = new Set<string>();
    buckets.forEach((bk) => {
      bk.comps.forEach((c) => {
        const prop = properties.find((p) => p.id === c.propertyId);
        if (!prop || (!prop.address && !prop.city)) return;
        const key = prop.name + "|" + (prop.address || "");
        if (seen.has(key)) return;
        seen.add(key);
        pins.push({
          label: prop.name,
          address: buildAddress(prop),
          fallback: cityStateFallback(prop),
          lat: prop.lat,
          lng: prop.lng,
          detail: c.askingRent ? `${bk.beds}BR: $${c.askingRent.toLocaleString()}` : undefined,
          isSubject: false,
        });
      });
    });
    return pins;
  }, [subject, buckets, properties]);

  const canMap = mapPins.length >= 2;

  const inp =
    "w-full rounded-md border border-[#DDD9CF] bg-white px-2.5 py-2 text-[13px] font-body";
  const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8A897F]";

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-paper px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-[22px] w-2 rounded-sm bg-pine" />
              <h1 className="m-0 font-display text-[21px] font-bold tracking-tight">CMA Builder</h1>
            </div>
            <p className="ml-[18px] mt-1 text-[12.5px] text-[#8A897F]">
              Set your subject property, pull comps by bedroom, assign weights, and benchmark rents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLoadPanel(true)}
              className="rounded-lg border border-[#E0DCD2] bg-white px-3.5 py-2 text-[13px] font-medium text-[#5A594F]"
            >
              Open{cmaStore.cmas.length > 0 ? ` (${cmaStore.cmas.length})` : ""}
            </button>
            <button
              onClick={newCMA}
              className="rounded-lg border border-[#E0DCD2] bg-white px-3.5 py-2 text-[13px] font-medium text-[#5A594F]"
            >
              New
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg border-none bg-pine px-4 py-2 text-[13px] font-medium text-white"
            >
              {savedFlash ? "Saved ✓" : currentCmaId ? "Save" : "Save CMA"}
            </button>
            <button
              onClick={() => setShowMap(true)}
              disabled={!canMap}
              className="rounded-lg border border-[#CFE0D4] bg-white px-4 py-2 text-[13px] font-medium text-pine disabled:opacity-40"
            >
              Generate Map
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[980px] px-6 py-6">
        {/* CMA Name */}
        <div className="mb-6">
          <label className={lbl}>CMA Name</label>
          <input
            className={`${inp} max-w-[400px]`}
            placeholder="e.g. Sonoma Trails Phase 2 — BTR CMA"
            value={cmaName}
            onChange={(e: any) => setCmaName(e.target.value)}
          />
        </div>

        {/* Subject Property */}
        <div className="mb-6 rounded-xl border border-line bg-paper">
          <div
            className="flex cursor-pointer items-center justify-between border-b border-line px-5 py-3"
            onClick={() => setShowSubjectForm(!showSubjectForm)}
          >
            <h2 className="m-0 font-display text-[16px] font-semibold text-ink">
              Subject Property
              {subject.name && (
                <span className="ml-2 text-[13px] font-normal text-[#8A897F]">
                  — {subject.name}
                </span>
              )}
            </h2>
            <span className="text-xs text-[#8A897F]">{showSubjectForm ? "▲" : "▼"}</span>
          </div>

          {showSubjectForm && (
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Property Name</label>
                  <input
                    className={inp}
                    value={subject.name}
                    onChange={(e: any) => setSub("name", e.target.value)}
                    placeholder="e.g. Sonoma Trails Phase 2"
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Address</label>
                  <input
                    className={inp}
                    value={subject.address}
                    onChange={(e: any) => setSub("address", e.target.value)}
                  />
                </div>
                <div>
                  <label className={lbl}>City</label>
                  <input
                    className={inp}
                    value={subject.city}
                    onChange={(e: any) => setSub("city", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>State</label>
                    <input
                      className={inp}
                      value={subject.state}
                      onChange={(e: any) => setSub("state", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Zip</label>
                    <input
                      className={inp}
                      value={subject.zip}
                      onChange={(e: any) => setSub("zip", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Year Built</label>
                  <input
                    className={inp}
                    value={subject.yearBuilt}
                    onChange={(e: any) => setSub("yearBuilt", e.target.value)}
                  />
                </div>
                <div>
                  <label className={lbl}>Total Units</label>
                  <input
                    className={inp}
                    type="number"
                    value={subject.totalUnits || ""}
                    onChange={(e: any) => setSub("totalUnits", Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Subject floorplans */}
              <div className="mb-2 mt-5 flex items-center justify-between">
                <span className={lbl}>Subject Floorplans</span>
                <button
                  onClick={addSubjectFp}
                  className="rounded-md border border-[#CFE0D4] px-2.5 py-1 text-xs text-pine"
                >
                  + Add floorplan
                </button>
              </div>
              {subject.floorplans.length === 0 && (
                <div className="mb-3 text-[12.5px] text-[#8A897F]">
                  Add your subject's floorplans so the benchmark can compare against them.
                </div>
              )}
              {subject.floorplans.map((fp, i) => (
                <div
                  key={i}
                  className="mb-2 grid grid-cols-[80px_50px_50px_70px_70px_70px_80px_24px] items-center gap-1.5"
                >
                  <input
                    placeholder="Name"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.name}
                    onChange={(e: any) => setSubFp(i, "name", e.target.value)}
                  />
                  <input
                    placeholder="BR"
                    type="number"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.beds}
                    onChange={(e: any) => setSubFp(i, "beds", Number(e.target.value) || 0)}
                  />
                  <input
                    placeholder="BA"
                    type="number"
                    step="0.5"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.baths}
                    onChange={(e: any) => setSubFp(i, "baths", Number(e.target.value) || 0)}
                  />
                  <input
                    placeholder="SqFt"
                    type="number"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.sqft || ""}
                    onChange={(e: any) => setSubFp(i, "sqft", Number(e.target.value) || 0)}
                  />
                  <input
                    placeholder="Units"
                    type="number"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.units || ""}
                    onChange={(e: any) => setSubFp(i, "units", Number(e.target.value) || 0)}
                  />
                  <input
                    placeholder="Garage"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.garage}
                    onChange={(e: any) => setSubFp(i, "garage", e.target.value)}
                  />
                  <input
                    placeholder="Rent"
                    type="number"
                    className={`${inp} px-1.5 py-1.5 text-xs`}
                    value={fp.askingRent || ""}
                    onChange={(e: any) => setSubFp(i, "askingRent", Number(e.target.value) || 0)}
                  />
                  <button
                    onClick={() => rmSubFp(i)}
                    className="border-none bg-transparent text-base text-[#8A3A3A]"
                  >
                    ×
                  </button>
                </div>
              ))}

              {subject.name && (
                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <button
                    onClick={addSubjectToDatabase}
                    className="rounded-lg border border-[#CFE0D4] bg-white px-3.5 py-2 text-[13px] font-medium text-pine"
                  >
                    + Add subject to comp database
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bedroom Buckets */}
        {buckets.map((bk) => (
          <BucketSection
            key={bk.beds}
            bucket={bk}
            properties={properties}
            onUpdate={(comps) => updateBucket(bk.beds, comps)}
            onAddComps={() => setPickerBeds(bk.beds)}
            onRemoveComp={(idx) => removeComp(bk.beds, idx)}
          />
        ))}

        <button
          onClick={addBucket}
          className="mb-8 rounded-lg border border-dashed border-[#D8D4C9] px-4 py-2 text-[13px] text-[#8A897F]"
        >
          + Add another bedroom bucket
        </button>

        {/* Summary */}
        {summary.some((s) => s.compCount > 0) && (
          <div className="mb-10 rounded-xl border border-line bg-paper">
            <div className="border-b border-line px-5 py-3">
              <h2 className="m-0 font-display text-[16px] font-semibold text-ink">
                Benchmark Summary
              </h2>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[80px_80px_100px_100px_100px_100px] bg-[#F5F3EC] px-5 py-[7px] text-[10px] font-semibold uppercase tracking-wide text-[#8A897F]">
                  <span>Beds</span>
                  <span className="text-right">Comps</span>
                  <span className="text-right">Wtd Avg Rent</span>
                  <span className="text-right">Wtd Avg $/SF</span>
                  <span className="text-right">Subject Rent</span>
                  <span className="text-right">Delta</span>
                </div>
                {summary.map((s) => (
                  <div
                    key={s.beds}
                    className="grid grid-cols-[80px_80px_100px_100px_100px_100px] items-center border-t border-[#F0EEE7] px-5 py-2.5 font-mono text-[13px] text-[#2A2C29]"
                  >
                    <span className="font-body font-medium">{s.beds}BR</span>
                    <span className="text-right text-[#8A897F]">{s.compCount}</span>
                    <span className="text-right font-medium">
                      {s.weightedRent != null ? fmtRent(Math.round(s.weightedRent)) : "—"}
                    </span>
                    <span className="text-right text-pine">
                      {s.weightedPsf != null ? fmtPsf(s.weightedPsf) : "—"}
                    </span>
                    <span className="text-right">
                      {s.subjectRent != null ? fmtRent(Math.round(s.subjectRent)) : "—"}
                    </span>
                    <span
                      className={`text-right font-medium ${
                        s.delta == null
                          ? "text-[#8A897F]"
                          : s.delta >= 0
                          ? "text-pine"
                          : "text-[#8A3A3A]"
                      }`}
                    >
                      {s.delta != null
                        ? (s.delta >= 0 ? "+$" : "-$") + Math.abs(Math.round(s.delta)).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comp Picker Modal */}
      {pickerBeds != null && (
        <CompPicker
          properties={properties}
          beds={pickerBeds}
          existingIds={existingIds(pickerBeds)}
          onAdd={(entries) => addCompsToBucket(pickerBeds, entries)}
          onClose={() => setPickerBeds(null)}
        />
      )}

      {/* Map Modal */}
      {showMap && <CMAMap pins={mapPins} onClose={() => setShowMap(false)} />}

      {/* Open CMA Panel */}
      {showLoadPanel && (
        <div
          onClick={() => setShowLoadPanel(false)}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"
        >
          <div
            onClick={(e: any) => e.stopPropagation()}
            className="w-full max-w-[560px] rounded-2xl bg-paper p-6 shadow-2xl"
          >
            <div className="mb-1 font-display text-lg font-semibold">Open a saved CMA</div>
            <p className="mb-4 mt-0 text-[12.5px] text-[#8A897F]">
              Your saved CMAs are stored in this browser.
            </p>
            {cmaStore.cmas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D8D4C9] px-6 py-10 text-center">
                <div className="text-[13.5px] text-[#5A594F]">No saved CMAs yet.</div>
                <div className="mt-1 text-[12px] text-[#8A897F]">
                  Build one and hit Save to see it here.
                </div>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-auto rounded-xl border border-line">
                {cmaStore.cmas.map((cma, i) => {
                  const compCount = cma.buckets.reduce((s, b) => s + b.comps.length, 0);
                  return (
                    <div
                      key={cma.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        i ? "border-t border-line" : ""
                      } ${cma.id === currentCmaId ? "bg-[#F0F5F1]" : ""}`}
                    >
                      <button
                        onClick={() => loadCMA(cma)}
                        className="min-w-0 flex-1 border-none bg-transparent p-0 text-left"
                      >
                        <div className="truncate text-[13.5px] font-medium text-ink">
                          {cma.name}
                          {cma.id === currentCmaId && (
                            <span className="ml-2 text-[11px] font-normal text-pine">· open</span>
                          )}
                        </div>
                        <div className="truncate text-[11.5px] text-[#8A897F]">
                          {cma.subject.name || "No subject"} · {compCount} comp
                          {compCount !== 1 ? "s" : ""} · updated{" "}
                          {new Date(cma.updatedAt).toLocaleDateString()}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newId = cmaStore.duplicateCMA(cma.id);
                            if (newId) {
                              const dup = cmaStore.cmas.find((c) => c.id === newId);
                            }
                          }}
                          className="border-none bg-transparent p-0 text-[11.5px] text-slate2"
                          title="Duplicate"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${cma.name}"?`)) {
                              cmaStore.deleteCMA(cma.id);
                              if (cma.id === currentCmaId) setCurrentCmaId(null);
                            }
                          }}
                          className="border-none bg-transparent p-0 text-[11.5px] text-[#8A3A3A]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowLoadPanel(false)}
                className="rounded-lg border border-[#DDD9CF] px-4 py-2 text-[13px] text-[#5A594F]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
