# [ADDED MVP-v1] Router de suscripciones — estado actual y gestión básica
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from db.new_models import Subscription, UsageLog, PlanLimit, AnonymousUsage
from middleware.auth_middleware import require_auth
from middleware.usage import get_user_plan, count_usage_in_period, get_plan_limits

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

    limits = get_plan_limits(plan, db)
    reset = limits.get("reset_period", "daily")
    limit = limits.get("translations_limit", 15)
    used = count_usage_in_period(user.id, "translation", reset, db)
    remaining = -1 if limit == -1 else max(0, limit - used)

    return {
        "plan": plan,
        "status": sub.status if sub else "free",
        "period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        "translations_today": used,
        "translations_limit": limit,
        "translations_remaining": remaining
    }

# [MVP-v1] Endpoint para que el agente/admin active un plan manualmente (para testing sin Stripe)
class ActivatePlanRequest(BaseModel):
    plan_type: str  # "monthly" | "annual" | "pro_monthly" | "pro_annual"
    days: int = 30

@router.post("/activate-test")
def activate_test_plan(
    body: ActivatePlanRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Solo para testing. En producción esto lo maneja Stripe webhook."""
    existing = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Ya tenés una suscripción activa ({existing.plan_type}). Cancelá primero si querés cambiar de plan."
        )
    now = datetime.utcnow()
    end = now + timedelta(days=body.days)

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


class AnonymousUsageStatus(BaseModel):
    translations_remaining: int
    exercises_remaining: int


@router.get("/anonymous-status", response_model=AnonymousUsageStatus)
def get_anonymous_usage_status(
    req: Request = None,
    db: Session = Depends(get_db)
):
    from middleware.usage import LIMITS
    device_seed = req.headers.get("x-device-seed") if req else None
    limit = LIMITS.get("anonymous", 5)

    if not device_seed:
        return {
            "translations_remaining": limit,
            "exercises_remaining": limit
        }

    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    translations_used = anon.translations_used if anon else 0
    exercises_used = anon.exercises_used if anon else 0

    return {
        "translations_remaining": max(0, limit - translations_used),
        "exercises_remaining": max(0, limit - exercises_used)
    }
