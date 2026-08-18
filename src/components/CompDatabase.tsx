import { useMemo, useState } from "react";
import type { Property } from "../types";
import {
  avgPsfOf,
  buildAddress,
  cityStateFallback,
  fmtPsf,
  fmtRent,
  typeStyle,
} from "../lib/format";
import PropertyCard from "./PropertyCard";
import EditModal from "./EditModal";
import CMAMap from "./CMAMap";
import BtrImport from "./BtrImport";

export default function CompDatabase({
  properties,
  addProperty,
  addMany,
  updateProperty,
  deleteProperty,
  deleteMany,
  ready,
  onRequestImport,
}: {
  properties: Property[];
  addProperty: (p: Omit<Property, "id">) => void;
  addMany: (p: Property[]) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  deleteMany: (ids: string[]) => void;
  ready: boolean;
  onRequestImport: () => void;
}) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [bedFilter, setBedFilter] = useState<Set<number>>(new Set());
  const [marketFilter, setMarketFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [minYear, setMinYear] = useState("");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [sort, setSort] = useState("market");
  const [groupByCity, setGroupByCity] = useState(true);
  const [editing, setEditing] = useState<Property | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showBtrImport, setShowBtrImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set());
  const [mapProps, setMapProps] = useState<Property[] | null>(null);

  const coreType = (t: string): string => {
    const s = (t || "").toUpperCase();
    if (s.includes("APT")) return "APT";
    if (s.includes("SF") && s.includes("TH")) return "BTR TH/SF";
    if (s.includes("TH")) return "BTR TH";
    if (s.includes("SF") || s.includes("SFR")) return "BTR SF";
    if (s.includes("COTTAGE")) return "BTR TH";
    return "Other";
  };

  const allMarkets = useMemo(
    () => [...new Set(properties.map((p) => p.market).filter(Boolean))].sort() as string[],
    [properties]
  );
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
    const minY = minYear ? Number(minYear) : null;
    const minR = minRent ? Number(minRent) : null;
    const maxR = maxRent ? Number(maxRent) : null;
    const r = properties.filter((p) => {
      if (q) {
        const hay = (
          p.name +
          " " +
          (p.address || "") +
          " " +
          (p.city || "") +
          " " +
          (p.market || "") +
          " " +
          (p.notes || "")
        ).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (typeFilter.size && !typeFilter.has(coreType(p.type))) return false;
      if (marketFilter && p.market !== marketFilter) return false;
      if (stateFilter && p.state !== stateFilter) return false;
      if (bedFilter.size) {
        const beds = p.floorplans.map((f) => f.beds);
        if (![...bedFilter].some((b) => beds.includes(b))) return false;
      }
      if (minY != null) {
        const y = Number(p.year_built);
        if (!y || y < minY) return false;
      }
      if (minR != null && (p.rent_max == null || p.rent_max < minR)) return false;
      if (maxR != null && (p.rent_min == null || p.rent_min > maxR)) return false;
      return true;
    });
    r.sort((a, b) => {
      if (sort === "market")
        return (a.market || "").localeCompare(b.market || "") || a.name.localeCompare(b.name);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "year") return (Number(b.year_built) || 0) - (Number(a.year_built) || 0);
      if (sort === "rent") return (b.rent_max || 0) - (a.rent_max || 0);
      if (sort === "psf") return (avgPsfOf(b) || 0) - (avgPsfOf(a) || 0);
      return 0;
    });
    return r;
  }, [properties, q, typeFilter, bedFilter, marketFilter, stateFilter, minYear, minRent, maxRent, sort]);

  const grouped = useMemo(() => {
    if (!groupByCity) return null;
    const map = new Map<string, Property[]>();
    filtered.forEach((p) => {
      const key = p.market || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupByCity]);

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
    const n = new Set(typeFilter);
    n.has(t) ? n.delete(t) : n.add(t);
    setTypeFilter(n);
  };
  const toggleBed = (b: number) => {
    const n = new Set(bedFilter);
    n.has(b) ? n.delete(b) : n.add(b);
    setBedFilter(n);
  };

  const clearFilters = () => {
    setQ("");
    setTypeFilter(new Set());
    setBedFilter(new Set());
    setMarketFilter("");
    setStateFilter("");
    setMinYear("");
    setMinRent("");
    setMaxRent("");
  };

  const activeFilterCount =
    (q ? 1 : 0) +
    typeFilter.size +
    bedFilter.size +
    (marketFilter ? 1 : 0) +
    (stateFilter ? 1 : 0) +
    (minYear ? 1 : 0) +
    (minRent ? 1 : 0) +
    (maxRent ? 1 : 0);

  const toggleSelect = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const selectAllFiltered = () => setSelected(new Set(filtered.map((p) => p.id)));
  const clearSelection = () => setSelected(new Set());
  const deleteSelected = () => {
    if (confirm(`Delete ${selected.size} selected propert${selected.size === 1 ? "y" : "ies"}?`)) {
      deleteMany([...selected]);
      setSelected(new Set());
    }
  };

  const exportCsv = (onlySelected: boolean) => {
    const source = onlySelected ? filtered.filter((p) => selected.has(p.id)) : filtered;
    const head = [
      "Market", "Type", "Name", "Address", "City", "State", "Zip", "Units", "Year",
      "Subtype", "Beds", "Baths", "SqFt", "Garage", "Rent", "Rent/SF", "Owner", "School District", "Website",
    ];
    const rows: (string | number | null | undefined)[][] = [head];
    source.forEach((p) =>
      p.floorplans.forEach((f) => {
        rows.push([
          p.market, p.type, p.name, p.address, p.city, p.state, p.zip, p.unit_count, p.year_built,
          f.subtype, f.beds, f.baths, f.sqft, f.garage, f.rent, f.rent_psf, p.owner, p.school_district, p.website,
        ]);
      })
    );
    const csv = rows
      .map((r) => r.map((c) => '"' + (c == null ? "" : String(c)).replace(/"/g, '""') + '"').join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = onlySelected ? "btr_comps_selected.csv" : "btr_comps_export.csv";
    a.click();
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-2.5 py-[5px] text-xs font-medium ${
      active ? "border-pine bg-pine text-white" : "border-[#E0DCD2] bg-white text-[#5A594F]"
    }`;

  const toggleCity = (market: string) => {
    const n = new Set(collapsedCities);
    n.has(market) ? n.delete(market) : n.add(market);
    setCollapsedCities(n);
  };

  const collapseAll = () => {
    if (grouped) setCollapsedCities(new Set(grouped.map(([m]) => m)));
  };
  const expandAll = () => setCollapsedCities(new Set());

  const propsToPins = (props: Property[]) =>
    props
      .filter((p) => p.lat != null || p.address || p.city)
      .map((p) => ({
        label: p.name,
        address: buildAddress(p),
        fallback: cityStateFallback(p),
        lat: p.lat,
        lng: p.lng,
        detail:
          p.rent_min != null
            ? p.rent_min !== p.rent_max && p.rent_max != null
              ? "$" + p.rent_min.toLocaleString() + "–$" + p.rent_max.toLocaleString()
              : "$" + p.rent_min.toLocaleString()
            : undefined,
        isSubject: false,
      }));

  const CORE_TYPES = ["BTR TH", "BTR SF", "BTR TH/SF", "APT"];

  const renderCard = (p: Property) => (
    <div key={p.id} className="flex items-start">
      <div className="flex items-center pl-3 pt-4">
        <input
          type="checkbox"
          checked={selected.has(p.id)}
          onChange={() => toggleSelect(p.id)}
          className="h-4 w-4 accent-pine"
        />
      </div>
      <div className="min-w-0 flex-1">
        <PropertyCard
          p={p}
          lo={lo}
          hi={hi}
          onEdit={(pp) => {
            setEditing(pp);
            setShowEdit(true);
          }}
          onDelete={deleteProperty}
        />
      </div>
    </div>
  );

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
          <div className="flex flex-wrap gap-2">
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
              onClick={() => exportCsv(false)}
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
            ["Markets", allMarkets.length],
            ["Median rent", fmtRent(stats.medRent)],
            ["Avg $/SF", stats.avgPsf != null ? fmtPsf(stats.avgPsf) : "—"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="font-mono text-[19px] font-medium leading-none">{v}</div>
              <div className="mt-[3px] text-[10.5px] uppercase tracking-wide text-[#8A897F]">{k}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-4">
          <input
            value={q}
            onChange={(e: any) => setQ(e.target.value)}
            placeholder="Search name, address, city, market, notes…"
            className="min-w-[240px] flex-1 rounded-lg border border-[#E0DCD2] bg-white px-3 py-2 text-[13.5px]"
          />
          <select
            value={marketFilter}
            onChange={(e: any) => setMarketFilter(e.target.value)}
            className="rounded-lg border border-[#E0DCD2] bg-white px-2.5 py-2 text-[13px] text-[#5A594F]"
          >
            <option value="">All markets</option>
            {allMarkets.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${
              activeFilterCount > 0
                ? "border-pine bg-[#EDF1EE] text-pine"
                : "border-[#E0DCD2] bg-white text-[#5A594F]"
            }`}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <select
            value={sort}
            onChange={(e: any) => setSort(e.target.value)}
            className="rounded-lg border border-[#E0DCD2] bg-white px-2 py-2 text-xs text-[#5A594F]"
          >
            <option value="market">Sort: City</option>
            <option value="name">Sort: Name</option>
            <option value="year">Sort: Newest</option>
            <option value="rent">Sort: Highest rent</option>
            <option value="psf">Sort: Highest $/SF</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[#5A594F]">
            <input
              type="checkbox"
              checked={groupByCity}
              onChange={() => setGroupByCity(!groupByCity)}
              className="h-3.5 w-3.5 accent-pine"
            />
            Group by city
          </label>
        </div>

        {showFilters && (
          <div className="mt-3 rounded-xl border border-line bg-[#FCFBF8] p-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A897F]">
                  Type
                </div>
                <div className="flex gap-1.5">
                  {CORE_TYPES.map((t) => (
                    <button key={t} onClick={() => toggleType(t)} className={chip(typeFilter.has(t))}>
                      {typeStyle(t).label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A897F]">
                  Bedrooms
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((b) => (
                    <button key={b} onClick={() => toggleBed(b)} className={chip(bedFilter.has(b))}>
                      {b}BR
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A897F]">
                  State
                </div>
                <select
                  value={stateFilter}
                  onChange={(e: any) => setStateFilter(e.target.value)}
                  className="rounded-lg border border-[#E0DCD2] bg-white px-2.5 py-1.5 text-[13px] text-[#5A594F]"
                >
                  <option value="">All</option>
                  {allStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A897F]">
                  Built after
                </div>
                <input
                  value={minYear}
                  onChange={(e: any) => setMinYear(e.target.value)}
                  placeholder="e.g. 2020"
                  className="w-24 rounded-lg border border-[#E0DCD2] bg-white px-2.5 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A897F]">
                  Rent range
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    value={minRent}
                    onChange={(e: any) => setMinRent(e.target.value)}
                    placeholder="Min"
                    className="w-20 rounded-lg border border-[#E0DCD2] bg-white px-2.5 py-1.5 text-[13px]"
                  />
                  <span className="text-[#8A897F]">–</span>
                  <input
                    value={maxRent}
                    onChange={(e: any) => setMaxRent(e.target.value)}
                    placeholder="Max"
                    className="w-20 rounded-lg border border-[#E0DCD2] bg-white px-2.5 py-1.5 text-[13px]"
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="ml-auto rounded-lg border border-[#DDD9CF] px-3 py-1.5 text-[12.5px] text-[#5A594F]"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 py-3 text-[12.5px]">
          {selected.size > 0 ? (
            <>
              <span className="font-medium text-ink">{selected.size} selected</span>
              <button onClick={selectAllFiltered} className="text-pine">
                Select all {filtered.length}
              </button>
              <button onClick={clearSelection} className="text-slate2">
                Clear
              </button>
              <button onClick={() => exportCsv(true)} className="text-slate2">
                Export selected
              </button>
              <button onClick={deleteSelected} className="text-[#8A3A3A]">
                Delete selected
              </button>
            </>
          ) : (
            <button onClick={selectAllFiltered} className="text-slate2">
              Select all {filtered.length}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[980px]">
        {!ready && <div className="p-10 text-center text-[13px] text-[#8A897F]">Loading…</div>}
        {ready && filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mb-1.5 text-sm text-[#5A594F]">No properties match these filters.</div>
            <button onClick={clearFilters} className="border-none bg-transparent text-[13px] text-pine">
              Clear filters
            </button>
          </div>
        )}

        {groupByCity && grouped ? (
          <>
            <div className="flex items-center gap-3 px-[18px] py-2 text-[11.5px]">
              <button onClick={collapseAll} className="text-slate2">
                Collapse all
              </button>
              <button onClick={expandAll} className="text-slate2">
                Expand all
              </button>
            </div>
            {grouped.map(([market, props]) => {
              const isCollapsed = collapsedCities.has(market);
              return (
                <div key={market}>
                  <div className="flex items-center gap-2 border-b border-line bg-[#F2F4F1] px-[18px] py-2">
                    <button
                      onClick={() => toggleCity(market)}
                      className="flex flex-1 items-center gap-2 border-none bg-transparent p-0 text-left"
                    >
                      <span className="text-[10px] text-[#8A897F]">{isCollapsed ? "▶" : "▼"}</span>
                      <span className="font-display text-[13px] font-bold uppercase tracking-wide text-pine">
                        {market}
                      </span>
                      <span className="font-mono text-[11px] text-[#8A897F]">{props.length}</span>
                    </button>
                    <button
                      onClick={() => setMapProps(props)}
                      className="rounded-md border border-[#CFE0D4] bg-white px-2.5 py-1 text-[11px] font-medium text-pine"
                    >
                      Map this city
                    </button>
                  </div>
                  {!isCollapsed && props.map(renderCard)}
                </div>
              );
            })}
          </>
        ) : (
          filtered.map(renderCard)
        )}
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
        <CMAMap pins={propsToPins(filtered)} onClose={() => setShowMap(false)} />
      )}

      {mapProps && (
        <CMAMap pins={propsToPins(mapProps)} onClose={() => setMapProps(null)} />
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
