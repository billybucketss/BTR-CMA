import { useCallback, useEffect, useState } from "react";

/* ── CMA data types (mirrors what CMABuilder holds) ── */

export interface SavedSubjectFloorplan {
  name: string;
  beds: number;
  baths: number;
  sqft: number;
  garage: string;
  units: number;
  askingRent: number;
}

export interface SavedSubject {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  yearBuilt: string;
  totalUnits: number;
  floorplans: SavedSubjectFloorplan[];
}

export interface SavedCompEntry {
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

export interface SavedBucket {
  beds: number;
  comps: SavedCompEntry[];
}

export interface SavedCMA {
  id: string;
  name: string;
  subject: SavedSubject;
  buckets: SavedBucket[];
  createdAt: number;
  updatedAt: number;
}

const KEY = "btr_cmas_v1";

function load(): SavedCMA[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SavedCMA[];
  } catch {
    // ignore corrupt storage
  }
  return [];
}

function save(cmas: SavedCMA[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cmas));
  } catch {
    // storage unavailable
  }
}

export function useCMAs() {
  const [cmas, setCmas] = useState<SavedCMA[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCmas(load());
    setReady(true);
  }, []);

  const commit = useCallback((next: SavedCMA[]) => {
    // Keep most recently updated first
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    setCmas(sorted);
    save(sorted);
  }, []);

  const saveCMA = useCallback(
    (data: Omit<SavedCMA, "id" | "createdAt" | "updatedAt">, existingId?: string): string => {
      const now = Date.now();
      if (existingId) {
        const existing = cmas.find((c) => c.id === existingId);
        const updated: SavedCMA = {
          ...data,
          id: existingId,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        commit([updated, ...cmas.filter((c) => c.id !== existingId)]);
        return existingId;
      } else {
        const id = "cma-" + now;
        const rec: SavedCMA = { ...data, id, createdAt: now, updatedAt: now };
        commit([rec, ...cmas]);
        return id;
      }
    },
    [cmas, commit]
  );

  const deleteCMA = useCallback(
    (id: string) => {
      commit(cmas.filter((c) => c.id !== id));
    },
    [cmas, commit]
  );

  const duplicateCMA = useCallback(
    (id: string): string | null => {
      const orig = cmas.find((c) => c.id === id);
      if (!orig) return null;
      const now = Date.now();
      const newId = "cma-" + now;
      const copy: SavedCMA = {
        ...JSON.parse(JSON.stringify(orig)),
        id: newId,
        name: orig.name + " (copy)",
        createdAt: now,
        updatedAt: now,
      };
      commit([copy, ...cmas]);
      return newId;
    },
    [cmas, commit]
  );

  return { cmas, ready, saveCMA, deleteCMA, duplicateCMA };
}
