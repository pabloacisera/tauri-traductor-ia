# [ADDED v5.0] Router de métricas — estadísticas calculadas desde tablas existentes
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, Request, Header
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session
from typing import Optional
from db.database import get_db
from db.models import User, UserProgress, Exercise, Vocabulary
from middleware.auth_middleware import get_current_user
from middleware.usage import get_user_plan, get_request_priority

router = APIRouter()

# [ADDED v5.0] Resumen de métricas del usuario
@router.get("/summary")
def metrics_summary(
    language: Optional[str] = None,
    req: Request = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    device_seed = req.headers.get("x-device-seed") if req else None
    user = get_current_user(req, authorization) if authorization else None

    if not user or not user.id or user.is_anonymous:
        if not device_seed:
            return {
                "language": language or "en",
                "current_level": "A1",
                "total_exercises": 0,
                "accuracy_rate": 0.0,
                "accuracy_by_level": {},
                "streak": 0,
                "words_saved": 0,
                "words_practiced": 0,
                "hardest_words": [],
                "recent_progress": []
            }
        from db.new_models import AnonymousVocabulary, AnonymousExercise, AnonymousUserProgress
        from routers.exercises import get_levels

        words = db.query(AnonymousVocabulary).filter(AnonymousVocabulary.device_seed == device_seed).all()
        exercises = db.query(AnonymousExercise).filter(
            AnonymousExercise.device_seed == device_seed,
            AnonymousExercise.status.in_(["passed", "failed"])
        ).all()

        # Obtener nivel actual del progreso
        progress = db.query(AnonymousUserProgress).filter(
            AnonymousUserProgress.device_seed == device_seed,
            AnonymousUserProgress.language == (language or "en")
        ).first()

        total_exercises = len(exercises)
        total_correct = sum(1 for e in exercises if e.status == "passed")
        accuracy_rate = round((total_correct / total_exercises) * 100, 1) if total_exercises > 0 else 0.0

        # Contar TODAS las palabras guardadas (no solo del idioma seleccionado)
        words_saved = len(words)
        words_practiced = len([w for w in words if w.times_practiced > 0])

        hardest = [w for w in words if w.last_score is not None]
        hardest.sort(key=lambda x: x.last_score or 0)
        hardest_words = [{"word": w.word, "level": w.level, "last_score": w.last_score, "times_practiced": w.times_practiced} for w in hardest[:5]]

        # Calcular racha
        streak = 0
        today = date.today()
        for i in range(365):
            check_date = today - timedelta(days=i)
            count = db.query(AnonymousExercise).filter(
                AnonymousExercise.device_seed == device_seed,
                func.date(AnonymousExercise.created_at) == check_date,
                AnonymousExercise.status.in_(["passed", "failed"])
            ).count()
            if count > 0:
                streak += 1
            else:
                if i > 0:
                    break
                else:
                    streak = 0
                    break

        # Calcular precisión por nivel
        levels = get_levels(language or "en")
        accuracy_by_level = {}
        for lvl in levels:
            lvl_exercises = [e for e in exercises if e.level == lvl]
            if lvl_exercises:
                correct = sum(1 for e in lvl_exercises if e.status == "passed")
                accuracy_by_level[lvl] = round((correct / len(lvl_exercises)) * 100, 0)
            else:
                accuracy_by_level[lvl] = 0

        # Progreso reciente (últimos 14 días)
        recent_progress = []
        for i in range(13, -1, -1):
            d = today - timedelta(days=i)
            day_exercises = [e for e in exercises if e.created_at and e.created_at.date() == d]
            recent_progress.append({
                "date": d.isoformat(),
                "exercises": len(day_exercises),
                "correct": sum(1 for e in day_exercises if e.status == "passed")
            })

        return {
            "language": language or "en",
            "current_level": progress.current_level if progress else "A1",
            "total_exercises": total_exercises,
            "accuracy_rate": accuracy_rate,
            "accuracy_by_level": accuracy_by_level,
            "streak": streak,
            "words_saved": words_saved,
            "words_practiced": words_practiced,
            "hardest_words": hardest_words,
            "recent_progress": recent_progress
        }

    query = db.query(UserProgress).filter(UserProgress.user_id == user.id)
    if language:
        query = query.filter(UserProgress.language == language)
    progress = query.first()
    
    if not progress:
        from routers.exercises import get_first_level
        lang = language or 'en'
        progress = UserProgress(user_id=user.id, language=lang, current_level=get_first_level(lang))
        db.add(progress)
        db.commit()
        db.refresh(progress)

    total_exercises = progress.total_exercises or 0
    total_correct = progress.total_correct or 0
    accuracy_rate = round((total_correct / total_exercises) * 100, 1) if total_exercises > 0 else 0.0

    # Precisión por nivel (dinámico según idioma)
    from routers.exercises import get_levels
    levels = get_levels(progress.language)
    accuracy_by_level = {}
    for lvl in levels:
        lvl_exercises = db.query(Exercise).filter(
            Exercise.user_id == user.id,
            Exercise.level == lvl,
            Exercise.status.in_(["passed", "failed"])
        ).all()
        # Filtro adicional si el ejercicio tiene idioma (por ahora asumimos nivel es suficiente filtro)
        if lvl_exercises:
            correct = sum(1 for e in lvl_exercises if e.status == "passed")
            accuracy_by_level[lvl] = round((correct / len(lvl_exercises)) * 100, 0)
        else:
            accuracy_by_level[lvl] = 0

    # Racha de días consecutivos con al menos 1 ejercicio
    streak = 0
    today = date.today()
    for i in range(365):
        check_date = today - timedelta(days=i)
        count = db.query(Exercise).filter(
            Exercise.user_id == user.id,
            func.date(Exercise.created_at) == check_date
        ).count()
        if count > 0:
            streak += 1
        else:
            if i > 0:  # hoy puede no tener ejercicio aún
                break
            else:
                streak = 0
                break

    words_saved = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.target_lang == progress.language
    ).count()
    words_practiced = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.target_lang == progress.language,
        Vocabulary.times_practiced > 0
    ).count()

    # Palabras más difíciles (menor last_score) del idioma actual
    hardest = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.target_lang == progress.language,
        Vocabulary.last_score.isnot(None)
    ).order_by(Vocabulary.last_score.asc()).limit(5).all()

    hardest_words = [
        {
            "word": w.word,
            "level": w.level,
            "last_score": w.last_score,
            "times_practiced": w.times_practiced
        }
        for w in hardest
    ]

    # Progreso reciente (últimos 14 días)
    recent_progress = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        day_exercises = db.query(Exercise).filter(
            Exercise.user_id == user.id,
            func.date(Exercise.created_at) == d
        ).all()
        recent_progress.append({
            "date": d.isoformat(),
            "exercises": len(day_exercises),
            "correct": sum(1 for e in day_exercises if e.status == "passed")
        })

    plan = get_user_plan(user, db)
    priority_access = plan == "annual"

    return {
        "language": progress.language,
        "current_level": progress.current_level,
        "total_exercises": total_exercises,
        "accuracy_rate": accuracy_rate,
        "accuracy_by_level": accuracy_by_level,
        "streak": streak,
        "words_saved": words_saved,
        "words_practiced": words_practiced,
        "hardest_words": hardest_words,
        "recent_progress": recent_progress,
        "priority_access": priority_access
    }

@router.get("/languages")
def get_enabled_languages(
    req: Request = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Devuelve los idiomas donde el usuario tiene al menos 1 palabra guardada"""
    device_seed = req.headers.get("x-device-seed") if req else None
    user = get_current_user(req, authorization) if authorization else None

    if not user or not user.id or user.is_anonymous:
        if not device_seed:
            return {"languages": []}
        from db.new_models import AnonymousVocabulary
        langs = db.query(distinct(AnonymousVocabulary.target_lang)).filter(
            AnonymousVocabulary.device_seed == device_seed
        ).all()
        result = []
        for lang in langs:
            count = db.query(AnonymousVocabulary).filter(
                AnonymousVocabulary.device_seed == device_seed,
                AnonymousVocabulary.target_lang == lang[0]
            ).count()
            result.append({"language": lang[0], "current_level": None, "total_words": count})
        return {"languages": result}

    langs = db.query(distinct(Vocabulary.target_lang)).filter(
        Vocabulary.user_id == user.id
    ).all()
    enabled = [l[0] for l in langs if l[0]]
    
    # Para cada idioma, obtener el nivel actual del UserProgress si existe
    result = []
    for lang in enabled:
        progress = db.query(UserProgress).filter(
            UserProgress.user_id == user.id,
            UserProgress.language == lang
        ).first()
        result.append({
            "language": lang,
            "current_level": progress.current_level if progress else None,
            "total_words": db.query(Vocabulary).filter(
                Vocabulary.user_id == user.id,
                Vocabulary.target_lang == lang
            ).count()
        })
    return {"languages": result}
