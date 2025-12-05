from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database.database import get_db
from src.schemas import plan as plan_schema, lookup as lookup_schema
from src.services import plan_service
from src.utils.auth import get_current_user
from src.models import models

router = APIRouter(
    prefix="/items",
    tags=["Plan Items"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/{item_id}/edit-data", response_model=plan_schema.SmetaItemEditResponse) # Изменено здесь
def get_item_with_edit_data(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Возвращает позицию сметы и полные объекты для связанных справочников,
    чтобы фронтенд мог корректно отобразить их в Autocomplete.
    """
    db_item = plan_service.get_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Позиция сметы не найдена")
    if db_item.plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для доступа к этой позиции")

    initial_options = lookup_schema.InitialOptions(
        enstru=db_item.enstru,
        kato_purchase=db_item.kato_purchase,
        kato_delivery=db_item.kato_delivery,
        agsk=db_item.agsk,
        cost_item=db_item.expense_item,
        source_funding=db_item.funding_source,
        mkei=db_item.unit
    )

    return plan_schema.SmetaItemEditResponse(item=db_item, initial_options=initial_options) # И здесь


@router.get("/{item_id}", response_model=plan_schema.PlanItem)
def read_plan_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить одну позицию сметы по ее ID."""
    db_item = plan_service.get_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Позиция сметы не найдена")
    if db_item.plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для доступа к этой позиции")
    return db_item

@router.put("/{item_id}", response_model=plan_schema.PlanItem)
def update_plan_item(
    item_id: int,
    item_in: plan_schema.PlanItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Обновить позицию сметы по ее ID."""
    db_item = plan_service.get_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Позиция сметы не найдена")
    if db_item.plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для изменения этой позиции")
    return plan_service.update_item(db=db, item_id=item_id, item_in=item_in)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить позицию сметы по ее ID."""
    db_item = plan_service.get_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Позиция сметы не найдена")
    if db_item.plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления этой позиции")
    plan_service.delete_item(db=db, item_id=item_id)
    return {"ok": True}
