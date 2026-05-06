# [ADDED v5.0] Router de métricas — estadísticas calculadas desde tablas existentes
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, UserProgress, Exercise, Vocabulary
from middleware.auth_middleware import require_auth

router = APIRouter()

# [ADDED v5.0] Resumen de métricas del usuario
@router.get("/summary")
def metrics_summary(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    if not progress:
        progress = UserProgress(user_id=user.id)
        db.add(progress)
        db.commit()
        db.refresh(progress)

    total_exercises = progress.total_exercises or 0
    total_correct = progress.total_correct or 0
    accuracy_rate = round((total_correct / total_exercises) * 100, 1) if total_exercises > 0 else 0.0

    # Precisión por nivel
    levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    accuracy_by_level = {}
    for lvl in levels:
        lvl_exercises = db.query(Exercise).filter(
            Exercise.user_id == user.id,
            Exercise.level == lvl,
            Exercise.status.in_(["passed", "failed"])
        ).all()
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

    words_saved = db.query(Vocabulary).filter(Vocabulary.user_id == user.id).count()
    words_practiced = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.times_practiced > 0
    ).count()

    # Palabras más difíciles (menor last_score)
    hardest = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
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

    return {
        "current_level": progress.current_level,
        "total_exercises": total_exercises,
        "accuracy_rate": accuracy_rate,
        "accuracy_by_level": accuracy_by_level,
        "streak": streak,
        "words_saved": words_saved,
        "words_practiced": words_practiced,
        "hardest_words": hardest_words,
        "recent_progress": recent_progress
    }
