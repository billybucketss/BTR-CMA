import { useState } from "react";
import type { Property } from "../types";
import { parseBtrCompWorkbook } from "../lib/btr-import";
import type { BtrParseError } from "../lib/btr-import";
import { fmtRent, typeStyle } from "../lib/format";

export default function BtrImport({
  onImport,
  onClose,
}: {
  onImport: (props: Property[]) => void;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<Property[] | null>(null);
  const [errors, setErrors] = useState<BtrParseError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const res = parseBtrCompWorkbook(buf);
      if (res.properties.length === 0 && res.warnings.length > 0) {
        setError(res.warnings.join(" "));
        setParsed(null);
        return;
      }
      if (res.properties.length === 0) {
        setError(
          "No properties found. Make sure this spreadsheet has Name, Address, and Unit Mix/Rents columns."
        );
        setParsed(null);
        return;
      }
      setParsed(res.properties);
      setErrors(res.errors);
      setWarnings(res.warnings);
      if (res.errors.length > 0) {
        setShowErrors(true);
      }
    } catch {
      setError("Could not read this file. Is it a valid .xlsx spreadsheet?");
      setParsed(null);
    }
  };

  const onInput = (e: any) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: any) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const errorsByProp = errors.reduce<Record<string, BtrParseError[]>>((acc, err) => {
    const key = `Row ${err.row}: ${err.name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {});

  const criticalErrors = errors.filter(
    (e) =>
      e.message.includes("Missing property name") ||
      e.message.includes("Missing address") ||
      e.message.includes("Could not parse any floorplans")
  );
  const warningErrors = errors.filter(
    (e) => !criticalErrors.includes(e)
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        className="w-full max-w-[720px] rounded-2xl bg-paper p-6 shadow-2xl"
      >
        <div className="mb-1 font-display text-lg font-semibold">Import BTR Comp Database</div>
        <p className="mb-4 mt-0 text-[12.5px] text-[#8A897F]">
          Drop a BTR comp spreadsheet (.xlsx) with columns: Type, Name, Address, Unit Count, Year
          Built, Unit Mix/Rents, Notes, Website. Each row becomes a property with parsed floorplans.
        </p>

        {!parsed && (
          <label
            onDragOver={(e: any) => {
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
              Drop your BTR comp .xlsx here
            </div>
            <div className="mt-1 text-xs text-[#8A897F]">or click to browse</div>
            <input type="file" accept=".xlsx,.xls" onChange={onInput} className="hidden" />
          </label>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-[#E7C9C9] bg-[#FAF0F0] px-3.5 py-2.5 text-[12.5px] text-[#8A3A3A]">
            {error}
          </div>
        )}

        {parsed && (
          <div>
            {/* Summary bar */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">
                {parsed.length} propert{parsed.length === 1 ? "y" : "ies"} found
                <span className="ml-1.5 font-normal text-[#8A897F]">in {fileName}</span>
              </span>
              <button
                onClick={() => {
                  setParsed(null);
                  setFileName("");
                  setErrors([]);
                  setWarnings([]);
                }}
                className="border-none bg-transparent p-0 text-xs text-slate2"
              >
                Choose a different file
              </button>
            </div>

            {/* Error/Warning summary */}
            {errors.length > 0 && (
              <div
                className={`mb-3 rounded-lg border px-3.5 py-2.5 ${
                  criticalErrors.length > 0
                    ? "border-[#E7C9C9] bg-[#FAF0F0]"
                    : "border-[#EAD9B8] bg-[#FBF5E9]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12.5px]">
                    {criticalErrors.length > 0 && (
                      <span className="font-medium text-[#8A3A3A]">
                        {criticalErrors.length} issue{criticalErrors.length !== 1 ? "s" : ""} need attention
                      </span>
                    )}
                    {criticalErrors.length > 0 && warningErrors.length > 0 && (
                      <span className="text-[#8A897F]"> · </span>
                    )}
                    {warningErrors.length > 0 && (
                      <span className="text-[#8A6A2A]">
                        {warningErrors.length} warning{warningErrors.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="border-none bg-transparent p-0 text-xs font-medium text-[#5B7085]"
                  >
                    {showErrors ? "Hide details" : "Show details"}
                  </button>
                </div>

                {showErrors && (
                  <div className="mt-2.5 max-h-[200px] overflow-auto">
                    {Object.entries(errorsByProp).map(([key, errs]) => (
                      <div key={key} className="mb-2 last:mb-0">
                        <div className="text-[11.5px] font-semibold text-ink">{key}</div>
                        {errs.map((err, i) => (
                          <div
                            key={i}
                            className={`ml-3 text-[11px] ${
                              err.message.includes("Missing") ||
                              err.message.includes("Could not parse")
                                ? "text-[#8A3A3A]"
                                : "text-[#8A6A2A]"
                            }`}
                          >
                            <span className="font-medium">{err.field}:</span> {err.message}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mb-3 rounded-lg border border-[#EAD9B8] bg-[#FBF5E9] px-3.5 py-2 text-[12px] text-[#8A6A2A]">
                {warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            {/* Property list */}
            <div className="max-h-[300px] overflow-auto rounded-lg border border-line">
              {parsed.map((p, i) => {
                const ts = typeStyle(p.type);
                const propErrors = errors.filter(
                  (e) => e.name === p.name || e.name === p.address
                );
                const hasCritical = propErrors.some(
                  (e) =>
                    e.message.includes("Missing") ||
                    e.message.includes("Could not parse")
                );
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[40px_1fr_auto] items-center gap-2.5 border-b border-[#F0EEE7] px-3 py-2 last:border-b-0 ${
                      hasCritical ? "bg-[#FDF8F8]" : ""
                    }`}
                  >
                    <div
                      className="flex h-8 w-9 items-center justify-center rounded-md font-display text-[10px] font-bold"
                      style={{ background: ts.bg, color: ts.fg }}
                    >
                      {ts.label}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-ink">{p.name}</span>
                        {propErrors.length > 0 && (
                          <span
                            className={`text-[10px] ${hasCritical ? "text-[#8A3A3A]" : "text-[#B45309]"}`}
                            title={propErrors.map((e) => `${e.field}: ${e.message}`).join("\n")}
                          >
                            {hasCritical ? "⚠" : "⚑"} {propErrors.length}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-[#8A897F]">
                        {[p.city, p.state].filter(Boolean).join(", ")}
                        {p.floorplans.length ? ` · ${p.floorplans.length} plans` : " · no plans"}
                        {p.year_built ? ` · ${p.year_built}` : ""}
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

            <div className="mt-5 flex items-center justify-between">
              <div className="text-[11.5px] text-[#8A897F]">
                {parsed.reduce((s, p) => s + p.floorplans.length, 0)} total floorplans parsed
              </div>
              <div className="flex gap-2.5">
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
                  {errors.length > 0 ? " (with warnings)" : ""}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
