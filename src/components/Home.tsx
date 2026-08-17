import { useMemo } from "react";
import type { Property } from "../types";
import { avgPsfOf, fmtPsf, fmtRent } from "../lib/format";

export default function Home({
  properties,
  onOpenDatabase,
  onImport,
}: {
  properties: Property[];
  onOpenDatabase: () => void;
  onImport: () => void;
}) {
  const stats = useMemo(() => {
    const fpAll = properties.flatMap((p) => p.floorplans);
    const psf = fpAll.map((f) => f.rent_psf).filter((x): x is number => x != null);
    const rents = fpAll
      .map((f) => f.rent)
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    const states = new Set(properties.map((p) => p.state).filter(Boolean));
    return {
      props: properties.length,
      fps: fpAll.length,
      states: states.size,
      medRent: rents.length ? rents[Math.floor(rents.length / 2)] : null,
      avgPsf: psf.length ? psf.reduce((a, b) => a + b, 0) / psf.length : null,
    };
  }, [properties]);

  const recent = useMemo(
    () =>
      [...properties]
        .sort((a, b) => (Number(b.year_built) || 0) - (Number(a.year_built) || 0))
        .slice(0, 5),
    [properties]
  );

  return (
    <div className="mx-auto max-w-[980px] px-6">
      {/* Hero */}
      <div className="pb-8 pt-14">
        <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-pine">
          <span className="h-px w-8 bg-pine" />
          Build-to-Rent Analysis
        </div>
        <h1 className="m-0 max-w-[720px] font-display text-[40px] font-bold leading-[1.08] tracking-[-0.02em] text-ink">
          Every comp you've pulled, in one place — and the CMA built on top of it.
        </h1>
        <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#5A594F]">
          Keep a living library of build-to-rent comparables, import fresh market data straight
          from CoStar, and turn any subject property into a weighted rent benchmark.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            onClick={onOpenDatabase}
            className="rounded-lg border-none bg-pine px-5 py-2.5 text-[14px] font-medium text-white"
          >
            Browse comp database
          </button>
          <button
            onClick={onImport}
            className="rounded-lg border border-[#CFE0D4] bg-white px-5 py-2.5 text-[14px] font-medium text-pine"
          >
            Import from CoStar
          </button>
        </div>
      </div>

      {/* Stats ribbon */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        {[
          ["Properties", String(stats.props)],
          ["Floorplans", String(stats.fps)],
          ["Markets", String(stats.states) + " states"],
          ["Median rent", fmtRent(stats.medRent)],
          ["Avg $/SF", stats.avgPsf != null ? fmtPsf(stats.avgPsf) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-paper px-4 py-5">
            <div className="font-mono text-[22px] font-medium leading-none text-ink">{v}</div>
            <div className="mt-2 text-[10.5px] uppercase tracking-wide text-[#8A897F]">{k}</div>
          </div>
        ))}
      </div>

      {/* Workflow cards */}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Card
          step="01"
          title="Comp database"
          body="Search, filter, and maintain your full library of BTR properties and their floorplans."
          action="Open database"
          onClick={onOpenDatabase}
          live
        />
        <Card
          step="02"
          title="Import CoStar"
          body="Drop a CoStar export and it becomes structured comps — rents and $/SF broken out by bedroom."
          action="Import a report"
          onClick={onImport}
          live
        />
        <Card
          step="03"
          title="Build a CMA"
          body="Pick a subject property, weight your comps by bedroom, and generate a rent benchmark and map."
          action="Coming soon"
          onClick={() => {}}
          live={false}
        />
      </div>

      {/* Recently built */}
      {recent.length > 0 && (
        <div className="mb-16 mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="m-0 font-display text-[15px] font-semibold text-ink">
              Newest in your library
            </h2>
            <button
              onClick={onOpenDatabase}
              className="border-none bg-transparent text-xs text-pine"
            >
              View all →
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            {recent.map((p, i) => (
              <button
                key={p.id}
                onClick={onOpenDatabase}
                className={`flex w-full items-center justify-between gap-3 bg-paper px-4 py-3 text-left hover:bg-[#FCFBF8] ${
                  i ? "border-t border-line" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-ink">{p.name}</div>
                  <div className="truncate text-[11.5px] text-[#8A897F]">
                    {[p.city, p.state].filter(Boolean).join(", ")}
                    {p.year_built ? ` · ${p.year_built}` : ""}
                  </div>
                </div>
                <div className="whitespace-nowrap font-mono text-[13px] text-ink">
                  {p.rent_min != null ? fmtRent(p.rent_min) : "—"}
                  {p.rent_max != null && p.rent_max !== p.rent_min
                    ? "–" + fmtRent(p.rent_max).replace("$", "")
                    : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  step,
  title,
  body,
  action,
  onClick,
  live,
}: {
  step: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  live: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-5 ${
        live ? "border-line bg-paper" : "border-dashed border-[#DED9CD] bg-[#FAF9F5]"
      }`}
    >
      <div className="font-mono text-[12px] text-[#C0BCAF]">{step}</div>
      <div className="mt-2 font-display text-[16px] font-semibold text-ink">{title}</div>
      <p className="mb-4 mt-1.5 flex-1 text-[12.5px] leading-relaxed text-[#6E6D64]">{body}</p>
      <button
        onClick={onClick}
        disabled={!live}
        className={`self-start text-[13px] font-medium ${
          live ? "text-pine" : "cursor-default text-[#B0AEA3]"
        } border-none bg-transparent p-0`}
      >
        {action}
        {live ? " →" : ""}
      </button>
    </div>
  );
}
