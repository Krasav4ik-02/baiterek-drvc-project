from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import User

# --- Конфигурация ---
SECRET_KEY = "a_very_secret_key_that_should_be_in_env_vars"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 часа

# --- Утилиты для паролей и токенов ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    # В нашей новой модели нет паролей, поэтому просто возвращаем True
    # В реальном приложении здесь была бы проверка хэша
    return True

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Основные функции для аутентификации и авторизации ---

def authenticate_user(db: Session, iin: str, password: str) -> Optional[User]:
    """
    Ищет пользователя по ИИН. 
    В этой версии пароль не проверяется, т.к. его нет в модели.
    В реальном приложении здесь была бы проверка пароля.
    """
    user = db.query(User).filter(User.iin == iin).first()
    if not user:
        return None
    # if not verify_password(password, user.hashed_password): # Если бы был пароль
    #     return None
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Декодирует токен, извлекает ИИН пользователя и возвращает объект User из БД.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        iin: str = payload.get("sub")
        if iin is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.iin == iin).first()
    if user is None:
        raise credentials_exception
    return user
