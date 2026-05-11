# [ADDED v4.0] Router de ejercicios — generación con LLM, evaluación y progresión de nivel
import os
import json
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, Vocabulary, UserProgress, Exercise
from middleware.auth_middleware import require_auth, get_current_user
from middleware.usage import get_user_plan, check_limit, count_today_exercises, log_exercise
from db.new_models import AnonymousVocabulary, AnonymousExercise, AnonymousUserProgress, AnonymousUsage
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

LEVELS_BY_LANG = {
    'en': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'es': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'pt': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'it': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'ru': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'zh': ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'],
    'ja': ['N5', 'N4', 'N3', 'N2', 'N1'],
}
LEVELS_DEFAULT = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

LANG_NAMES = {
    'en': 'English', 'es': 'español', 'pt': 'português',
    'it': 'italiano', 'ru': 'русский', 'zh': '中文', 'ja': '日本語'
}

def get_levels(language: str) -> list:
    return LEVELS_BY_LANG.get(language, LEVELS_DEFAULT)

def get_first_level(language: str) -> str:
    return get_levels(language)[0]

WINS_TO_ADVANCE = 3
FAILS_TO_RETREAT = 2
PASS_SCORE_BY_LEVEL = {
    'A1': 65, 'A2': 70, 'B1': 75, 'B2': 78, 'C1': 82, 'C2': 85,
    'HSK1': 65, 'HSK2': 68, 'HSK3': 72, 'HSK4': 76, 'HSK5': 80, 'HSK6': 85,
    'N5': 65, 'N4': 70, 'N3': 75, 'N2': 80, 'N1': 85,
}
PASS_SCORE_DEFAULT = 75

class ExerciseRequest(BaseModel):
    language: str = 'en'

class ExerciseRequestResponse(BaseModel):
    blocked: bool
    exercise: Optional[dict] = None

class SubmitRequest(BaseModel):
    exercise_id: str
    answer: str
    answer_type: str = "text"
    language: str = 'en'

class SubmitResponse(BaseModel):
    score: int
    feedback: str
    level_changed: bool
    new_level: Optional[str] = None
    status: str

# [ADDED v4.0] Prompt para generar ejercicio
def build_exercise_prompt(user_progress: UserProgress, words: list, language: str = 'en', recent_exercises: list = None) -> str:
    lang_name = LANG_NAMES.get(language, language)

    sorted_words = sorted(words, key=lambda w: w.last_score or 0)
    low_score = [w for w in sorted_words if (w.last_score or 0) < 70]

    context_map = {
        "A1": "situación cotidiana simple (daily life scenario)",
        "A2": "situación cotidiana con más detalle",
        "B1": "contexto social o laboral informal",
        "B2": "situación profesional o académica",
        "C1": "contexto abstracto o técnico",
        "C2": "contexto sofisticado que requiere manejo fluido",
        "HSK1": "situación cotidiana simple en mandarín",
        "HSK2": "situación cotidiana con más detalle en mandarín",
        "HSK3": "contexto social informal en mandarín",
        "HSK4": "contexto profesional o académico en mandarín",
        "HSK5": "contexto abstracto o técnico en mandarín",
        "HSK6": "contexto sofisticado en mandarín",
        "N5": "situación cotidiana simple en japonés",
        "N4": "situación cotidiana con más detalle en japonés",
        "N3": "contexto social informal en japonés",
        "N2": "contexto profesional o académico en japonés",
        "N1": "contexto abstracto o técnico en japonés",
    }
    
    length_constraint_map = {
        "A1": "el campo content debe tener como máximo 1 oración simple y corta. Vocabulario básico. Sin subordinadas.",
        "A2": "el campo content debe tener como máximo 2 oraciones simples. Sin párrafos. Sin descripciones extensas.",
        "B1": "el campo content puede tener hasta 3 oraciones o un diálogo corto de 2 intercambios. Sin párrafos largos.",
        "B2": "el campo content puede tener un párrafo corto de hasta 4 oraciones.",
        "C1": "el campo content puede tener un párrafo de hasta 6 oraciones con vocabulario avanzado.",
        "C2": "sin restricción de longitud, máxima complejidad.",
        "HSK1": "el campo content debe tener como máximo 1 oración simple y corta. Vocabulario básico. Sin subordinadas.",
        "HSK2": "el campo content debe tener como máximo 2 oraciones simples. Sin párrafos. Sin descripciones extensas.",
        "HSK3": "el campo content puede tener hasta 3 oraciones o un diálogo corto de 2 intercambios. Sin párrafos largos.",
        "HSK4": "el campo content puede tener un párrafo corto de hasta 4 oraciones.",
        "HSK5": "el campo content puede tener un párrafo de hasta 6 oraciones con vocabulario avanzado.",
        "HSK6": "sin restricción de longitud, máxima complejidad.",
        "N5": "el campo content debe tener como máximo 1 oración simple y corta. Vocabulario básico. Sin subordinadas.",
        "N4": "el campo content debe tener como máximo 2 oraciones simples. Sin párrafos. Sin descripciones extensas.",
        "N3": "el campo content puede tener hasta 3 oraciones o un diálogo corto de 2 intercambios. Sin párrafos largos.",
        "N2": "el campo content puede tener un párrafo corto de hasta 4 oraciones.",
        "N1": "el campo content puede tener un párrafo de hasta 6 oraciones con vocabulario avanzado.",
    }
    
    context_hint = context_map.get(user_progress.current_level, f"contexto apropiado para nivel {user_progress.current_level}")
    length_hint = length_constraint_map.get(user_progress.current_level, "sin restricción específica de longitud.")

    preparatory = ""
    if user_progress.consecutive_fails >= 1:
        preparatory = f"\nImportante: el usuario ha fallado recientemente en {lang_name}. Generá un ejercicio preparatorio más sencillo que refuerce el concepto base."

    words_for_llm = json.dumps([
        {"word": w.word, "times_practiced": w.times_practiced, "last_score": w.last_score}
        for w in sorted_words
    ], ensure_ascii=False)

    recent_exclusion = ""
    if recent_exercises:
        recent_exclusion = "\nPROHIBIDO repetir o parafrasear cualquiera de estos escenarios ya usados anteriormente:\n"
        recent_exclusion += "\n".join([f"- {content}" for content in recent_exercises])

    return f"""
Eres un profesor de idiomas. Generá UN ejercicio de APPLICATION SITUATIONAL en {lang_name}.

IDIOMA DEL EJERCICIO: {lang_name} (es el idioma que elegiste para practicar y fue traducido desde tu idioma original)
NIVEL: {user_progress.current_level}
ESCENARIO: {context_hint}
victorias consecutivas: {user_progress.consecutive_wins}
fallos consecutivos: {user_progress.consecutive_fails}

Vocabulario de referencia (solo para calibrar nivel — NO usar como respuesta):
{words_for_llm}
{recent_exclusion}

REGLAS ABSOLUTAS — SIN EXCEPCIONES:
1. El campo "content" debe ser un ESCENARIO o SITUACIÓN en {lang_name}. PROHIBIDO escribirlo en español. PROHIBIDO definir palabras o pedir significados literales.
2. El campo "expected" debe ser la respuesta correcta en {lang_name}.
3. El campo "hint" debe ser la ayuda para el usuario, OBLIGATORIAMENTE en español.
4. NO incluyas la definición de la palabra. El usuario debe inferir del contexto del escenario.
5. El vocabulario de referencia es ÚNICAMENTE para calibrar el nivel de dificultad del ejercicio. NO uses ninguna de esas palabras como respuesta esperada.
6. PROHIBIDO usar como respuesta esperada (campo 'expected') cualquiera de las palabras del vocabulario de referencia listadas arriba. La respuesta debe ser vocabulario nuevo apropiado para el nivel.
7. El tipo de ejercicio: fill_in_the_blank, rewrite, o comprehension con escenario situacional real.
8. El nivel del escenario debe ser {user_progress.current_level}.{preparatory}
9. LONGITUD DEL ENUNCIADO: {length_hint} PROHIBIDO exceder esta longitud. Más texto no significa mejor ejercicio.

FORMAT0 DE RESPUESTA — devolvé ÚNICAMENTE este JSON sin markdown ni backticks:
{{"type": "fill_in_the_blank | rewrite | comprehension", "content": "escenario completo en {lang_name}", "expected": "respuesta correcta en {lang_name}", "hint": "pista en español para ayudar al usuario", "level": "{user_progress.current_level}"}}
"""

# [ADDED v4.0] Prompt para evaluar respuesta
def build_evaluation_prompt(exercise: Exercise, answer: str) -> str:
    return f"""
Ejercicio: "{exercise.content}"
Respuesta esperada: "{exercise.expected}"
Respuesta del usuario: "{answer}"

Evaluá del 0 al 100. Considerá gramática, vocabulario y sentido.
Sé generoso con sinónimos correctos.
IMPORTANTE: el campo score debe ser un número entero entre 0 y 100 que refleje la calidad real de la respuesta. NO copies el número del ejemplo. Calculalo.
Devolvé SOLO JSON: {{"score": <NUMBER_0_TO_100>, "feedback": "texto breve en español"}}
"""

# [ADDED v4.0] Solicitar ejercicio nuevo o devolver el pendiente
@router.post("/request", response_model=ExerciseRequestResponse)
def request_exercise(
    body: ExerciseRequest = None,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    language = (body.language if body else 'en') or 'en'
    levels = get_levels(language)
    first_level = levels[0]

    progress = db.query(UserProgress).filter(
        UserProgress.user_id == user.id,
        UserProgress.language == language
    ).first()

    if not progress:
        progress = UserProgress(user_id=user.id, language=language, current_level=first_level)
        db.add(progress)
        db.commit()
        db.refresh(progress)

    # Si hay ejercicio pendiente bloqueante, verificar límite y devolverlo
    if progress.current_exercise_id:
        pending = db.query(Exercise).filter(
            Exercise.id == progress.current_exercise_id,
            Exercise.status == "pending"
        ).first()
        if pending:
            # [FIX] Verificar límite antes de devolver ejercicio pendiente
            plan = get_user_plan(user, db)
            check_limit(user.id, "exercise", plan, db)
            return {
                "blocked": True,
                "exercise": {
                    "id": pending.id,
                    "type": pending.exercise_type,
                    "content": pending.content,
                    "hint": "Completá el ejercicio para continuar",
                    "level": pending.level
                }
            }

    # Leer vocabulario del usuario (últimas 20 palabras del idioma elegido)
    words = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.target_lang == language
    ).order_by(Vocabulary.times_practiced.asc(), Vocabulary.created_at.desc()).limit(20).all()

    if not words:
        raise HTTPException(status_code=400, detail=f"No tenés palabras guardadas para practicar {language}. Guardá palabras desde el análisis lingüístico.")

    plan = get_user_plan(user, db)
    limit_check = check_limit(user.id, "exercise", plan, db)

    # [ADDED] Consultar últimos 5 ejercicios para evitar repeticiones
    recent = db.query(Exercise).filter(
        Exercise.user_id == user.id,
        Exercise.level == progress.current_level
    ).order_by(Exercise.created_at.desc()).limit(5).all()
    recent_contents = [ex.content for ex in recent]

    # Llamar al LLM
    prompt = build_exercise_prompt(progress, words, language, recent_exercises=recent_contents)
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": f"You are a language exercise generator. The target language for the exercise is {LANG_NAMES.get(language, language)}. Strict rules: (1) The 'content' field must be written entirely in {LANG_NAMES.get(language, language)}. (2) The 'expected' field must be the correct answer in {LANG_NAMES.get(language, language)}. (3) The 'hint' field is the explanation for the student and must always be written in Spanish. (4) Never mix languages within the same field."
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=800
    )
    raw = response.choices[0].message.content.strip()

    # Limpiar markdown si existe
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        data = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"El modelo devolvió un formato inválido: {str(e)}")

    # Validar campos mínimos
    if not all(k in data for k in ("type", "content", "expected")):
        raise HTTPException(status_code=500, detail="El ejercicio generado no tiene los campos requeridos")

    vocab_word = words[0] if words else None
    exercise = Exercise(
        user_id=user.id,
        vocabulary_id=vocab_word.id if vocab_word else None,
        level=progress.current_level,
        exercise_type=data["type"],
        content=data["content"],
        expected=data["expected"],
        status="pending",
        answer_type="text"
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)

    progress.current_exercise_id = exercise.id
    progress.updated_at = datetime.utcnow()
    db.commit()

    return {
        "blocked": False,
        "exercise": {
            "id": exercise.id,
            "type": exercise.exercise_type,
            "content": exercise.content,
            "hint": data.get("hint", "Completá el ejercicio"),
            "level": exercise.level
        }
    }

# [ADDED v4.0] Enviar respuesta de ejercicio y evaluar
@router.post("/submit", response_model=SubmitResponse)
def submit_exercise(
    body: SubmitRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    exercise = db.query(Exercise).filter(
        Exercise.id == body.exercise_id,
        Exercise.user_id == user.id,
        Exercise.status.in_(["pending", "failed"])
    ).first()

    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado o ya resuelto")

    # Evaluar con LLM
    prompt = build_evaluation_prompt(exercise, body.answer)
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=300
    )
    raw = response.choices[0].message.content.strip()

    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        eval_data = json.loads(raw)
    except Exception:
        eval_data = {"score": 0, "feedback": "No se pudo evaluar la respuesta automáticamente."}

    score = min(100, max(0, int(eval_data.get("score", 0))))
    feedback = eval_data.get("feedback", "Sin feedback")

    pass_score = PASS_SCORE_BY_LEVEL.get(exercise.level, PASS_SCORE_DEFAULT)

    # Actualizar ejercicio
    exercise.status = "passed" if score >= pass_score else "failed"
    exercise.score = score
    exercise.llm_feedback = feedback
    db.commit()

    # Actualizar progreso del usuario
    language = body.language or 'en'
    levels = get_levels(language)
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == user.id,
        UserProgress.language == language
    ).first()
    if not progress:
        progress = UserProgress(user_id=user.id, language=language, current_level=levels[0])
        db.add(progress)
        db.commit()
        db.refresh(progress)

    level_changed = False
    new_level = None

    if score >= pass_score:
        progress.consecutive_wins += 1
        progress.consecutive_fails = 0
        if progress.consecutive_wins >= WINS_TO_ADVANCE:
            try:
                current_idx = levels.index(progress.current_level)
                if current_idx < len(levels) - 1:
                    progress.current_level = levels[current_idx + 1]
                    level_changed = True
                    new_level = progress.current_level
            except ValueError:
                progress.current_level = levels[0]
            progress.consecutive_wins = 0
            progress.consecutive_fails = 0
    else:
        progress.consecutive_fails += 1
        progress.consecutive_wins = 0
        if progress.consecutive_fails >= FAILS_TO_RETREAT:
            try:
                current_idx = levels.index(progress.current_level)
                if current_idx > 0:
                    progress.current_level = levels[current_idx - 1]
                    level_changed = True
                    new_level = progress.current_level
            except ValueError:
                progress.current_level = levels[0]
            progress.consecutive_wins = 0
            progress.consecutive_fails = 0

    progress.current_exercise_id = None
    progress.total_exercises += 1
    if score >= pass_score:
        progress.total_correct += 1
    progress.updated_at = datetime.utcnow()
    db.commit()

    # Actualizar stats de la palabra en vocabulario
    vocab = db.query(Vocabulary).filter(Vocabulary.id == exercise.vocabulary_id).first()
    if vocab:
        vocab.times_practiced += 1
        vocab.last_score = score
        db.commit()

    log_exercise(user.id, language, db)

    return {
        "score": score,
        "feedback": feedback,
        "level_changed": level_changed,
        "new_level": new_level,
        "status": exercise.status
    }


@router.post("/request-anonymous")
def request_exercise_anonymous(
    body: ExerciseRequest = None,
    req: Request = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    from middleware.auth_middleware import get_current_user
    from middleware.usage import record_anonymous_exercise
    device_seed = req.headers.get("x-device-seed") if req else None

    if not device_seed:
        raise HTTPException(status_code=401, detail="Device seed requerido")

    language = (body.language if body else 'en') or 'en'
    levels = get_levels(language)
    first_level = levels[0]

    words = db.query(AnonymousVocabulary).filter(
        AnonymousVocabulary.device_seed == device_seed,
        AnonymousVocabulary.target_lang == language
    ).order_by(AnonymousVocabulary.times_practiced.asc(), AnonymousVocabulary.created_at.desc()).limit(20).all()

    if not words:
        raise HTTPException(status_code=400, detail=f"No tenés palabras guardadas para practicar {language}. Guardá palabras desde el análisis lingüístico.")

    from middleware.usage import check_anonymous_exercise_limit
    limit_check = check_anonymous_exercise_limit(device_seed, db)

    progress = db.query(AnonymousUserProgress).filter(
        AnonymousUserProgress.device_seed == device_seed,
        AnonymousUserProgress.language == language
    ).first()

    if not progress:
        progress = AnonymousUserProgress(device_seed=device_seed, language=language, current_level=first_level)
        db.add(progress)
        db.commit()
        db.refresh(progress)

    if progress.current_exercise_id:
        pending = db.query(AnonymousExercise).filter(
            AnonymousExercise.id == progress.current_exercise_id,
            AnonymousExercise.status == "pending"
        ).first()
        if pending:
            # [FIX] Verificar límite antes de devolver ejercicio pendiente
            limit_check = check_anonymous_exercise_limit(device_seed, db)
            return {
                "blocked": True,
                "exercise": {
                    "id": pending.id,
                    "type": pending.exercise_type or "fill_in_the_blank",
                    "content": pending.content,
                    "hint": "Completá el ejercicio para continuar",
                    "level": pending.level
                }
            }

    # [ADDED] Consultar últimos 5 ejercicios para evitar repeticiones (Anonymous)
    recent = db.query(AnonymousExercise).filter(
        AnonymousExercise.device_seed == device_seed,
        AnonymousExercise.language == language,
        AnonymousExercise.level == progress.current_level
    ).order_by(AnonymousExercise.created_at.desc()).limit(5).all()
    recent_contents = [ex.content for ex in recent]

    prompt = build_exercise_prompt(progress, words, language, recent_exercises=recent_contents)
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": f"You are a language exercise generator. The target language for the exercise is {LANG_NAMES.get(language, language)}. Strict rules: (1) The 'content' field must be written entirely in {LANG_NAMES.get(language, language)}. (2) The 'expected' field must be the correct answer in {LANG_NAMES.get(language, language)}. (3) The 'hint' field is the explanation for the student and must always be written in Spanish. (4) Never mix languages within the same field."
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=800
    )
    raw = response.choices[0].message.content.strip()

    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        data = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"El modelo devolvió un formato inválido: {str(e)}")

    if not all(k in data for k in ("type", "content", "expected")):
        raise HTTPException(status_code=500, detail="El ejercicio generado no tiene los campos requeridos")

    vocab_word = words[0] if words else None
    exercise = AnonymousExercise(
        device_seed=device_seed,
        vocabulary_id=vocab_word.id if vocab_word else None,
        language=language,
        level=progress.current_level,
        exercise_type=data["type"],
        content=data["content"],
        expected=data["expected"],
        hint=data.get("hint"),
        status="pending",
        answer_type="text"
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)

    progress.current_exercise_id = exercise.id
    progress.updated_at = datetime.utcnow()
    db.commit()

    record_anonymous_exercise(device_seed, db)

    # Recalcular remaining DESPUÉS de registrar el uso para devolver el valor exacto
    from middleware.usage import LIMITS
    limit_anon = LIMITS.get("anonymous", 5)
    anon_after = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    exercises_after = anon_after.exercises_used if anon_after else 0
    exercises_remaining_real = max(0, limit_anon - exercises_after)

    return {
        "blocked": False,
        "exercise": {
            "id": exercise.id,
            "type": exercise.exercise_type,
            "content": exercise.content,
            "hint": exercise.hint or "Completá el ejercicio",
            "level": exercise.level
        },
        "exercises_remaining": exercises_remaining_real
    }


@router.post("/submit-anonymous")
def submit_exercise_anonymous(
    body: SubmitRequest,
    req: Request = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    device_seed = req.headers.get("x-device-seed") if req else None

    if not device_seed:
        raise HTTPException(status_code=401, detail="Device seed requerido")

    exercise = db.query(AnonymousExercise).filter(
        AnonymousExercise.id == body.exercise_id,
        AnonymousExercise.device_seed == device_seed,
        AnonymousExercise.status.in_(["pending", "failed"])
    ).first()

    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado o ya resuelto")

    prompt = build_evaluation_prompt_anon(exercise, body.answer)
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=300
    )
    raw = response.choices[0].message.content.strip()

    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        eval_data = json.loads(raw)
    except Exception:
        eval_data = {"score": 0, "feedback": "No se pudo evaluar la respuesta automáticamente."}

    score = min(100, max(0, int(eval_data.get("score", 0))))
    feedback = eval_data.get("feedback", "Sin feedback")

    pass_score = PASS_SCORE_BY_LEVEL.get(exercise.level or "A1", PASS_SCORE_DEFAULT)

    exercise.status = "passed" if score >= pass_score else "failed"
    exercise.score = score
    exercise.llm_feedback = feedback
    exercise.user_answer = body.answer
    db.commit()

    language = body.language or 'en'
    levels = get_levels(language)
    progress = db.query(AnonymousUserProgress).filter(
        AnonymousUserProgress.device_seed == device_seed,
        AnonymousUserProgress.language == language
    ).first()

    level_changed = False
    new_level = None

    if score >= pass_score:
        progress.consecutive_wins += 1
        progress.consecutive_fails = 0
        if progress.consecutive_wins >= WINS_TO_ADVANCE:
            try:
                current_idx = levels.index(progress.current_level)
                if current_idx < len(levels) - 1:
                    progress.current_level = levels[current_idx + 1]
                    level_changed = True
                    new_level = progress.current_level
            except ValueError:
                progress.current_level = levels[0]
            progress.consecutive_wins = 0
            progress.consecutive_fails = 0
    else:
        progress.consecutive_fails += 1
        progress.consecutive_wins = 0
        if progress.consecutive_fails >= FAILS_TO_RETREAT:
            try:
                current_idx = levels.index(progress.current_level)
                if current_idx > 0:
                    progress.current_level = levels[current_idx - 1]
                    level_changed = True
                    new_level = progress.current_level
            except ValueError:
                progress.current_level = levels[0]
            progress.consecutive_wins = 0
            progress.consecutive_fails = 0

    progress.current_exercise_id = None
    progress.total_exercises += 1
    if score >= pass_score:
        progress.total_correct += 1
    progress.updated_at = datetime.utcnow()
    db.commit()

    if exercise.vocabulary_id:
        vocab = db.query(AnonymousVocabulary).filter(AnonymousVocabulary.id == exercise.vocabulary_id).first()
        if vocab:
            vocab.times_practiced += 1
            vocab.last_score = score
            db.commit()

    # Retornar ejercicios restantes para que el frontend actualice el contador
    anon_after = db.query(AnonymousUsage).filter_by(device_seed=device_seed).first()
    exercises_after = anon_after.exercises_used if anon_after else 0
    exercises_remaining_after = max(0, 5 - exercises_after)

    return {
        "score": score,
        "feedback": feedback,
        "level_changed": level_changed,
        "new_level": new_level,
        "status": exercise.status,
        "exercises_remaining": exercises_remaining_after
    }


def build_evaluation_prompt_anon(exercise: AnonymousExercise, answer: str) -> str:
    return f"""
Ejercicio: "{exercise.content}"
Respuesta esperada: "{exercise.expected}"
Respuesta del usuario: "{answer}"

Evaluá del 0 al 100. Considerá gramática, vocabulario y sentido.
Sé generoso con sinónimos correctos.
IMPORTANTE: el campo score debe ser un número entero entre 0 y 100 que refleje la calidad real de la respuesta. NO copies el número del ejemplo. Calculalo.
Devolvé SOLO JSON: {{"score": <NUMBER_0_TO_100>, "feedback": "texto breve en español"}}
"""
