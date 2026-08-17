import { useCallback, useEffect, useState } from "react";
import type { Property } from "../types";
import { SEED_PROPERTIES } from "../data/seed";

const KEY = "btr_properties_v1";

function load(): Property[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Property[];
  } catch {
    // ignore corrupt storage and fall back to seed
  }
  return SEED_PROPERTIES;
}

function save(props: Property[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(props));
  } catch {
    // storage full or unavailable — keep working in memory
  }
}

export function computeRentRange(p: Property): {
  rent_min: number | null;
  rent_max: number | null;
} {
  const rents = p.floorplans.map((f) => f.rent).filter((x): x is number => x != null);
  return {
    rent_min: rents.length ? Math.min(...rents) : null,
    rent_max: rents.length ? Math.max(...rents) : null,
  };
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProperties(load());
    setReady(true);
  }, []);

  const commit = useCallback((next: Property[]) => {
    setProperties(next);
    save(next);
  }, []);

  const addProperty = useCallback(
    (p: Omit<Property, "id">) => {
      const rec: Property = { id: "u-" + Date.now(), ...p };
      commit([rec, ...properties]);
    },
    [properties, commit]
  );

  const addMany = useCallback(
    (incoming: Property[]) => {
      commit([...incoming, ...properties]);
    },
    [properties, commit]
  );

  const updateProperty = useCallback(
    (id: string, patch: Partial<Property>) => {
      commit(properties.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [properties, commit]
  );

  const deleteProperty = useCallback(
    (id: string) => {
      commit(properties.filter((p) => p.id !== id));
    },
    [properties, commit]
  );

  const resetToSeed = useCallback(() => {
    commit(SEED_PROPERTIES);
  }, [commit]);

  return {
    properties,
    ready,
    addProperty,
    addMany,
    updateProperty,
    deleteProperty,
    resetToSeed,
  };
}
