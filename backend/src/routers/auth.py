from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..utils.auth import authenticate_user, create_access_token
from ..database.database import get_db

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/login")
def login(
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
):
    # form_data.username - это ИИН
    user = authenticate_user(db, iin=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный ИИН или пароль"
        )
    
    # Создаем токен, в который записываем ИИН пользователя
    access_token = create_access_token(data={"sub": user.iin})
    
    return {"access_token": access_token, "token_type": "bearer"}
