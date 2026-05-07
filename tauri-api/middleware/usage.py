# [ADDED MVP-v1] Middleware de control de límites por plan
from datetime import datetime, date, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from db.models import User
from db.new_models import Subscription, UsageLog

LIMITS = {
    "free": 15,       # por día
    "pro_monthly": -1,  # ilimitado (-1)
    "pro_annual": -1,
    "anonymous": 15   # igual que free
}

def get_user_plan(user: User, db: Session) -> str:
    """Retorna el plan activo del usuario."""
    if not user or user.is_anonymous:
        return "anonymous"
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    if not sub:
        return "free"
    if sub.current_period_end and sub.current_period_end < datetime.utcnow():
        sub.status = "expired"
        db.commit()
        return "free"
    return sub.plan_type

def count_today_translations(user_id: str, db: Session) -> int:
    """Cuenta traducciones de hoy para un usuario."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    return db.query(UsageLog).filter(
        UsageLog.user_id == user_id,
        UsageLog.action_type == "translation",
        UsageLog.created_at >= today_start
    ).count()

def check_translation_limit(user: User, db: Session) -> dict:
    """
    Verifica si el usuario puede traducir.
    Retorna {"allowed": True, "remaining": N, "plan": "free"} o lanza HTTPException.
    """
    plan = get_user_plan(user, db)
    limit = LIMITS.get(plan, 15)

    if limit == -1:  # Pro ilimitado
        return {"allowed": True, "remaining": -1, "plan": plan}

    if not user or not user.id:
        # Anónimo sin ID: el frontend maneja el límite
        return {"allowed": True, "remaining": 15, "plan": "anonymous"}

    used_today = count_today_translations(user.id, db)
    remaining = max(0, limit - used_today)

    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "daily_limit_reached",
                "remaining": 0,
                "plan": plan,
                "message": f"Alcanzaste el límite de {limit} traducciones diarias. Actualizá a Pro para traducir sin límites."
            }
        )
    return {"allowed": True, "remaining": remaining - 1, "plan": plan}

def log_translation(user_id: str, db: Session, metadata: str = None):
    """Registra una traducción en usage_logs."""
    if not user_id:
        return
    log = UsageLog(
        user_id=user_id,
        action_type="translation",
        meta=metadata
    )
    db.add(log)
    db.commit()
