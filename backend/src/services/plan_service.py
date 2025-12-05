from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from decimal import Decimal

from src.models import models
from src.schemas import plan as plan_schema

# ========= Сервисы для Смет Закупок (ProcurementPlan) =========

def create_plan(db: Session, plan_in: plan_schema.ProcurementPlanCreate, user: models.User) -> models.ProcurementPlan:
    db_plan = models.ProcurementPlan(**plan_in.dict(), created_by=user.id)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

def get_plan(db: Session, plan_id: int) -> models.ProcurementPlan | None:
    plan = db.query(models.ProcurementPlan).filter(models.ProcurementPlan.id == plan_id).first()
    if not plan:
        return None

    # Вычисляем суммы КТП и не-КТП
    ktp_sum_query = db.query(func.sum(models.PlanItem.total_amount)).filter(
        models.PlanItem.plan_id == plan_id,
        models.PlanItem.is_ktp == True
    ).scalar() or Decimal('0.00')

    non_ktp_sum_query = db.query(func.sum(models.PlanItem.total_amount)).filter(
        models.PlanItem.plan_id == plan_id,
        models.PlanItem.is_ktp == False
    ).scalar() or Decimal('0.00')

    # Добавляем вычисленные значения к объекту плана
    plan.ktp_amount = ktp_sum_query
    plan.non_ktp_amount = non_ktp_sum_query
    
    # Загружаем связанные позиции
    plan.items = db.query(models.PlanItem).options(
        joinedload(models.PlanItem.enstru),
        joinedload(models.PlanItem.unit),
        joinedload(models.PlanItem.expense_item),
        joinedload(models.PlanItem.funding_source),
        joinedload(models.PlanItem.agsk),
        joinedload(models.PlanItem.kato_purchase),
        joinedload(models.PlanItem.kato_delivery)
    ).filter(models.PlanItem.plan_id == plan_id).all()

    return plan

def get_plans_by_user(db: Session, user: models.User, skip: int = 0, limit: int = 100) -> list[models.ProcurementPlan]:
    return db.query(models.ProcurementPlan).filter(models.ProcurementPlan.created_by == user.id).offset(skip).limit(limit).all()

def delete_plan(db: Session, plan_id: int) -> bool:
    db_plan = db.query(models.ProcurementPlan).filter(models.ProcurementPlan.id == plan_id).first()
    if not db_plan: return False
    db.delete(db_plan)
    db.commit()
    return True

def _recalculate_plan_total(db: Session, plan_id: int):
    total = db.query(func.sum(models.PlanItem.total_amount)).filter(models.PlanItem.plan_id == plan_id).scalar() or Decimal('0.00')
    db.query(models.ProcurementPlan).filter(models.ProcurementPlan.id == plan_id).update({'total_amount': total})
    db.commit()

# ========= Сервисы для Позиций Сметы (PlanItem) =========

def add_item_to_plan(db: Session, plan_id: int, item_in: plan_schema.PlanItemCreate, user: models.User) -> models.PlanItem:
    plan = get_plan(db, plan_id)
    if not plan: raise ValueError("Смета не найдена")

    enstru_item = db.query(models.Enstru).filter(models.Enstru.code == item_in.trucode).first()
    if not enstru_item: raise ValueError("ЕНС ТРУ не найден")

    last_item = db.query(models.PlanItem).filter(models.PlanItem.plan_id == plan_id).order_by(models.PlanItem.item_number.desc()).first()
    item_number = (last_item.item_number + 1) if last_item else 1
    
    total_amount = item_in.quantity * item_in.price_per_unit

    db_item = models.PlanItem(
        **item_in.dict(),
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
    return db.query(models.PlanItem).filter(models.PlanItem.id == item_id).first()

def update_item(db: Session, item_id: int, item_in: plan_schema.PlanItemUpdate) -> models.PlanItem | None:
    db_item = get_item(db, item_id)
    if not db_item: return None

    update_data = item_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
        
    if 'quantity' in update_data or 'price_per_unit' in update_data:
        db_item.total_amount = db_item.quantity * db_item.price_per_unit

    if 'trucode' in update_data:
        enstru_item = db.query(models.Enstru).filter(models.Enstru.code == update_data['trucode']).first()
        if enstru_item: db_item.need_type = models.NeedType(enstru_item.type_ru)

    db.commit()
    _recalculate_plan_total(db, db_item.plan_id)
    db.refresh(db_item)
    return db_item

def delete_item(db: Session, item_id: int) -> bool:
    db_item = get_item(db, item_id)
    if not db_item: return False
    plan_id = db_item.plan_id
    db.delete(db_item)
    db.commit()
    _recalculate_plan_total(db, plan_id)
    return True
