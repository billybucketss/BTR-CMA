import { useState } from "react";
import type { Property } from "../types";
import { parseCostarWorkbook } from "../lib/costar";
import { fmtRent, typeStyle } from "../lib/format";

export default function CostarImport({
  onImport,
  onClose,
}: {
  onImport: (props: Property[]) => void;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<Property[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const res = parseCostarWorkbook(buf);
      if (res.properties.length === 0) {
        setError(
          "No properties found. Make sure this is a CoStar multifamily export with a 'Property Address' column."
        );
        setParsed(null);
        return;
      }
      setParsed(res.properties);
      setWarnings(res.warnings);
    } catch (e) {
      setError("Could not read this file. Is it a valid .xlsx export from CoStar?");
      setParsed(null);
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] rounded-2xl bg-paper p-6 shadow-2xl"
      >
        <div className="mb-1 font-display text-lg font-semibold">Import from CoStar</div>
        <p className="mb-4 mt-0 text-[12.5px] text-[#8A897F]">
          Drop a CoStar multifamily export (.xlsx). Each property becomes a comp with floorplans
          built from the per-bedroom asking rents.
        </p>

        {!parsed && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragOver ? "border-pine bg-[#F0F5F1]" : "border-[#D8D4C9] bg-white"
            }`}
          >
            <div className="font-display text-[15px] font-medium text-ink">
              Drop your CoStar .xlsx here
            </div>
            <div className="mt-1 text-xs text-[#8A897F]">or click to browse</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={onInput}
              className="hidden"
            />
          </label>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-[#E7C9C9] bg-[#FAF0F0] px-3.5 py-2.5 text-[12.5px] text-[#8A3A3A]">
            {error}
          </div>
        )}

        {parsed && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">
                {parsed.length} propert{parsed.length === 1 ? "y" : "ies"} found
                <span className="ml-1.5 font-normal text-[#8A897F]">in {fileName}</span>
              </span>
              <button
                onClick={() => {
                  setParsed(null);
                  setFileName("");
                }}
                className="border-none bg-transparent p-0 text-xs text-slate2"
              >
                Choose a different file
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="mb-2 rounded-lg border border-[#EAD9B8] bg-[#FBF5E9] px-3.5 py-2 text-[12px] text-[#8A6A2A]">
                {warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            <div className="max-h-[300px] overflow-auto rounded-lg border border-line">
              {parsed.map((p, i) => {
                const ts = typeStyle(p.type);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5 border-b border-[#F0EEE7] px-3 py-2 last:border-b-0"
                  >
                    <div
                      className="flex h-8 w-9 items-center justify-center rounded-md font-display text-[10px] font-bold"
                      style={{ background: ts.bg, color: ts.fg }}
                    >
                      {ts.label}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink">{p.name}</div>
                      <div className="truncate text-[11px] text-[#8A897F]">
                        {[p.city, p.state].filter(Boolean).join(", ")}
                        {p.floorplans.length ? ` · ${p.floorplans.length} plans` : ""}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-right font-mono text-[12px] text-ink">
                      {p.rent_min != null ? fmtRent(p.rent_min) : "—"}
                      {p.rent_max != null && p.rent_max !== p.rent_min
                        ? "–" + fmtRent(p.rent_max).replace("$", "")
                        : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={onClose}
                className="rounded-lg border border-[#DDD9CF] px-4 py-2 text-[13px] text-[#5A594F]"
              >
                Cancel
              </button>
              <button
                onClick={() => onImport(parsed)}
                className="rounded-lg border-none bg-pine px-[18px] py-2 text-[13px] font-medium text-white"
              >
                Add {parsed.length} to database
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
