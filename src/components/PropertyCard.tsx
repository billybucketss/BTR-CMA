import { useState } from "react";
import type { Property } from "../types";
import { avgPsfOf, fmtPsf, fmtRent, typeStyle } from "../lib/format";

function RentBar({
  min,
  max,
  lo,
  hi,
}: {
  min: number | null;
  max: number | null;
  lo: number;
  hi: number;
}) {
  if (min == null || max == null || hi === lo) return null;
  const l = ((min - lo) / (hi - lo)) * 100;
  const w = ((max - min) / (hi - lo)) * 100;
  return (
    <div className="relative h-1 w-[120px] rounded bg-[#EDEBE4]">
      <div
        className="absolute inset-y-0 rounded bg-pine"
        style={{ left: l + "%", width: Math.max(w, 2) + "%" }}
      />
    </div>
  );
}

export default function PropertyCard({
  p,
  lo,
  hi,
  onEdit,
  onDelete,
}: {
  p: Property;
  lo: number;
  hi: number;
  onEdit: (p: Property) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ts = typeStyle(p.type);
  const fps = p.floorplans || [];
  const avgPsf = avgPsfOf(p);
  const bedset = [...new Set(fps.map((f) => f.beds).filter((x): x is number => x != null))].sort();

  return (
    <div className={`border-b border-line ${open ? "bg-[#FCFBF8]" : ""}`}>
      <div
        onClick={() => setOpen(!open)}
        className="grid cursor-pointer grid-cols-[44px_1fr_auto] items-center gap-3.5 px-[18px] py-3.5"
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg font-display text-xs font-bold"
          style={{ background: ts.bg, color: ts.fg }}
        >
          {ts.label}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-display text-[15.5px] font-semibold text-ink">{p.name}</span>
            {p.year_built && (
              <span className="font-mono text-xs text-[#8A897F]">{p.year_built}</span>
            )}
            {p.submarket && <span className="text-[11px] text-[#8A897F]">· {p.submarket}</span>}
            {p.school_district && (
              <span className="text-[11px] text-[#8A897F]">· {p.school_district}</span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-[#6E6D64]">{p.address}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {bedset.length > 0 && (
              <span className="font-mono text-[11px] text-[#8A897F]">{bedset.join("/")} BR</span>
            )}
            {p.unit_count && <span className="text-[11px] text-[#8A897F]">{p.unit_count} units</span>}
            {p.vacancy_pct != null && (
              <span className="text-[11px] text-[#8A897F]">{p.vacancy_pct}% vac</span>
            )}
            <RentBar min={p.rent_min} max={p.rent_max} lo={lo} hi={hi} />
          </div>
        </div>
        <div className="whitespace-nowrap text-right">
          <div className="font-mono text-[14.5px] font-medium text-ink">
            {p.rent_min != null ? fmtRent(p.rent_min) : "—"}
            {p.rent_max != null && p.rent_max !== p.rent_min
              ? "–" + fmtRent(p.rent_max).replace("$", "")
              : ""}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-[#8A897F]">
            {avgPsf != null ? fmtPsf(avgPsf) + "/sf" : "no rent"}
          </div>
        </div>
      </div>

      {open && (
        <div className="pb-[18px] pl-20 pr-[18px]">
          {p.notes && (
            <p className="m-0 mb-3 max-w-[640px] text-[12.5px] leading-relaxed text-[#5A594F]">
              {p.notes}
            </p>
          )}
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[52px_1fr_70px_90px_90px_80px] bg-[#F5F3EC] px-3 py-[7px] text-[10.5px] font-semibold uppercase tracking-wide text-[#8A897F]">
              <span>Type</span>
              <span>Bed / Bath</span>
              <span className="text-right">SqFt</span>
              <span className="text-right">Garage</span>
              <span className="text-right">Rent</span>
              <span className="text-right">$/SF</span>
            </div>
            {fps.map((f, i) => (
              <div
                key={i}
                className={`grid grid-cols-[52px_1fr_70px_90px_90px_80px] items-center px-3 py-[7px] font-mono text-[12.5px] text-[#2A2C29] ${
                  i ? "border-t border-[#F0EEE7]" : ""
                }`}
              >
                <span className="text-[#8A897F]">{f.subtype || "—"}</span>
                <span>
                  {f.beds ?? "?"}BR / {f.baths ?? "?"}BA
                  {f.units ? <span className="text-[#8A897F]"> ×{f.units}</span> : null}
                </span>
                <span className="text-right">
                  {f.sqft ? f.sqft.toLocaleString() : "—"}
                  {f.flag && (
                    <span title={f.flag} className="text-[#B45309]">
                      {" "}
                      ⚑
                    </span>
                  )}
                </span>
                <span className="text-right text-[#8A897F]">{f.garage || "—"}</span>
                <span className={`text-right ${f.rent ? "text-ink" : "text-[#C0BFB6]"}`}>
                  {fmtRent(f.rent)}
                </span>
                <span className="text-right text-pine">{fmtPsf(f.rent_psf)}</span>
              </div>
            ))}
          </div>

          {(p.owner_name || p.amenities) && (
            <div className="mt-2.5 text-[11.5px] text-[#8A897F]">
              {p.owner_name && (
                <span>
                  Owner: {p.owner_name}
                  {p.owner_phone ? ` · ${p.owner_phone}` : ""}
                </span>
              )}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-3.5">
            {p.website && (
              <a
                href={p.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-pine no-underline"
              >
                Visit site ↗
              </a>
            )}
            <button
              onClick={() => onEdit(p)}
              className="border-none bg-transparent p-0 text-xs text-slate2"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Remove " + p.name + " from the database?")) onDelete(p.id);
              }}
              className="border-none bg-transparent p-0 text-xs text-[#8A3A3A]"
            >
              Delete
            </button>
            {p.source && (
              <span className="ml-auto text-[10.5px] text-[#B0AEA3]">{p.source}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
