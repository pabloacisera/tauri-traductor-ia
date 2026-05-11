# [ADDED MVP-v1] Middleware de control de límites por plan
from datetime import datetime, date, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from db.models import User
from db.new_models import Subscription, UsageLog, PlanLimit, AnonymousUsage

LIMITS = {
    "free": 15,
    "monthly": 150,
    "annual": 300,
    "pro_monthly": -1,
    "pro_annual": -1,
    "anonymous": 5
}


def get_user_plan(user: User, db: Session) -> str:
    """Retorna el plan activo del usuario."""
    if not user or user.is_anonymous:
        return "anonymous"
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    if not sub:
        return "free"
    if sub.current_period_end and sub.current_period_end < datetime.utcnow():
        sub.status = "expired"
        db.commit()
        return "free"
    return sub.plan_type


def get_plan_limits(plan_type: str, db: Session) -> dict:
    """Retorna límites del plan desde DB."""
    pl = db.query(PlanLimit).filter_by(plan_type=plan_type).first()
    if not pl:
        return {"translations_limit": 15, "exercises_limit": 15, "reset_period": "daily"}
    return {
        "translations_limit": pl.translations_limit,
        "exercises_limit": pl.exercises_limit,
        "reset_period": pl.reset_period
    }


def get_period_start(reset_period: str) -> datetime:
    """Retorna el inicio del período vigente."""
    now = datetime.utcnow()
    if reset_period == "daily":
        return datetime.combine(date.today(), datetime.min.time())
    return datetime(year=now.year, month=now.month, day=1)


def count_usage_in_period(user_id: str, action_type: str, reset_period: str, db: Session) -> int:
    """Cuenta uso en el período vigente (diario o mensual)."""
    if not user_id:
        return 0
    period_start = get_period_start(reset_period)
    return db.query(UsageLog).filter(
        UsageLog.user_id == user_id,
        UsageLog.action_type == action_type,
        UsageLog.created_at >= period_start
    ).count()


def count_today_translations(user_id: str, db: Session) -> int:
    """Cuenta traducciones de hoy para un usuario."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    return db.query(UsageLog).filter(
        UsageLog.user_id == user_id,
        UsageLog.action_type == "translation",
        UsageLog.created_at >= today_start
    ).count()


def count_today_exercises(user_id: str, db: Session) -> int:
    """Cuenta ejercicios de hoy para un usuario."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    return db.query(UsageLog).filter(
        UsageLog.user_id == user_id,
        UsageLog.action_type == "exercise",
        UsageLog.created_at >= today_start
    ).count()


def check_limit(user_id: str, action_type: str, plan_type: str, db: Session) -> dict:
    """Verifica límite genérico para cualquier acción."""
    limits = get_plan_limits(plan_type, db)
    key = f"{action_type}s_limit"
    limit = limits.get(key, 15)
    reset = limits.get("reset_period", "daily")

    if limit == -1:
        return {"allowed": True, "remaining": -1, "plan": plan_type, "type": action_type}

    used = count_usage_in_period(user_id, action_type, reset, db)
    remaining = max(0, limit - used)

    if remaining <= 0:
        period_label = 'diarios' if reset == 'daily' else 'mensuales'
        raise HTTPException(status_code=429, detail={
            "error": "limit_reached",
            "remaining": 0,
            "plan": plan_type,
            "type": action_type,
            "message": f"Alcanzaste el límite de {limit} {action_type} {period_label}. Renová tu plan."
        })
    return {"allowed": True, "remaining": remaining - 1, "plan": plan_type, "type": action_type}


def count_anonymous_usage(device_seed: str, db: Session) -> int:
    """Cuenta traducciones de un dispositivo anónimo."""
    if not device_seed:
        return 0
    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    return anon.translations_used if anon else 0


def check_anonymous_limit(device_seed: str, db: Session, action: str = "translation") -> dict:
    """Verifica límite para anonymous. Traducciones y ejercicios tienen contadores separados pero comparten techo de 5."""
    limit = LIMITS.get("anonymous", 5)

    if not device_seed:
        return {"allowed": True, "remaining": limit, "plan": "anonymous", "type": action}

    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    if action == "translation":
        used = anon.translations_used if anon else 0
    else:
        used = anon.exercises_used if anon else 0

    if used >= limit:
        action_name = "traducciones" if action == "translation" else "ejercicios"
        raise HTTPException(status_code=429, detail={
            "error": "anonymous_limit_reached",
            "remaining": 0,
            "plan": "anonymous",
            "type": action,
            "message": f"Usaste tus {limit} {action_name} gratuitos. Registrate para acceder a {limit * 3} traducciones/día."
        })
    return {"allowed": True, "remaining": limit - used, "plan": "anonymous", "type": action}


def check_anonymous_exercise_limit(device_seed: str, db: Session) -> dict:
    """Verifica límite de ejercicios para anonymous."""
    limit = LIMITS.get("anonymous", 5)

    if not device_seed:
        return {"allowed": True, "remaining": limit, "plan": "anonymous", "type": "exercise"}

    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    exercises_used = anon.exercises_used if anon else 0

    if exercises_used >= limit:
        raise HTTPException(status_code=429, detail={
            "error": "anonymous_exercise_limit_reached",
            "remaining": 0,
            "plan": "anonymous",
            "type": "exercise",
            "message": f"Usaste tus {limit} ejercicios gratuitos. Registrate para acceder a ejercicios ilimitados."
        })
    return {"allowed": True, "remaining": limit - exercises_used, "plan": "anonymous", "type": "exercise"}


def record_anonymous_translation(device_seed: str, db: Session):
    """Registra una traducción de un dispositivo anónimo."""
    if not device_seed:
        return
    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    if anon:
        anon.translations_used += 1
    else:
        anon = AnonymousUsage(device_seed=device_seed, translations_used=1)
        db.add(anon)
    db.commit()

    try:
        from routers.sse import notify_usage_change
        notify_usage_change(device_seed, anon.translations_used, anon.exercises_used)
    except Exception:
        pass


def record_anonymous_exercise(device_seed: str, db: Session):
    """Registra un ejercicio de un dispositivo anónimo."""
    if not device_seed:
        return
    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    if anon:
        anon.exercises_used += 1
    else:
        anon = AnonymousUsage(device_seed=device_seed, translations_used=0, exercises_used=1)
        db.add(anon)
    db.commit()

    try:
        from routers.sse import notify_usage_change
        notify_usage_change(device_seed, anon.translations_used, anon.exercises_used)
    except Exception:
        pass


def link_anonymous_to_user(device_seed: str, user_id: str, db: Session):
    """Vincula un dispositivo anónimo a un usuario registrado."""
    if not device_seed or not user_id:
        return
    anon = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    if anon:
        anon.user_id = user_id
        db.commit()


def check_translation_limit(user: User, db: Session, device_seed: str = None, action: str = "translation") -> dict:
    """
    Verifica si el usuario puede traducir.
    Prioriza device_seed para usuarios anónimos.
    """
    plan = get_user_plan(user, db)

    if plan == "anonymous":
        return check_anonymous_limit(device_seed, db, action=action)

    user_id = user.id if user and user.id else None
    return check_limit(user_id, action, plan, db)


def log_translation(user_id: str, db: Session, metadata: str = None):
    """Registra una traducción en usage_logs."""
    if not user_id:
        return
    log = UsageLog(
        user_id=user_id,
        action_type="translation",
        meta=metadata
    )
    db.add(log)
    db.commit()
    print(f"[Usage] Translation logged for user {user_id}")


def count_today_exercises(user_id: str, language: str, db: Session) -> int:
    """Cuenta ejercicios completados hoy para un usuario en un idioma."""
    from datetime import date
    import json as _json
    today_start = datetime.combine(date.today(), datetime.min.time())
    logs = db.query(UsageLog).filter(
        UsageLog.user_id == user_id,
        UsageLog.action_type == "exercise",
        UsageLog.created_at >= today_start
    ).all()
    count = 0
    for log in logs:
        try:
            meta = _json.loads(log.meta) if log.meta else {}
            if meta.get("language") == language:
                count += 1
        except Exception:
            pass
    return count

def log_exercise(user_id: str, language: str, db: Session):
    """Registra un ejercicio completado en usage_logs."""
    import json as _json
    if not user_id:
        return
    log = UsageLog(
        user_id=user_id,
        action_type="exercise",
        meta=_json.dumps({"language": language})
    )
    db.add(log)
    db.commit()


def migrate_anonymous_data(device_seed: str, user_id: str, db: Session):
    """Migra todos los datos de anonymous al usuario registrado."""
    if not device_seed or not user_id:
        return

    from db.new_models import (
        AnonymousVocabulary, AnonymousExercise, AnonymousTranslationHistory,
        AnonymousUserProgress
    )
    from db.models import Vocabulary, Exercise, TranslationHistory, UserProgress
    from db.models import Session as SessionModel

    latest_session = db.query(SessionModel).filter(
        SessionModel.user_id == user_id,
        SessionModel.is_active == True
    ).order_by(SessionModel.created_at.desc()).first()
    session_id = latest_session.id if latest_session else ""

    vocab_count = 0
    for av in db.query(AnonymousVocabulary).filter_by(device_seed=device_seed).all():
        existing = db.query(Vocabulary).filter(
            Vocabulary.user_id == user_id,
            Vocabulary.word == av.word,
            Vocabulary.target_lang == av.target_lang
        ).first()
        if existing:
            existing.times_seen += av.times_seen
            existing.times_practiced = max(existing.times_practiced, av.times_practiced)
            if av.last_score:
                existing.last_score = max(existing.last_score or 0, av.last_score)
        else:
            v = Vocabulary(
                user_id=user_id,
                session_id=session_id,
                word=av.word,
                definition=av.definition or "",
                level=av.level,
                target_lang=av.target_lang,
                times_seen=av.times_seen,
                times_practiced=av.times_practiced,
                last_score=av.last_score,
                created_at=av.created_at
            )
            db.add(v)
        vocab_count += 1

    for ae in db.query(AnonymousExercise).filter_by(device_seed=device_seed).all():
        e = Exercise(
            user_id=user_id,
            vocabulary_id=None,
            level=ae.level or "A1",
            exercise_type=ae.exercise_type or "fill_in_the_blank",
            content=ae.content,
            expected=ae.expected or "",
            status=ae.status,
            score=ae.score,
            llm_feedback=ae.llm_feedback,
            answer_type=ae.answer_type,
            created_at=ae.created_at
        )
        db.add(e)

    for ah in db.query(AnonymousTranslationHistory).filter_by(device_seed=device_seed).all():
        t = TranslationHistory(
            user_id=user_id,
            original_text=ah.original_text,
            translated_text=ah.translated_text,
            source_language=ah.source_language,
            target_language=ah.target_language,
            audio_base64=ah.audio_base64,
            analysis=ah.analysis,
            created_at=ah.created_at
        )
        db.add(t)

    for ap in db.query(AnonymousUserProgress).filter_by(device_seed=device_seed).all():
        existing_p = db.query(UserProgress).filter(
            UserProgress.user_id == user_id,
            UserProgress.language == ap.language
        ).first()
        if existing_p:
            existing_p.current_level = ap.current_level
            existing_p.consecutive_wins = ap.consecutive_wins
            existing_p.consecutive_fails = ap.consecutive_fails
            existing_p.total_exercises = ap.total_exercises
            existing_p.total_correct = ap.total_correct
            existing_p.current_exercise_id = ap.current_exercise_id
            existing_p.updated_at = ap.updated_at
        else:
            p = UserProgress(
                user_id=user_id,
                language=ap.language,
                current_level=ap.current_level,
                consecutive_wins=ap.consecutive_wins,
                consecutive_fails=ap.consecutive_fails,
                total_exercises=ap.total_exercises,
                total_correct=ap.total_correct,
                current_exercise_id=ap.current_exercise_id,
                created_at=ap.created_at
            )
            db.add(p)

    db.commit()
    print(f"[Migration] Migrated {vocab_count} vocab, exercises, history, progress for device_seed {device_seed} -> user {user_id}")


def get_request_priority(plan_type: str) -> int:
    """
    Retorna la prioridad de procesamiento para cada tipo de plan.
    Menor número = mayor prioridad.
    # TODO: conectar a un middleware de cola de prioridad (asyncio.PriorityQueue o similar)
    """
    priorities = {
        "annual": 1,
        "monthly": 2,
        "free": 3,
        "anonymous": 4
    }
    return priorities.get(plan_type, 4)
