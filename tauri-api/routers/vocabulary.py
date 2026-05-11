# [ADDED v3.0] Router de vocabulario — guardar y listar palabras del usuario
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Vocabulary, Translation
from middleware.auth_middleware import require_auth, get_current_user
from db.models import User
from db.new_models import AnonymousVocabulary

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
    req: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    from middleware.auth_middleware import get_current_user
    device_seed = req.headers.get("x-device-seed")
    user = get_current_user(req, authorization) if authorization else None

    if user and user.id and not user.is_anonymous:
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

    if not device_seed:
        raise HTTPException(status_code=401, detail="Autenticación requerida o device_seed no proporcionado")

    existing = db.query(AnonymousVocabulary).filter(
        AnonymousVocabulary.device_seed == device_seed,
        AnonymousVocabulary.word == body.word,
        AnonymousVocabulary.target_lang == body.target_lang
    ).first()

    if existing:
        existing.times_seen += 1
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "word": existing.word, "already_existed": True}

    vocab = AnonymousVocabulary(
        device_seed=device_seed,
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
    offset: int = 0,
    req: Request = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    from middleware.auth_middleware import get_current_user
    device_seed = req.headers.get("x-device-seed") if req else None
    user = get_current_user(req, authorization) if authorization else None

    if user and user.id and not user.is_anonymous:
        query = db.query(Vocabulary).filter(Vocabulary.user_id == user.id)
        if level:
            query = query.filter(Vocabulary.level == level)
        words = query.order_by(Vocabulary.times_practiced.asc(), Vocabulary.created_at.desc()).offset(offset).limit(min(limit, 100)).all()
        total = db.query(Vocabulary).filter(Vocabulary.user_id == user.id).count()
    elif device_seed:
        query = db.query(AnonymousVocabulary).filter(AnonymousVocabulary.device_seed == device_seed)
        if level:
            query = query.filter(AnonymousVocabulary.level == level)
        words = query.order_by(AnonymousVocabulary.times_practiced.asc(), AnonymousVocabulary.created_at.desc()).offset(offset).limit(min(limit, 100)).all()
        total = db.query(AnonymousVocabulary).filter(AnonymousVocabulary.device_seed == device_seed).count()
    else:
        return {"words": [], "total": 0, "offset": offset, "limit": min(limit, 100)}

    return {
        "words": [
            {
                "id": w.id,
                "word": w.word,
                "definition": w.definition or "",
                "level": w.level,
                "target_lang": w.target_lang,
                "times_seen": w.times_seen,
                "times_practiced": w.times_practiced,
                "last_score": w.last_score,
                "created_at": w.created_at.isoformat() if w.created_at else None
            }
            for w in words
        ],
        "total": total,
        "offset": offset,
        "limit": min(limit, 100)
    }


@router.get("/languages")
def list_anonymous_languages(
    req: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    from middleware.auth_middleware import get_current_user
    device_seed = req.headers.get("x-device-seed")
    user = get_current_user(req, authorization) if authorization else None

    if user and user.id and not user.is_anonymous:
        from db.models import UserProgress
        progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).all()
        langs = {}
        for p in progress:
            count = db.query(Vocabulary).filter(
                Vocabulary.user_id == user.id,
                Vocabulary.target_lang == p.language
            ).count()
            if count > 0:
                langs[p.language] = {"language": p.language, "current_level": p.current_level, "total_words": count}
    elif device_seed:
        words = db.query(AnonymousVocabulary).filter(AnonymousVocabulary.device_seed == device_seed).all()
        langs = {}
        for w in words:
            if w.target_lang not in langs:
                langs[w.target_lang] = {"language": w.target_lang, "current_level": "A1", "total_words": 0}
            langs[w.target_lang]["total_words"] += 1
    else:
        return {"languages": []}

    return {"languages": list(langs.values())}
