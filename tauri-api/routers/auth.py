# [ADDED v2.0] Router de autenticación JWT — registro, login, logout y perfil
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, Session as SessionModel, UserProgress
from middleware.auth_middleware import (
    hash_password,
    verify_password,
    create_jwt_token,
    get_current_user,
    require_auth
)
from middleware.usage import get_user_plan, count_today_translations, LIMITS

router = APIRouter()

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str

# [ADDED v2.0] Registro de usuario nuevo
@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        is_anonymous=False,
        daily_translations=0,
        daily_reset_date=datetime.utcnow().date()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # [ADDED v2.0] Crear progreso inicial
    progress = UserProgress(user_id=user.id, current_level="A1")
    db.add(progress)
    db.commit()

    token = create_jwt_token(user.id, user.email)
    session = SessionModel(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(session)
    db.commit()

    return {"token": token, "user_id": user.id, "email": user.email}

# [ADDED v2.0] Login de usuario existente
@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_jwt_token(user.id, user.email)
    session = SessionModel(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(session)
    db.commit()

    return {"token": token, "user_id": user.id, "email": user.email}

# [ADDED v2.0] Logout — desactiva la sesión activa
@router.post("/logout")
def logout(user: User = Depends(require_auth), db: Session = Depends(get_db)):
    # Nota: require_auth no expone el token crudo. Usamos una aproximación simple:
    # desactivamos todas las sesiones activas del usuario.
    db.query(SessionModel).filter(
        SessionModel.user_id == user.id,
        SessionModel.is_active == True
    ).update({"is_active": False})
    db.commit()
    return {"success": True}

# [ADDED v2.0] Perfil del usuario autenticado
@router.get("/me")
def me(user: User = Depends(require_auth), db: Session = Depends(get_db)):
    from db.new_models import Subscription

    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    plan = get_user_plan(user, db)
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    limit = LIMITS.get(plan, 15)
    used_today = count_today_translations(user.id, db)

    return {
        "user_id": user.id,
        "email": user.email,
        "is_anonymous": user.is_anonymous,
        "daily_translations": used_today,
        "current_level": progress.current_level if progress else "A1",
        # [ADDED MVP-v1]
        "plan": plan,
        "translations_limit": limit,
        "translations_remaining": -1 if limit == -1 else max(0, limit - used_today),
        "subscription_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None
    }
