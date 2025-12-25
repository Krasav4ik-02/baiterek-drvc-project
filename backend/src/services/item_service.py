from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from decimal import Decimal
from fastapi import HTTPException, status
from ..models import models
from ..schemas import plan as plan_schema
from .plan_service import _recalculate_version_metrics

def get_item(db: Session, item_id: int) -> models.PlanItemVersion | None:
    """Получает конкретную позицию плана по ее ID, если она не удалена."""
    return db.query(models.PlanItemVersion).options(
        joinedload(models.PlanItemVersion.version).joinedload(models.ProcurementPlanVersion.plan)
    ).filter(
        models.PlanItemVersion.id == item_id,
        models.PlanItemVersion.is_deleted == False
    ).first()

def update_item(db: Session, item_id: int, item_in: plan_schema.PlanItemUpdate, user: models.User) -> models.PlanItemVersion:
    """Обновляет позицию плана."""
    db_item = get_item(db, item_id)
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Позиция не найдена")

    version = db_item.version
    if version.status != models.PlanStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Редактирование запрещено, версия не в статусе 'Черновик'.")
    
    plan = version.plan
    if plan.created_by != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет прав для редактирования этой позиции.")

    update_data = item_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)

    if 'quantity' in update_data or 'price_per_unit' in update_data:
        db_item.total_amount = (db_item.quantity or 0) * (db_item.price_per_unit or 0)

    if 'trucode' in update_data:
        enstru_item = db.query(models.Enstru).filter(models.Enstru.code == update_data['trucode']).first()
        if enstru_item:
            db_item.need_type = models.NeedType(enstru_item.type_ru)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Код ЕНС ТРУ '{update_data['trucode']}' не найден.")

    db.commit()
    _recalculate_version_metrics(db, version.id)
    db.refresh(db_item)
    return db_item

def delete_item(db: Session, item_id: int, user: models.User) -> bool:
    """
    Выполняет "мягкое удаление" позиции плана.
    Вместо физического удаления устанавливает флаг is_deleted = True.
    """
    db_item = get_item(db, item_id)
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Позиция не найдена")

    version = db_item.version
    if version.status != models.PlanStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Удаление запрещено, версия не в статусе 'Черновик'.")

    plan = version.plan
    if plan.created_by != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет прав для удаления этой позиции.")

    db_item.is_deleted = True
    db.commit()
    
    _recalculate_version_metrics(db, version.id)
    
    return True
