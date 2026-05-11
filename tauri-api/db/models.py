# [ADDED v1.0] Modelos ORM para ContextIA — vocabulario, ejercicios, métricas y autenticación
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, DateTime, Date, Integer, Boolean, ForeignKey, Text, UniqueConstraint
from db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    is_anonymous = Column(Boolean, default=True)
    daily_translations = Column(Integer, default=0)
    daily_reset_date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    token = Column(String(512), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)

class Translation(Base):
    __tablename__ = "translations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    source_lang = Column(String(10), nullable=False)
    target_lang = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    translation_id = Column(String(36), ForeignKey("translations.id"), nullable=True)
    word = Column(String(255), nullable=False)
    definition = Column(Text, nullable=False)
    level = Column(String(5), nullable=False)
    target_lang = Column(String(10), nullable=False)
    times_seen = Column(Integer, default=1)
    times_practiced = Column(Integer, default=0)
    last_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    language = Column(String(10), nullable=False, default='en')
    current_level = Column(String(5), default="A1")
    current_exercise_id = Column(String(36), nullable=True)
    consecutive_wins = Column(Integer, default=0)
    consecutive_fails = Column(Integer, default=0)
    total_exercises = Column(Integer, default=0)
    total_correct = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint('user_id', 'language', name='uq_user_progress_lang'),)

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    vocabulary_id = Column(String(36), ForeignKey("vocabulary.id"), nullable=False)
    level = Column(String(5), nullable=False)
    exercise_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    expected = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    score = Column(Integer, nullable=True)
    llm_feedback = Column(Text, nullable=True)
    answer_type = Column(String(20), default="text")
    created_at = Column(DateTime, default=datetime.utcnow)
