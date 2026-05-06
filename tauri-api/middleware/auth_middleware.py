# [ADDED v1.0] Middleware de autenticación JWT y gestión de usuarios anónimos
import os
from datetime import datetime, timedelta, date
from fastapi import Request, HTTPException, Header
from jose import jwt, JWTError
import bcrypt
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db.models import User, Session as SessionModel

# [ADDED v1.0] Configuración JWT desde variables de entorno
JWT_SECRET = os.getenv("JWT_SECRET", "fallback-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 30

# [ADDED v1.0] Utilidades de password con bcrypt directo (evita incompatibilidad passlib+bcrypt5)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# [ADDED v1.0] Utilidades JWT

def create_jwt_token(user_id: str, email: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# [ADDED v1.0] Crear usuario anónimo persistente por UUID de frontend
def get_or_create_anonymous_user(anonymous_id: str) -> User:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == anonymous_id, User.is_anonymous == True).first()
        if not user:
            user = User(
                id=anonymous_id,
                email=None,
                password_hash=None,
                is_anonymous=True,
                daily_translations=0,
                daily_reset_date=date.today()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        # Resetear contador si cambió el día
        if user.daily_reset_date != date.today():
            user.daily_translations = 0
            user.daily_reset_date = date.today()
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()

# [ADDED v1.0] Obtener usuario actual desde token o anonymous_id
def get_current_user(
    request: Request,
    authorization: str = Header(None)
) -> User:
    anonymous_id = request.headers.get("x-anonymous-id")

    if not authorization:
        if anonymous_id:
            return get_or_create_anonymous_user(anonymous_id)
        # [ADDED v1.0] Usuario anónimo temporal sin ID (el frontend maneja el límite)
        return User(
            id="",
            email=None,
            is_anonymous=True,
            daily_translations=0,
            daily_reset_date=date.today()
        )

    if authorization.lower().startswith("bearer "):
        token = authorization[7:]
    else:
        token = authorization

    try:
        payload = decode_jwt_token(token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    db = SessionLocal()
    try:
        session_record = db.query(SessionModel).filter(
            SessionModel.token == token,
            SessionModel.is_active == True,
            SessionModel.expires_at > datetime.utcnow()
        ).first()

        if not session_record:
            raise HTTPException(status_code=401, detail="Sesión inválida o expirada")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    finally:
        db.close()

# [ADDED v1.0] Requerir autenticación real (no anónima)
def require_auth(
    request: Request,
    authorization: str = Header(None)
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"error": "auth_required", "message": "Debés registrarte para usar esta función"}
        )

    if authorization.lower().startswith("bearer "):
        token = authorization[7:]
    else:
        token = authorization

    try:
        payload = decode_jwt_token(token)
    except HTTPException:
        raise HTTPException(
            status_code=401,
            detail={"error": "auth_required", "message": "Debés registrarte para usar esta función"}
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": "auth_required", "message": "Debés registrarte para usar esta función"}
        )

    db = SessionLocal()
    try:
        session_record = db.query(SessionModel).filter(
            SessionModel.token == token,
            SessionModel.is_active == True,
            SessionModel.expires_at > datetime.utcnow()
        ).first()

        if not session_record:
            raise HTTPException(
                status_code=401,
                detail={"error": "auth_required", "message": "Debés registrarte para usar esta función"}
            )

        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.is_anonymous:
            raise HTTPException(
                status_code=401,
                detail={"error": "auth_required", "message": "Debés registrarte para usar esta función"}
            )
        return user
    finally:
        db.close()
