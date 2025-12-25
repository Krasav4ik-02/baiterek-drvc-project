// --- Типы Справочников ---
export interface Mkei { id: number; code: string; name_ru: string; name_kz: string; }
export interface Kato { id: number; parent_id: number | null; code: string; name_ru: string; name_kz: string; }
export interface Agsk { id: number; group: string; code: string; name_ru: string; }
export interface CostItem { id: number; name_ru: string; name_kz: string; }
export interface SourceFunding { id: number; name_ru: string; name_kz: string; }
export interface Enstru { id: number; code: string; name_ru: string; name_kz: string; type_ru: string; specs_ru?: string; }
export interface UserLookup { id: number; full_name: string; }

// --- Основные Типы ---
export type NeedType = "Товар" | "Работа" | "Услуга";
export enum PlanStatus {
  DRAFT = "DRAFT",
  PRE_APPROVED = "PRE_APPROVED",
  APPROVED = "APPROVED",
}

export interface PlanItemVersion {
  id: number;
  version_id: number;
  item_number: number;
  need_type: NeedType;
  trucode: string;
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  is_ktp: boolean;
  is_resident: boolean;
  created_at: string;
  version: ProcurementPlanVersion; // Для контекста

  enstru?: Enstru;
  unit?: Mkei;
  expense_item?: CostItem;
  funding_source?: SourceFunding;
  agsk?: Agsk;
  kato_purchase?: Kato;
  kato_delivery?: Kato;
}

export interface ProcurementPlanVersion {
  id: number;
  plan_id: number;
  version_number: number;
  status: PlanStatus;
  total_amount: number;
  ktp_percentage: number;
  import_percentage: number;
  is_active: boolean;
  created_at: string;
  creator: UserLookup;
  items?: PlanItemVersion[];
}

export interface ProcurementPlan {
  id: number;
  plan_name: string; // Новое поле
  year: number;
  created_by: number;
  created_at: string;
  versions: ProcurementPlanVersion[];
}

export interface PlanItemPayload {
  trucode: string;
  unit_id?: number;
  expense_item_id: number;
  funding_source_id: number;
  agsk_id?: string;
  kato_purchase_id?: number;
  kato_delivery_id?: number;
  quantity: number;
  price_per_unit: number;
  is_ktp: boolean;
  is_resident: boolean;
}
