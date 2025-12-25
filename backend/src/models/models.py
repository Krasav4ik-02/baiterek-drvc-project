from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, SmallInteger, UniqueConstraint, Enum, and_
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database.base import Base
import enum


class PlanStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PRE_APPROVED = "PRE_APPROVED"
    APPROVED = "APPROVED"


class NeedType(enum.Enum):
    GOODS = "Товар"
    WORKS = "Работа"
    SERVICES = "Услуга"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    iin = Column(String(12), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    bin = Column(String(12), index=True)
    org_name = Column(String(500))
    email = Column(String(255))
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    plans = relationship("ProcurementPlan", back_populates="creator")

class ProcurementPlan(Base):
    __tablename__ = "procurement_plans"

    id = Column(Integer, primary_key=True)
    plan_name = Column(String(128), nullable=False) # Новое поле
    year = Column(SmallInteger, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User")
    versions = relationship(
        "ProcurementPlanVersion",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="ProcurementPlanVersion.version_number"
    )

class ProcurementPlanVersion(Base):
    __tablename__ = "procurement_plan_versions"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("procurement_plans.id", ondelete="CASCADE"))
    version_number = Column(Integer, nullable=False)

    status = Column(Enum(PlanStatus), nullable=False)

    total_amount = Column(Numeric(20, 2), default=0)
    ktp_percentage = Column(Numeric(5, 2))
    import_percentage = Column(Numeric(5, 2))

    is_active = Column(Boolean, default=True)

    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("ProcurementPlan", back_populates="versions")
    
    items = relationship(
        "PlanItemVersion",
        back_populates="version",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("plan_id", "version_number", name="uq_plan_version"),
    )
    creator = relationship("User")

class PlanItemVersion(Base):
    __tablename__ = "plan_item_versions"

    id = Column(Integer, primary_key=True)
    version_id = Column(
        Integer,
        ForeignKey("procurement_plan_versions.id", ondelete="CASCADE"),
        nullable=False
    )

    item_number = Column(Integer, nullable=False)
    need_type = Column(Enum(NeedType), nullable=False)

    trucode = Column(String(35), ForeignKey("enstru.code"), nullable=False)
    unit_id = Column(Integer, ForeignKey("mkei.id"))
    expense_item_id = Column(Integer, ForeignKey("cost_items.id"), nullable=False)
    funding_source_id = Column(Integer, ForeignKey("source_funding.id"), nullable=False)

    agsk_id = Column(String(50), ForeignKey("agsk.code"))
    kato_purchase_id = Column(Integer, ForeignKey("kato.id"))
    kato_delivery_id = Column(Integer, ForeignKey("kato.id"))

    quantity = Column(Numeric(12, 3), nullable=False)
    price_per_unit = Column(Numeric(18, 2), nullable=False)
    total_amount = Column(Numeric(18, 2), nullable=False)

    is_ktp = Column(Boolean, default=False)
    is_resident = Column(Boolean, default=False)
    
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    version = relationship("ProcurementPlanVersion", back_populates="items")
    enstru = relationship("Enstru")
    unit = relationship("Mkei")
    expense_item = relationship("Cost_Item")
    funding_source = relationship("Source_Funding")
    agsk = relationship("Agsk")
    kato_purchase = relationship("Kato", foreign_keys=[kato_purchase_id])
    kato_delivery = relationship("Kato", foreign_keys=[kato_delivery_id])

    __table_args__ = (
        UniqueConstraint("version_id", "item_number", name="uq_version_item"),
    )


class Mkei(Base):
    __tablename__ = "mkei"
    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False)
    name_kz = Column(Text, nullable=False)
    name_ru = Column(Text, nullable=False)

class Kato(Base):
    __tablename__ = "kato"
    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer)
    code = Column(String(20), unique=True, nullable=False)
    name_kz = Column(Text, nullable=False)
    name_ru = Column(Text, nullable=False)

class Agsk(Base):
    __tablename__ = "agsk"
    id = Column(Integer, primary_key=True)
    group = Column(Text, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    name_ru = Column(Text, nullable=False)
    standart = Column(Text, nullable=True)
    unit = Column(Text, nullable=True)

class Cost_Item(Base):
    __tablename__ = "cost_items"
    id = Column(Integer, primary_key=True)
    name_ru = Column(Text, nullable=False)
    name_kz = Column(Text, nullable=False)

class Source_Funding(Base):
    __tablename__ = "source_funding"
    id = Column(Integer, primary_key=True)
    name_ru = Column(Text, nullable=False)
    name_kz = Column(Text, nullable=False)

class Enstru(Base):
    __tablename__ = "enstru"
    id = Column(Integer, primary_key=True)
    code = Column(String(35), unique=True, nullable=False)
    name_ru = Column(Text, nullable=False)
    name_kz = Column(Text, nullable=False)
    type_ru = Column(Text, nullable=False)
    type_kz = Column(Text, nullable=False)
    specs_ru = Column(Text, nullable=True)
    specs_kz = Column(Text, nullable=True)

class Reestr_KTP(Base):
    __tablename__ = "reestr_ktp"
    id = Column(Integer, primary_key=True)
    reg_number_application= Column(Integer)
    bin_iin = Column(String(12),nullable=False)
    full_name = Column(String(255), nullable=False)
    type_activity_oked = Column(String(30), nullable = False)
    kato_code = Column(String(30), nullable=False)
    actual_address = Column(Text)
    product_name_ru = Column(Text)
    product_name_kz = Column(Text)
    unit_per_year = Column(String(20),nullable=False)
    tn_ved = Column(String(10),nullable=True)
    kpved = Column(String(20),nullable=True)
    ens_tru_code = Column(String(35), nullable=False)
    agsk_code = Column(String(50), nullable=True)
    level_localization = Column(Integer)
    date_add_reestr = Column(Date)
