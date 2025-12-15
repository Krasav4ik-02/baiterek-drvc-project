from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from decimal import Decimal
from fastapi import HTTPException, status
import io
import openpyxl
from ..models import models
from ..schemas import plan as plan_schema


# ========= Вспомогательные функции =========

def _calculate_and_store_plan_metrics(db: Session, plan: models.ProcurementPlan, is_final: bool):
    """Рассчитывает и сохраняет метрики для плана (КТП, импорт, общая сумма)."""

    # Используем SQLAlchemy выражения
    total_result = db.query(func.sum(models.PlanItem.total_amount)).filter(
        models.PlanItem.plan_id == plan.id
    ).first()

    ktp_result = db.query(func.sum(models.PlanItem.total_amount)).filter(
        models.PlanItem.plan_id == plan.id,
        models.PlanItem.is_ktp == True  # SQL выражение
    ).first()

    total_amount = total_result[0] if total_result[0] is not None else Decimal('0.00')
    ktp_amount = ktp_result[0] if ktp_result[0] is not None else Decimal('0.00')

    ktp_percentage = (ktp_amount / total_amount * 100) if total_amount > 0 else Decimal('0.00')
    import_percentage = Decimal('100.00') - ktp_percentage

    if is_final:
        plan.final_total_amount = total_amount
        plan.final_ktp_percentage = ktp_percentage
        plan.final_import_percentage = import_percentage
    else:
        plan.pre_approved_total_amount = total_amount
        plan.pre_approved_ktp_percentage = ktp_percentage
        plan.pre_approved_import_percentage = import_percentage

    db.commit()


def _recalculate_plan_total(db: Session, plan_id: int):
    """Пересчитывает общую сумму плана."""
    total = db.query(func.sum(models.PlanItem.total_amount)).filter(
        models.PlanItem.plan_id == plan_id
    ).scalar() or Decimal('0.00')

    db.query(models.ProcurementPlan).filter(
        models.ProcurementPlan.id == plan_id
    ).update({'total_amount': total})
    db.commit()


# ========= Сервисы для Смет Закупок (ProcurementPlan) =========

def create_plan(db: Session, plan_in: plan_schema.ProcurementPlanCreate, user: models.User) -> models.ProcurementPlan:
    db_plan = models.ProcurementPlan(**plan_in.model_dump(), created_by=user.id, status=models.PlanStatus.DRAFT)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


def get_plan(db: Session, plan_id: int) -> models.ProcurementPlan | None:
    plan = db.query(models.ProcurementPlan).options(
        joinedload(models.ProcurementPlan.items).options(
            joinedload(models.PlanItem.enstru),
            joinedload(models.PlanItem.unit),
            joinedload(models.PlanItem.expense_item),
            joinedload(models.PlanItem.funding_source),
            joinedload(models.PlanItem.agsk),
            joinedload(models.PlanItem.kato_purchase),
            joinedload(models.PlanItem.kato_delivery)
        )
    ).filter(models.ProcurementPlan.id == plan_id).first()

    if not plan:
        return None

    # Используем SQLAlchemy для подсчета
    ktp_sum = db.query(func.sum(models.PlanItem.total_amount)).filter(
        models.PlanItem.plan_id == plan_id,
        models.PlanItem.is_ktp == True  # SQL выражение
    ).scalar() or Decimal('0.00')

    plan.ktp_amount = ktp_sum
    plan.non_ktp_amount = plan.total_amount - ktp_sum

    return plan


def get_plans_by_user(db: Session, user: models.User, skip: int = 0, limit: int = 100) -> list[models.ProcurementPlan]:
    return db.query(models.ProcurementPlan).filter(
        models.ProcurementPlan.created_by == user.id
    ).offset(skip).limit(limit).all()


def update_plan(db: Session, plan_id: int, plan_in: plan_schema.ProcurementPlanUpdate) -> models.ProcurementPlan:
    db_plan = get_plan(db, plan_id)
    update_data = plan_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_plan, key, value)
    db.commit()
    db.refresh(db_plan)
    return db_plan


def update_plan_status(db: Session, plan_id: int, new_status: models.PlanStatus) -> models.ProcurementPlan:
    db_plan = get_plan(db, plan_id)
    current_status = db_plan.status

    if current_status == models.PlanStatus.DRAFT and new_status == models.PlanStatus.PRE_APPROVED:
        _calculate_and_store_plan_metrics(db, db_plan, is_final=False)
        db_plan.status = new_status
    elif current_status == models.PlanStatus.PRE_APPROVED and new_status == models.PlanStatus.APPROVED:
        _calculate_and_store_plan_metrics(db, db_plan, is_final=True)
        db_plan.status = new_status
    elif current_status == new_status:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый переход статуса из {current_status.value} в {new_status.value}"
        )

    db.commit()
    db.refresh(db_plan)
    return db_plan


def delete_plan(db: Session, plan_id: int) -> bool:
    db_plan = db.query(models.ProcurementPlan).filter(
        models.ProcurementPlan.id == plan_id
    ).first()
    if not db_plan:
        return False
    db.delete(db_plan)
    db.commit()
    return True


def export_plan_to_excel(db: Session, plan_id: int) -> bytes:
    plan = get_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Смета не найдена")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Смета {plan.id}"

    headers = [
        "№", "Код ЕНС ТРУ", "Наименование", "Доп. спецификация", "Ед. изм.",
        "Кол-во", "Цена за ед.", "Общая сумма", "КТП", "Резидент"
    ]
    ws.append(headers)

    for item in plan.items:
        # Для Excel можно оставить как есть или использовать bool()
        row = [
            item.item_number,
            item.trucode,
            item.enstru.name_ru if item.enstru else "",
            item.additional_specs or "",
            item.unit.name_ru if item.unit else "",
            item.quantity,
            item.price_per_unit,
            item.total_amount,
            "Да" if bool(item.is_ktp) else "Нет",  # Преобразуем в bool
            "Да" if bool(item.is_resident) else "Нет",
        ]
        ws.append(row)

    virtual_workbook = io.BytesIO()
    wb.save(virtual_workbook)
    return virtual_workbook.getvalue()


# ========= Сервисы для Позиций Сметы (PlanItem) =========

def add_item_to_plan(db: Session, plan_id: int, item_in: plan_schema.PlanItemCreate,
                     user: models.User) -> models.PlanItem:
    plan = get_plan(db, plan_id)
    if not plan:
        raise ValueError("Смета не найдена")

    enstru_item = db.query(models.Enstru).filter(
        models.Enstru.code == item_in.trucode
    ).first()
    if not enstru_item:
        raise ValueError("ЕНС ТРУ не найден")

    last_item = db.query(models.PlanItem).filter(
        models.PlanItem.plan_id == plan_id
    ).order_by(desc(models.PlanItem.item_number)).first()

    item_number = (last_item.item_number + 1) if last_item else 1

    total_amount = item_in.quantity * item_in.price_per_unit

    db_item = models.PlanItem(
        **item_in.model_dump(),
        plan_id=plan_id,
        item_number=item_number,
        total_amount=total_amount,
        need_type=models.NeedType(enstru_item.type_ru),
        created_by=user.id
    )
    db.add(db_item)
    db.commit()

    _recalculate_plan_total(db, plan_id)

    db.refresh(db_item)
    return db_item


def get_item(db: Session, item_id: int) -> models.PlanItem | None:
    return db.query(models.PlanItem).filter(
        models.PlanItem.id == item_id
    ).first()


def update_item(db: Session, item_id: int, item_in: plan_schema.PlanItemUpdate) -> models.PlanItem | None:
    db_item = get_item(db, item_id)
    if not db_item:
        return None

    db_plan = get_plan(db, db_item.plan_id)
    if db_plan.status == models.PlanStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Редактирование запрещено, смета находится в финальном статусе.")

    update_data = item_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)

    if 'quantity' in update_data or 'price_per_unit' in update_data:
        db_item.total_amount = db_item.quantity * db_item.price_per_unit

    if 'trucode' in update_data:
        enstru_item = db.query(models.Enstru).filter(
            models.Enstru.code == update_data['trucode']
        ).first()
        if enstru_item:
            db_item.need_type = models.NeedType(enstru_item.type_ru)

    db.commit()
    _recalculate_plan_total(db, db_item.plan_id)
    db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int) -> bool:
    db_item = get_item(db, item_id)
    if not db_item:
        return False

    db_plan = get_plan(db, db_item.plan_id)
    if db_plan.status == models.PlanStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Удаление запрещено, смета находится в финальном статусе.")

    plan_id_val = db_item.plan_id
    db.delete(db_item)
    db.commit()
    _recalculate_plan_total(db, plan_id_val)
    return True