# [ADDED v3.0] Router de vocabulario — guardar y listar palabras del usuario
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Vocabulary, Translation
from middleware.auth_middleware import require_auth, get_current_user
from db.models import User

router = APIRouter()

class SaveVocabularyRequest(BaseModel):
    word: str
    definition: str
    level: str
    target_lang: str
    translation_id: Optional[str] = None

class SaveVocabularyResponse(BaseModel):
    id: str
    word: str
    already_existed: bool

# [ADDED v3.0] Guardar palabra o incrementar contador si ya existe
@router.post("/save", response_model=SaveVocabularyResponse)
def save_vocabulary(
    body: SaveVocabularyRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    existing = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.word == body.word,
        Vocabulary.target_lang == body.target_lang
    ).first()

    if existing:
        existing.times_seen += 1
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "word": existing.word, "already_existed": True}

    # Obtener session_id más reciente del usuario (simplificación práctica)
    from db.models import Session as SessionModel
    latest_session = db.query(SessionModel).filter(
        SessionModel.user_id == user.id,
        SessionModel.is_active == True
    ).order_by(SessionModel.created_at.desc()).first()

    vocab = Vocabulary(
        user_id=user.id,
        session_id=latest_session.id if latest_session else "",
        translation_id=body.translation_id,
        word=body.word,
        definition=body.definition,
        level=body.level,
        target_lang=body.target_lang
    )
    db.add(vocab)
    db.commit()
    db.refresh(vocab)
    return {"id": vocab.id, "word": vocab.word, "already_existed": False}

# [ADDED v3.0] Listar vocabulario del usuario (menos practicadas primero)
@router.get("/list")
def list_vocabulary(
    limit: int = 20,
    level: Optional[str] = None,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    query = db.query(Vocabulary).filter(Vocabulary.user_id == user.id)
    if level:
        query = query.filter(Vocabulary.level == level)
    # Ordenar por menos practicadas primero (para priorizar en ejercicios)
    words = query.order_by(Vocabulary.times_practiced.asc(), Vocabulary.created_at.desc()).limit(limit).all()
    return [
        {
            "id": w.id,
            "word": w.word,
            "definition": w.definition,
            "level": w.level,
            "target_lang": w.target_lang,
            "times_seen": w.times_seen,
            "times_practiced": w.times_practiced,
            "last_score": w.last_score,
            "created_at": w.created_at.isoformat() if w.created_at else None
        }
        for w in words
    ]
