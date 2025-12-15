from pydantic import BaseModel

class KatoSchema(BaseModel):
    id: int
    parent_id: int | None
    code: str
    name_kz: str
    name_ru: str
    has_children: bool

    class Config:
        from_attributes = True
