export type Sector = { id: number; name: string };

export type Department = {
  id: number;
  name: string;
  sector?: Sector;
};

export type IndicatorGroup = {
  id: number;
  name: string;
  unit?: string;
  is_label?: boolean;
  display_order?: number | null;
  status?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  parent_id?: number | null;
  parent?: { id: number; name: string; hierarchy_path?: string };
  department?: Department;
  sector?: Sector;
  hierarchy_path?: string;
};
