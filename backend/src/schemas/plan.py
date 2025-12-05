from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from src.models.models import NeedType
from . import lookup as lookup_schema

# ========= Схемы для Позиций Сметы (PlanItem) =========

class PlanItemBase(BaseModel):
    trucode: str = Field(..., description="Код ЕНС ТРУ")
    unit_id: Optional[int] = None
    expense_item_id: int
    funding_source_id: int
    agsk_id: Optional[str] = None
    kato_purchase_id: Optional[int] = None
    kato_delivery_id: Optional[int] = None
    additional_specs: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    price_per_unit: Decimal = Field(..., gt=0)
    is_ktp: bool = False
    is_resident: bool = False
    ktp_applicable: bool = False

class PlanItemCreate(PlanItemBase):
    pass

class PlanItemUpdate(PlanItemBase):
    trucode: Optional[str] = None
    unit_id: Optional[int] = None
    expense_item_id: Optional[int] = None
    funding_source_id: Optional[int] = None
    quantity: Optional[Decimal] = Field(None, gt=0)
    price_per_unit: Optional[Decimal] = Field(None, gt=0)
    is_ktp: Optional[bool] = None
    is_resident: Optional[bool] = None
    ktp_applicable: Optional[bool] = None

class PlanItem(BaseModel):
    id: int
    plan_id: int
    item_number: int
    need_type: NeedType
    additional_specs: Optional[str] = None
    quantity: Decimal
    price_per_unit: Decimal
    total_amount: Decimal
    is_ktp: bool
    is_resident: bool
    ktp_applicable: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    enstru: lookup_schema.Enstru
    unit: Optional[lookup_schema.Mkei] = None
    expense_item: lookup_schema.CostItem
    funding_source: lookup_schema.SourceFunding
    agsk: Optional[lookup_schema.Agsk] = None
    kato_purchase: Optional[lookup_schema.Kato] = None
    kato_delivery: Optional[lookup_schema.Kato] = None

    class Config:
        from_attributes = True

# ========= Схемы для Сметы Закупок (ProcurementPlan) =========

class ProcurementPlanBase(BaseModel):
    year: int

class ProcurementPlanCreate(ProcurementPlanBase):
    pass

class ProcurementPlanUpdate(ProcurementPlanBase):
    year: Optional[int] = None

class ProcurementPlan(ProcurementPlanBase):
    id: int
    total_amount: Decimal
    ktp_amount: Optional[Decimal] = 0 # Новое поле
    non_ktp_amount: Optional[Decimal] = 0 # Новое поле
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[PlanItem] = []

    class Config:
        from_attributes = True

# --- Схемы для ответа эндпоинта редактирования ---

class SmetaItemEditResponse(BaseModel):
    item: PlanItem
    initial_options: lookup_schema.InitialOptions
