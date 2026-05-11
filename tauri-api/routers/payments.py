# [ADDED] Router de pagos - usa el adapter para procesar
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from db.new_models import Subscription, Contract
from middleware.auth_middleware import require_auth
from payments.fake_adapter import FakePaymentAdapter

router = APIRouter()
gateway = FakePaymentAdapter()


class PaymentRequest(BaseModel):
    card_number: str
    expiry_mm: str
    expiry_yy: str
    cvv: str
    plan_type: str


@router.post("/process")
def process_payment(
    body: PaymentRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    result = gateway.process(
        body.card_number, body.expiry_mm, body.expiry_yy,
        body.cvv, body.plan_type, user.id
    )

    if not result.success:
        return {
            "success": False,
            "error": result.error_code,
            "message": result.message
        }

    now = datetime.utcnow()
    days = 365 if body.plan_type == "annual" else 30
    period_end = now + timedelta(days=days)

    existing_contract = db.query(Contract).filter(Contract.user_id == user.id).first()
    if existing_contract:
        existing_contract.plan_type = body.plan_type
        existing_contract.price = "$9.99" if body.plan_type == "monthly" else "$79.99"
        existing_contract.card_brand = result.card_brand
        existing_contract.card_last4 = result.card_last4
        existing_contract.activated_at = now
        existing_contract.updated_at = now
    else:
        contract = Contract(
            user_id=user.id,
            plan_type=body.plan_type,
            price="$9.99" if body.plan_type == "monthly" else "$79.99",
            card_brand=result.card_brand,
            card_last4=result.card_last4,
            activated_at=now
        )
        db.add(contract)

    existing_sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    if existing_sub:
        existing_sub.plan_type = body.plan_type
        existing_sub.status = "active"
        existing_sub.current_period_start = now
        existing_sub.current_period_end = period_end
        existing_sub.updated_at = now
    else:
        sub = Subscription(
            user_id=user.id,
            plan_type=body.plan_type,
            status="active",
            current_period_start=now,
            current_period_end=period_end
        )
        db.add(sub)

    db.commit()
    return {
        "success": True,
        "plan": body.plan_type,
        "price": "$9.99" if body.plan_type == "monthly" else "$79.99",
        "card_brand": result.card_brand,
        "card_last4": result.card_last4,
        "expires": period_end.isoformat()
    }
