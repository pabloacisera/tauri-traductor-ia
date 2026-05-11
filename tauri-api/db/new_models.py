# [ADDED MVP-v1] Nuevos modelos ORM para MVP: suscripciones, historial y uso
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, JSON
from db.database import Base


class PlanLimit(Base):
    __tablename__ = "plan_limits"
    plan_type = Column(String(20), primary_key=True)
    translations_limit = Column(Integer, nullable=False)
    exercises_limit = Column(Integer, nullable=False)
    reset_period = Column(String(10), nullable=False)


class AnonymousUsage(Base):
    __tablename__ = "anonymous_usage"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_seed = Column(String(16), nullable=False, unique=True)
    translations_used = Column(Integer, default=0)
    exercises_used = Column(Integer, default=0)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AnonymousUserProgress(Base):
    __tablename__ = "anonymous_user_progress"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_seed = Column(String(16), nullable=False, index=True)
    language = Column(String(10), nullable=False)
    current_level = Column(String(10), nullable=False, default="A1")
    consecutive_wins = Column(Integer, default=0)
    consecutive_fails = Column(Integer, default=0)
    total_exercises = Column(Integer, default=0)
    total_correct = Column(Integer, default=0)
    current_exercise_id = Column(String(36), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    plan_type = Column(String(20), nullable=False)
    price = Column(String(10), nullable=False)
    card_brand = Column(String(20), nullable=True)
    card_last4 = Column(String(4), nullable=True)
    activated_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnonymousVocabulary(Base):
    __tablename__ = "anonymous_vocabulary"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_seed = Column(String(16), nullable=False, index=True)
    word = Column(String(255), nullable=False)
    definition = Column(Text, nullable=True)
    level = Column(String(10), nullable=True)
    target_lang = Column(String(10), nullable=False)
    times_seen = Column(Integer, default=1)
    times_practiced = Column(Integer, default=0)
    last_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AnonymousExercise(Base):
    __tablename__ = "anonymous_exercise"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_seed = Column(String(16), nullable=False, index=True)
    vocabulary_id = Column(String(36), nullable=True)
    language = Column(String(10), nullable=False)
    level = Column(String(10), nullable=True)
    exercise_type = Column(String(50), nullable=True)
    content = Column(Text, nullable=False)
    expected = Column(Text, nullable=True)
    hint = Column(Text, nullable=True)
    user_answer = Column(Text, nullable=True)
    score = Column(Integer, nullable=True)
    llm_feedback = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    answer_type = Column(String(20), default="text")
    created_at = Column(DateTime, default=datetime.utcnow)


class AnonymousTranslationHistory(Base):
    __tablename__ = "anonymous_translation_history"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_seed = Column(String(16), nullable=False, index=True)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    audio_base64 = Column(Text, nullable=True)
    analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
