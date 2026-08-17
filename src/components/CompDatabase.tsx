import { useMemo, useState } from "react";
import type { Property } from "../types";
import { TYPE_STYLE, avgPsfOf, fmtPsf, fmtRent, typeStyle } from "../lib/format";
import PropertyCard from "./PropertyCard";
import EditModal from "./EditModal";
import CMAMap from "./CMAMap";
import type { MapPin } from "./CMAMap";
import BtrImport from "./BtrImport";

export default function CompDatabase({
  properties,
  addProperty,
  addMany,
  updateProperty,
  deleteProperty,
  ready,
  onRequestImport,
}: {
  properties: Property[];
  addProperty: (p: Omit<Property, "id">) => void;
  addMany: (p: Property[]) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  ready: boolean;
  onRequestImport: () => void;
}) {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [bedFilter, setBedFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [editing, setEditing] = useState<Property | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showBtrImport, setShowBtrImport] = useState(false);

  const allStates = useMemo(
    () => [...new Set(properties.map((p) => p.state).filter(Boolean))].sort() as string[],
    [properties]
  );

  const [lo, hi] = useMemo(() => {
    const all = properties
      .flatMap((p) => [p.rent_min, p.rent_max])
      .filter((x): x is number => x != null);
    return all.length ? [Math.min(...all), Math.max(...all)] : [0, 1];
  }, [properties]);

  const filtered = useMemo(() => {
    const r = properties.filter((p) => {
      if (q) {
        const hay = (
          p.name +
          " " +
          (p.address || "") +
          " " +
          (p.city || "") +
          " " +
          (p.notes || "")
        ).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (types.size && !types.has(p.type)) return false;
      if (stateFilter && p.state !== stateFilter) return false;
      if (bedFilter != null) {
        const beds = p.floorplans.map((f) => f.beds);
        if (!beds.includes(bedFilter)) return false;
      }
      return true;
    });
    r.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "year") return (Number(b.year_built) || 0) - (Number(a.year_built) || 0);
      if (sort === "rent") return (b.rent_max || 0) - (a.rent_max || 0);
      if (sort === "psf") return (avgPsfOf(b) || 0) - (avgPsfOf(a) || 0);
      return 0;
    });
    return r;
  }, [properties, q, types, bedFilter, stateFilter, sort]);

  const stats = useMemo(() => {
    const fpAll = filtered.flatMap((p) => p.floorplans);
    const psf = fpAll.map((f) => f.rent_psf).filter((x): x is number => x != null);
    const rents = fpAll
      .map((f) => f.rent)
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    return {
      props: filtered.length,
      fps: fpAll.length,
      avgPsf: psf.length ? psf.reduce((a, b) => a + b, 0) / psf.length : null,
      medRent: rents.length ? rents[Math.floor(rents.length / 2)] : null,
    };
  }, [filtered]);

  const toggleType = (t: string) => {
    const n = new Set(types);
    n.has(t) ? n.delete(t) : n.add(t);
    setTypes(n);
  };

  const exportCsv = () => {
    const head = [
      "Type",
      "Name",
      "Address",
      "City",
      "State",
      "Zip",
      "Units",
      "Year",
      "Subtype",
      "Beds",
      "Baths",
      "SqFt",
      "Garage",
      "Rent",
      "Rent/SF",
      "School District",
      "Website",
    ];
    const rows: (string | number | null | undefined)[][] = [head];
    filtered.forEach((p) =>
      p.floorplans.forEach((f) => {
        rows.push([
          p.type,
          p.name,
          p.address,
          p.city,
          p.state,
          p.zip,
          p.unit_count,
          p.year_built,
          f.subtype,
          f.beds,
          f.baths,
          f.sqft,
          f.garage,
          f.rent,
          f.rent_psf,
          p.school_district,
          p.website,
        ]);
      })
    );
    const csv = rows
      .map((r) =>
        r.map((c) => '"' + (c == null ? "" : String(c)).replace(/"/g, '""') + '"').join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "btr_comps_export.csv";
    a.click();
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-2.5 py-[5px] text-xs font-medium ${
      active ? "border-pine bg-pine text-white" : "border-[#E0DCD2] bg-white text-[#5A594F]"
    }`;

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-paper px-6 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-[22px] w-2 rounded-sm bg-pine" />
              <h1 className="m-0 font-display text-[21px] font-bold tracking-tight">
                Comp Database
              </h1>
            </div>
            <p className="ml-[18px] mt-1 text-[12.5px] text-[#8A897F]">
              Your master library of build-to-rent comparables
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMap(true)}
              className="rounded-lg border border-[#CFE0D4] bg-white px-3.5 py-2 text-[13px] font-medium text-pine"
            >
              View Map
            </button>
            <button
              onClick={onRequestImport}
              className="rounded-lg border border-[#CFE0D4] bg-white px-3.5 py-2 text-[13px] font-medium text-pine"
            >
              Import CoStar
            </button>
            <button
              onClick={() => setShowBtrImport(true)}
              className="rounded-lg border border-[#CFE0D4] bg-white px-3.5 py-2 text-[13px] font-medium text-pine"
            >
              Import BTR Comps
            </button>
            <button
              onClick={exportCsv}
              className="rounded-lg border border-[#E0DCD2] bg-white px-3.5 py-2 text-[13px] font-medium text-[#5A594F]"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowEdit(true);
              }}
              className="rounded-lg border-none bg-pine px-4 py-2 text-[13px] font-medium text-white"
            >
              + Add property
            </button>
          </div>
        </div>

        <div className="ml-[18px] mt-4 flex flex-wrap gap-7">
          {[
            ["Properties", stats.props],
            ["Floorplans", stats.fps],
            ["Median rent", fmtRent(stats.medRent)],
            ["Avg $/SF", stats.avgPsf != null ? fmtPsf(stats.avgPsf) : "—"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="font-mono text-[19px] font-medium leading-none">{v}</div>
              <div className="mt-[3px] text-[10.5px] uppercase tracking-wide text-[#8A897F]">
                {k}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 py-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, address, city, notes…"
            className="min-w-[240px] flex-1 rounded-lg border border-[#E0DCD2] bg-white px-3 py-2 text-[13.5px]"
          />
          {Object.keys(TYPE_STYLE).map((t) => (
            <button key={t} onClick={() => toggleType(t)} className={chip(types.has(t))}>
              {typeStyle(t).label}
            </button>
          ))}
          <div className="h-[22px] w-px bg-[#E5E1D7]" />
          {[2, 3, 4, 5].map((b) => (
            <button
              key={b}
              onClick={() => setBedFilter(bedFilter === b ? null : b)}
              className={chip(bedFilter === b)}
            >
              {b}BR
            </button>
          ))}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-full border border-[#E0DCD2] bg-white px-2 py-[5px] text-xs text-[#5A594F]"
          >
            <option value="">All states</option>
            {allStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="ml-auto rounded-lg border border-[#E0DCD2] bg-white px-2 py-1.5 text-xs text-[#5A594F]"
          >
            <option value="name">Sort: Name</option>
            <option value="year">Sort: Newest</option>
            <option value="rent">Sort: Highest rent</option>
            <option value="psf">Sort: Highest $/SF</option>
          </select>
        </div>
      </div>

      <div className="mx-auto max-w-[980px]">
        {!ready && (
          <div className="p-10 text-center text-[13px] text-[#8A897F]">Loading…</div>
        )}
        {ready && filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mb-1.5 text-sm text-[#5A594F]">No properties match these filters.</div>
            <button
              onClick={() => {
                setQ("");
                setTypes(new Set());
                setBedFilter(null);
                setStateFilter("");
              }}
              className="border-none bg-transparent text-[13px] text-pine"
            >
              Clear filters
            </button>
          </div>
        )}
        {filtered.map((p) => (
          <PropertyCard
            key={p.id}
            p={p}
            lo={lo}
            hi={hi}
            onEdit={(pp) => {
              setEditing(pp);
              setShowEdit(true);
            }}
            onDelete={deleteProperty}
          />
        ))}
      </div>

      <div className="p-6 text-center text-[11.5px] text-[#B0AEA3]">
        {filtered.length} of {properties.length} properties · saved to this browser
      </div>

      {showEdit && (
        <EditModal
          prop={editing}
          onClose={() => setShowEdit(false)}
          onSave={(data) => {
            if (editing) updateProperty(editing.id, data);
            else addProperty(data);
            setShowEdit(false);
          }}
        />
      )}

      {showMap && (
        <CMAMap
          pins={filtered
            .filter((p) => p.address)
            .map((p) => ({
              label: p.name,
              address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(", "),
              detail: p.rent_min != null
                ? `${p.rent_min !== p.rent_max && p.rent_max != null ? "$" + p.rent_min.toLocaleString() + "–$" + p.rent_max.toLocaleString() : "$" + p.rent_min.toLocaleString()}`
                : undefined,
              isSubject: false,
            }))}
          onClose={() => setShowMap(false)}
        />
      )}

      {showBtrImport && (
        <BtrImport
          onClose={() => setShowBtrImport(false)}
          onImport={(props) => {
            addMany(props);
            setShowBtrImport(false);
          }}
        />
      )}
    </div>
  );
}
