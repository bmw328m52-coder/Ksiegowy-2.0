export type MaterialCatalogItem = {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  default_price_gross: number | null;
  category: string | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialCatalogInput = {
  name: string;
  unit: string;
  default_price_gross?: number | null;
  category?: string | null;
  supplier?: string | null;
  notes?: string | null;
};

export type JobMaterial = {
  id: string;
  user_id: string;
  job_id: string;
  catalog_id: string | null;
  group_key: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_price_gross: number | null;
  notes: string | null;
  /** Klucz slotu auto-wyceny (np. "lakier_m2", "hinge_110_z"); NULL = pozycja ręczna. */
  auto_source: string | null;
  created_at: string;
  updated_at: string;
};

export type JobMaterialInput = {
  job_id: string;
  catalog_id?: string | null;
  group_key?: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_price_gross?: number | null;
  notes?: string | null;
  auto_source?: string | null;
};
