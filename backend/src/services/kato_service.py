from sqlalchemy.orm import Session
from ..models.models import Kato

def get_kato_children(db: Session, parent_id: int | None = 0):
    """
    Получает дочерние элементы KATO и для каждого из них определяет,
    есть ли у него свои дочерние элементы.
    """
    # Сначала получаем все дочерние элементы для указанного родителя
    kato_items = db.query(Kato).filter(Kato.parent_id == parent_id).all()

    results = []
    for item in kato_items:
        # Для каждого элемента делаем простой запрос, чтобы проверить наличие его детей
        has_children = db.query(Kato.id).filter(Kato.parent_id == item.id).first() is not None
        results.append({
            "id": item.id,
            "parent_id": item.parent_id,
            "code": item.code,
            "name_kz": item.name_kz,
            "name_ru": item.name_ru,
            "has_children": has_children,
        })
    return results

def get_kato_by_id(db: Session, kato_id: int):
    """
    Получает один элемент KATO по его ID и определяет, есть ли у него дочерние элементы.
    """
    kato_item = db.query(Kato).filter(Kato.id == kato_id).first()
    if not kato_item:
        return None
    
    has_children = db.query(Kato.id).filter(Kato.parent_id == kato_item.id).first() is not None
    
    return {
        "id": kato_item.id,
        "parent_id": kato_item.parent_id,
        "code": kato_item.code,
        "name_kz": kato_item.name_kz,
        "name_ru": kato_item.name_ru,
        "has_children": has_children,
    }

def get_kato_parents(db: Session, kato_id: int):
    """
    Получает всех родительских элементов для указанного KATO.
    """
    parents = []
    # Используем get() для безопасного доступа к ключам словаря
    current_kato_dict = get_kato_by_id(db, kato_id)
    
    # Проверяем, что parent_id существует и не равен 0
    while current_kato_dict and current_kato_dict.get('parent_id'):
        parent_id = current_kato_dict.get('parent_id')
        if not parent_id:
            break
        
        parent_dict = get_kato_by_id(db, parent_id)
        if parent_dict:
            parents.insert(0, parent_dict)
            current_kato_dict = parent_dict
        else:
            break
    return parents
