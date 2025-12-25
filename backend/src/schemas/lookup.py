from pydantic import BaseModel
from typing import Optional
from datetime import date

# Схема для User (для отображения в других схемах)
class UserLookup(BaseModel):
    id: int
    full_name: str

    class Config:
        from_attributes = True

# Схема для Mkei
class Mkei(BaseModel):
    id: int
    code: str
    name_kz: str
    name_ru: str

    class Config:
        from_attributes = True

# Схема для Kato
class Kato(BaseModel):
    id: int
    code: str
    name_kz: str
    name_ru: str

    class Config:
        from_attributes = True

# Схема для Agsk
class Agsk(BaseModel):
    id: int
    group: str
    code: str
    name_ru: str
    standart: Optional[str] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True

# Схема для Cost_Item
class CostItem(BaseModel):
    id: int
    name_ru: str
    name_kz: str

    class Config:
        from_attributes = True

# Схема для Source_Funding
class SourceFunding(BaseModel):
    id: int
    name_ru: str
    name_kz: str

    class Config:
        from_attributes = True

# Схема для Enstru
class Enstru(BaseModel):
    id: int
    code: str
    name_ru: str
    name_kz: str
    type_ru: str
    type_kz: str
    specs_ru: Optional[str] = None
    specs_kz: Optional[str] = None

    class Config:
        from_attributes = True

# --- Схемы для ответа эндпоинта редактирования ---

class InitialOptions(BaseModel):
    enstru: Optional[Enstru] = None
    kato_purchase: Optional[Kato] = None
    kato_delivery: Optional[Kato] = None
    agsk: Optional[Agsk] = None
    cost_item: Optional[CostItem] = None
    source_funding: Optional[SourceFunding] = None
    mkei: Optional[Mkei] = None
