from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
from ..database.database import get_db
from ..schemas import plan as plan_schema
from ..services import plan_service
from ..utils.auth import get_current_user
from ..models import models

router = APIRouter(
    prefix="/plans",
    tags=["Procurement Plans"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/", response_model=plan_schema.ProcurementPlan, status_code=status.HTTP_201_CREATED)
def create_procurement_plan(
    plan_in: plan_schema.ProcurementPlanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Создать новую смету закупок."""
    return plan_service.create_plan(db=db, plan_in=plan_in, user=current_user)

@router.get("/", response_model=List[plan_schema.ProcurementPlan])
def read_user_procurement_plans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить список смет закупок для текущего пользователя."""
    plans = plan_service.get_plans_by_user(db, user=current_user, skip=skip, limit=limit)
    return plans

@router.get("/{plan_id}", response_model=plan_schema.ProcurementPlan)
def read_procurement_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить конкретную смету закупок по ID."""
    db_plan = plan_service.get_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    if db_plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для доступа к этой смете")
    return db_plan

@router.get("/{plan_id}/export-excel")
def export_plan_to_excel_endpoint(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Экспортировать смету в Excel."""
    db_plan = plan_service.get_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    if db_plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для доступа к этой смете")

    excel_data = plan_service.export_plan_to_excel(db, plan_id)
    
    return StreamingResponse(
        io.BytesIO(excel_data),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="smeta_{plan_id}.xlsx"'}
    )

@router.put("/{plan_id}", response_model=plan_schema.ProcurementPlan)
def update_procurement_plan(
    plan_id: int,
    plan_in: plan_schema.ProcurementPlanUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Обновить смету закупок."""
    db_plan = plan_service.get_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    if db_plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для обновления этой сметы")
    if db_plan.status == models.PlanStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Редактирование запрещено, смета находится в финальном статусе")
    return plan_service.update_plan(db=db, plan_id=plan_id, plan_in=plan_in)

@router.patch("/{plan_id}/status", response_model=plan_schema.ProcurementPlan)
def update_procurement_plan_status(
    plan_id: int,
    status_in: plan_schema.ProcurementPlanStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Обновить статус сметы закупок (DRAFT -> PRE_APPROVED -> APPROVED)."""
    db_plan = plan_service.get_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    if db_plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для изменения статуса этой сметы")

    return plan_service.update_plan_status(db=db, plan_id=plan_id, new_status=status_in.status)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_procurement_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить смету закупок."""
    db_plan = plan_service.get_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    if db_plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления этой сметы")
    if db_plan.status != models.PlanStatus.DRAFT:
        raise HTTPException(status_code=403, detail="Нельзя удалить утвержденную смету.")

    plan_service.delete_plan(db=db, plan_id=plan_id)
    return {"ok": True}

@router.post("/{plan_id}/items", response_model=plan_schema.PlanItem, status_code=status.HTTP_201_CREATED)
def create_plan_item_for_plan(
    plan_id: int,
    item_in: plan_schema.PlanItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Добавить новую позицию в смету."""
    db_plan = plan_service.get_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    if db_plan.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для добавления в эту смету")
    if db_plan.status == models.PlanStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Редактирование запрещено, смета находится в финальном статусе")

    try:
        return plan_service.add_item_to_plan(db=db, plan_id=plan_id, item_in=item_in, user=current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
