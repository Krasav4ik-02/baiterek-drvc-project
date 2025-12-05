import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Типы Справочников ---
export interface Mkei { id: number; code: string; name_ru: string; name_kz: string; }
export interface Kato { id: number; code: string; name_ru: string; name_kz: string; }
export interface Agsk { id: number; code: string; name_ru: string; }
export interface CostItem { id: number; name_ru: string; name_kz: string; }
export interface SourceFunding { id: number; name_ru: string; name_kz: string; }
export interface Enstru { id: number; code: string; name_ru: string; name_kz: string; type_ru: string; specs_ru?: string; }

// --- Основные Типы ---
export type NeedType = "Товар" | "Работа" | "Услуга";

export interface Smeta {
  id: number;
  year: number;
  total_amount: number;
  ktp_amount?: number; // Новое поле
  non_ktp_amount?: number; // Новое поле
  items: SmetaItem[];
}

// Схема для чтения: содержит вложенные объекты
export interface SmetaItem {
  id: number;
  plan_id: number;
  item_number: number;
  need_type: NeedType;
  additional_specs?: string;
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  is_ktp: boolean;
  is_resident: boolean;
  ktp_applicable: boolean;
  
  enstru: Enstru;
  unit?: Mkei;
  expense_item: CostItem;
  funding_source: SourceFunding;
  agsk?: Agsk;
  kato_purchase?: Kato;
  kato_delivery?: Kato;
}

// Схема для создания/обновления: содержит ID/коды
export interface SmetaItemPayload {
  trucode: string;
  unit_id?: number;
  expense_item_id: number;
  funding_source_id: number;
  agsk_id?: string;
  kato_purchase_id?: number;
  kato_delivery_id?: number;
  additional_specs?: string;
  quantity: number;
  price_per_unit: number;
  is_ktp: boolean;
  is_resident: boolean;
  ktp_applicable: boolean;
}

export interface SmetaItemEditData {
    item: SmetaItem;
}

// --- API для Справочников ---
export const getMkei = (q?: string): Promise<Mkei[]> => api.get('/lookups/mkei', { params: { q } }).then(res => res.data);
export const getKato = (q?: string): Promise<Kato[]> => api.get('/lookups/kato', { params: { q } }).then(res => res.data);
export const getAgsk = (q?: string): Promise<Agsk[]> => api.get('/lookups/agsk', { params: { q } }).then(res => res.data);
export const getCostItems = (q?: string): Promise<CostItem[]> => api.get('/lookups/cost-items', { params: { q } }).then(res => res.data);
export const getSourceFunding = (q?: string): Promise<SourceFunding[]> => api.get('/lookups/source-funding', { params: { q } }).then(res => res.data);
export const getEnstru = (q?: string): Promise<Enstru[]> => api.get('/lookups/enstru', { params: { q } }).then(res => res.data);
export const checkKtp = (enstruCode: string): Promise<{ is_ktp: boolean }> => api.get(`/lookups/check-ktp/${enstruCode}`).then(res => res.data);

// --- API для Смет ---
export const getSmetas = (): Promise<Smeta[]> => api.get('/plans/').then(res => res.data);
export const getSmetaById = (smetaId: number): Promise<Smeta> => api.get(`/plans/${smetaId}`).then(res => res.data);
export const createSmeta = (data: { year: number }): Promise<Smeta> => api.post('/plans/', data).then(res => res.data);
export const deleteSmeta = (smetaId: number): Promise<void> => api.delete(`/plans/${smetaId}`);

// --- API для Позиций Сметы ---
export const getSmetaItemEditData = (itemId: number): Promise<SmetaItemEditData> => api.get(`/items/${itemId}/edit-data`).then(res => res.data);
export const addItemToSmeta = (smetaId: number, itemData: SmetaItemPayload): Promise<SmetaItem> => api.post(`/plans/${smetaId}/items`, itemData).then(res => res.data);
export const updateItem = (itemId: number, itemData: Partial<SmetaItemPayload>): Promise<SmetaItem> => api.put(`/items/${itemId}`, itemData).then(res => res.data);
export const deleteItem = (itemId: number): Promise<void> => api.delete(`/items/${itemId}`);

export default api;
