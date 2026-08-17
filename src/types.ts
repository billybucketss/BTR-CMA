export interface Floorplan {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  garage: string | null;
  subtype: string | null;
  rent: number | null;
  rent_psf: number | null;
  units?: number | null;
  flag?: string | null;
}

export interface Property {
  id: string;
  type: string; // "BTR TH" | "BTR SF" | "BTR TH/SF" | "APT"
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  unit_count: string | null;
  year_built: string | null;
  notes: string | null;
  website: string | null;
  school_district: string | null;
  floorplans: Floorplan[];
  rent_min: number | null;
  rent_max: number | null;
  source?: string;
  market?: string | null;
  owner?: string | null;
  lat?: number | null;
  lng?: number | null;

  // CoStar-derived optional fields
  submarket?: string | null;
  building_status?: string | null;
  vacancy_pct?: number | null;
  avg_asking_unit?: number | null;
  avg_asking_sf?: number | null;
  concessions_pct?: number | null;
  amenities?: string | null;
  owner_name?: string | null;
  owner_contact?: string | null;
  owner_phone?: string | null;
}
