import { useState } from "react";
import type { Floorplan, Property } from "../types";

type FpDraft = {
  subtype: string;
  beds: string;
  baths: string;
  sqft: string;
  garage: string;
  rent: string;
};

export default function EditModal({
  prop,
  onSave,
  onClose,
}: {
  prop: Property | null;
  onSave: (data: Omit<Property, "id">) => void;
  onClose: () => void;
}) {
  const blank: Omit<Property, "id"> = {
    type: "BTR TH",
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    unit_count: "",
    year_built: "",
    website: "",
    notes: "",
    school_district: "",
    floorplans: [],
    rent_min: null,
    rent_max: null,
  };
  const [f, setF] = useState<Omit<Property, "id">>(prop ? { ...blank, ...prop } : blank);
  const [fps, setFps] = useState<FpDraft[]>(
    (prop?.floorplans || []).map((x) => ({
      subtype: x.subtype ?? "",
      beds: x.beds?.toString() ?? "",
      baths: x.baths?.toString() ?? "",
      sqft: x.sqft?.toString() ?? "",
      garage: x.garage ?? "",
      rent: x.rent?.toString() ?? "",
    }))
  );

  const set = <K extends keyof Property>(k: K, v: Property[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const addFp = () =>
    setFps([...fps, { subtype: "", beds: "", baths: "", sqft: "", garage: "2-car", rent: "" }]);
  const setFp = (i: number, k: keyof FpDraft, v: string) =>
    setFps(fps.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const rmFp = (i: number) => setFps(fps.filter((_, j) => j !== i));

  const save = () => {
    if (!f.name.trim()) {
      alert("Name is required");
      return;
    }
    const clean: Floorplan[] = fps.map((x) => {
      const beds = x.beds === "" ? null : Number(x.beds);
      const baths = x.baths === "" ? null : Number(x.baths);
      const sqft = x.sqft === "" ? null : Number(x.sqft);
      const rent = x.rent === "" ? null : Number(x.rent);
      return {
        beds,
        baths,
        sqft,
        garage: x.garage || null,
        subtype: x.subtype || null,
        rent,
        rent_psf: rent && sqft ? Math.round((rent / sqft) * 100) / 100 : null,
      };
    });
    const rents = clean.map((x) => x.rent).filter((x): x is number => x != null);
    onSave({
      ...f,
      floorplans: clean,
      rent_min: rents.length ? Math.min(...rents) : null,
      rent_max: rents.length ? Math.max(...rents) : null,
    });
  };

  const inp =
    "w-full rounded-md border border-[#DDD9CF] bg-white px-2.5 py-2 text-[13px] font-body";
  const lbl =
    "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8A897F]";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] rounded-2xl bg-paper p-6 shadow-2xl"
      >
        <div className="mb-4 font-display text-lg font-semibold">
          {prop ? "Edit property" : "Add property"}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={lbl}>Name</label>
            <input className={inp} value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select className={inp} value={f.type} onChange={(e) => set("type", e.target.value)}>
              <option>BTR TH</option>
              <option>BTR SF</option>
              <option>BTR TH/SF</option>
              <option>APT</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Year Built</label>
            <input
              className={inp}
              value={f.year_built ?? ""}
              onChange={(e) => set("year_built", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Address</label>
            <input
              className={inp}
              value={f.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>City</label>
            <input className={inp} value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>State</label>
              <input
                className={inp}
                value={f.state ?? ""}
                onChange={(e) => set("state", e.target.value)}
              />
            </div>
            <div>
              <label className={lbl}>Zip</label>
              <input className={inp} value={f.zip ?? ""} onChange={(e) => set("zip", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Unit Count</label>
            <input
              className={inp}
              value={f.unit_count ?? ""}
              onChange={(e) => set("unit_count", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>School District</label>
            <input
              className={inp}
              value={f.school_district ?? ""}
              onChange={(e) => set("school_district", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Website</label>
            <input
              className={inp}
              value={f.website ?? ""}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Notes</label>
            <textarea
              className={`${inp} min-h-[54px] resize-y`}
              value={f.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="mb-2 mt-[18px] flex items-center justify-between">
          <span className={lbl}>Floorplans</span>
          <button
            onClick={addFp}
            className="rounded-md border border-[#CFE0D4] px-2.5 py-1 text-xs text-pine"
          >
            + Add floorplan
          </button>
        </div>
        {fps.map((x, i) => (
          <div
            key={i}
            className="mb-1.5 grid grid-cols-[50px_44px_44px_66px_66px_70px_24px] items-center gap-1.5"
          >
            <input
              placeholder="TH/SF"
              className={`${inp} px-1.5 py-1.5 text-xs`}
              value={x.subtype}
              onChange={(e) => setFp(i, "subtype", e.target.value)}
            />
            <input
              placeholder="BR"
              className={`${inp} px-1.5 py-1.5 text-xs`}
              value={x.beds}
              onChange={(e) => setFp(i, "beds", e.target.value)}
            />
            <input
              placeholder="BA"
              className={`${inp} px-1.5 py-1.5 text-xs`}
              value={x.baths}
              onChange={(e) => setFp(i, "baths", e.target.value)}
            />
            <input
              placeholder="sqft"
              className={`${inp} px-1.5 py-1.5 text-xs`}
              value={x.sqft}
              onChange={(e) => setFp(i, "sqft", e.target.value)}
            />
            <input
              placeholder="garage"
              className={`${inp} px-1.5 py-1.5 text-xs`}
              value={x.garage}
              onChange={(e) => setFp(i, "garage", e.target.value)}
            />
            <input
              placeholder="rent"
              className={`${inp} px-1.5 py-1.5 text-xs`}
              value={x.rent}
              onChange={(e) => setFp(i, "rent", e.target.value)}
            />
            <button
              onClick={() => rmFp(i)}
              className="border-none bg-transparent text-base text-[#8A3A3A]"
            >
              ×
            </button>
          </div>
        ))}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#DDD9CF] px-4 py-2 text-[13px] text-[#5A594F]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg border-none bg-pine px-[18px] py-2 text-[13px] font-medium text-white"
          >
            Save property
          </button>
        </div>
      </div>
    </div>
  );
}
