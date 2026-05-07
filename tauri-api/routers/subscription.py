# [ADDED MVP-v1] Router de suscripciones — estado actual y gestión básica
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from db.new_models import Subscription, UsageLog
from middleware.auth_middleware import require_auth
from middleware.usage import get_user_plan, count_today_translations, LIMITS

router = APIRouter()

class SubscriptionStatus(BaseModel):
    plan: str
    status: str
    period_end: str | None
    translations_today: int
    translations_limit: int
    translations_remaining: int

@router.get("/status", response_model=SubscriptionStatus)
def get_subscription_status(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    plan = get_user_plan(user, db)
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()

    limit = LIMITS.get(plan, 15)
    used_today = count_today_translations(user.id, db)
    remaining = -1 if limit == -1 else max(0, limit - used_today)

    return {
        "plan": plan,
        "status": sub.status if sub else "free",
        "period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        "translations_today": used_today,
        "translations_limit": limit,
        "translations_remaining": remaining
    }

# [MVP-v1] Endpoint para que el agente/admin active un plan manualmente (para testing sin Stripe)
class ActivatePlanRequest(BaseModel):
    plan_type: str  # "pro_monthly" | "pro_annual"
    days: int = 30

@router.post("/activate-test")
def activate_test_plan(
    body: ActivatePlanRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Solo para testing. En producción esto lo maneja Stripe webhook."""
    existing = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    now = datetime.utcnow()
    end = now + timedelta(days=body.days)

    if existing:
        existing.plan_type = body.plan_type
        existing.status = "active"
        existing.current_period_start = now
        existing.current_period_end = end
        existing.updated_at = now
    else:
        sub = Subscription(
            user_id=user.id,
            plan_type=body.plan_type,
            status="active",
            current_period_start=now,
            current_period_end=end
        )
        db.add(sub)
    db.commit()
    return {"success": True, "plan": body.plan_type, "expires": end.isoformat()}

# [MVP-v1] Endpoint para cancelar suscripción
@router.post("/cancel")
def cancel_subscription(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="No hay suscripción activa")
    sub.status = "cancelled"
    sub.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True}
