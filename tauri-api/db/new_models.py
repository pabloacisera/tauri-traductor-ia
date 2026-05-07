# [ADDED MVP-v1] Nuevos modelos ORM para MVP: suscripciones, historial y uso
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, JSON
from db.database import Base

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    plan_type = Column(String(20), nullable=False, default="free")  # "free" | "pro_monthly" | "pro_annual"
    status = Column(String(20), nullable=False, default="active")   # "active" | "cancelled" | "expired"
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UsageLog(Base):
    __tablename__ = "usage_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action_type = Column(String(50), nullable=False)  # "translation" | "analysis" | "exercise"
    created_at = Column(DateTime, default=datetime.utcnow)
    meta = Column(Text, nullable=True)  # JSON string con detalles extra

class TranslationHistory(Base):
    __tablename__ = "translation_history"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    audio_base64 = Column(Text, nullable=True)
    analysis = Column(Text, nullable=True)  # JSON string del análisis lingüístico
    created_at = Column(DateTime, default=datetime.utcnow)
