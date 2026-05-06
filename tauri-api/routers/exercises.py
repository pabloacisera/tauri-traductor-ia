# [ADDED v4.0] Router de ejercicios — generación con LLM, evaluación y progresión de nivel
import os
import json
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, Vocabulary, UserProgress, Exercise
from middleware.auth_middleware import require_auth
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
WINS_TO_ADVANCE = 3
FAILS_TO_RETREAT = 2
PASS_SCORE = 80

class ExerciseRequestResponse(BaseModel):
    blocked: bool
    exercise: Optional[dict] = None

class SubmitRequest(BaseModel):
    exercise_id: str
    answer: str
    answer_type: str = "text"

class SubmitResponse(BaseModel):
    score: int
    feedback: str
    level_changed: bool
    new_level: Optional[str] = None
    status: str

# [ADDED v4.0] Prompt para generar ejercicio
def build_exercise_prompt(user_progress: UserProgress, words: list) -> str:
    words_json = json.dumps([
        {"word": w.word, "definition": w.definition, "times_practiced": w.times_practiced, "last_score": w.last_score}
        for w in words
    ], ensure_ascii=False)

    preparatory = ""
    if user_progress.consecutive_fails >= 1:
        preparatory = "\nImportante: el usuario ha fallado recientemente. Generá un ejercicio preparatorio más sencillo que refuerce el concepto base."

    return f"""
Eres un profesor de idiomas experto. Generá un ejercicio de práctica para un estudiante de nivel {user_progress.current_level}.

Contexto del usuario:
- Nivel actual: {user_progress.current_level}
- Victorias consecutivas: {user_progress.consecutive_wins}
- Fallos consecutivos: {user_progress.consecutive_fails}

Palabras disponibles del vocabulario del usuario:
{words_json}

Reglas:
- Elegí UNA palabra del vocabulario como foco del ejercicio.
- El ejercicio debe ser desafiante pero adecuado al nivel {user_progress.current_level}.
- Generá un ejercicio de uno de estos tipos: fill_in_the_blank, rewrite, comprehension.
- Incluí una pista breve.{preparatory}

Devolvé ÚNICAMENTE un JSON válido (sin markdown, sin backticks) con este formato exacto:
{{"type": "fill_in_the_blank | rewrite | comprehension", "content": "texto del ejercicio", "expected": "respuesta esperada", "hint": "pista breve", "level": "{user_progress.current_level}"}}
"""

# [ADDED v4.0] Prompt para evaluar respuesta
def build_evaluation_prompt(exercise: Exercise, answer: str) -> str:
    return f"""
Ejercicio: "{exercise.content}"
Respuesta esperada: "{exercise.expected}"
Respuesta del usuario: "{answer}"

Evaluá del 0 al 100. Considerá gramática, vocabulario y sentido.
Sé generoso con sinónimos correctos.
Devolvé SOLO JSON: {{"score": 85, "feedback": "texto breve en español"}}
"""

# [ADDED v4.0] Solicitar ejercicio nuevo o devolver el pendiente
@router.post("/request", response_model=ExerciseRequestResponse)
def request_exercise(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    if not progress:
        progress = UserProgress(user_id=user.id, current_level="A1")
        db.add(progress)
        db.commit()
        db.refresh(progress)

    # Si hay ejercicio pendiente bloqueante, devolverlo
    if progress.current_exercise_id:
        pending = db.query(Exercise).filter(
            Exercise.id == progress.current_exercise_id,
            Exercise.status == "pending"
        ).first()
        if pending:
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

    # Leer vocabulario del usuario (últimas 20 palabras del nivel actual)
    words = db.query(Vocabulary).filter(
        Vocabulary.user_id == user.id,
        Vocabulary.level == progress.current_level
    ).order_by(Vocabulary.times_practiced.asc(), Vocabulary.created_at.desc()).limit(20).all()

    if not words:
        # Si no hay palabras del nivel actual, buscar cualquier palabra
        words = db.query(Vocabulary).filter(
            Vocabulary.user_id == user.id
        ).order_by(Vocabulary.times_practiced.asc()).limit(20).all()

    if not words:
        raise HTTPException(status_code=400, detail="No tenés palabras guardadas para practicar. Guardá palabras desde el análisis lingüístico.")

    # Llamar al LLM
    prompt = build_exercise_prompt(progress, words)
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
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
        Exercise.status == "pending"
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

    # Actualizar ejercicio
    exercise.status = "passed" if score >= PASS_SCORE else "failed"
    exercise.score = score
    exercise.llm_feedback = feedback
    db.commit()

    # Actualizar progreso del usuario
    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    if not progress:
        progress = UserProgress(user_id=user.id)
        db.add(progress)
        db.commit()
        db.refresh(progress)

    level_changed = False
    new_level = None

    if score >= PASS_SCORE:
        progress.consecutive_wins += 1
        progress.consecutive_fails = 0
        if progress.consecutive_wins >= WINS_TO_ADVANCE:
            current_idx = LEVELS.index(progress.current_level)
            if current_idx < len(LEVELS) - 1:
                progress.current_level = LEVELS[current_idx + 1]
                level_changed = True
                new_level = progress.current_level
            progress.consecutive_wins = 0
            progress.consecutive_fails = 0
    else:
        progress.consecutive_fails += 1
        progress.consecutive_wins = 0
        if progress.consecutive_fails >= FAILS_TO_RETREAT:
            current_idx = LEVELS.index(progress.current_level)
            if current_idx > 0:
                progress.current_level = LEVELS[current_idx - 1]
                level_changed = True
                new_level = progress.current_level
            progress.consecutive_wins = 0
            progress.consecutive_fails = 0

    progress.current_exercise_id = None
    progress.total_exercises += 1
    if score >= PASS_SCORE:
        progress.total_correct += 1
    progress.updated_at = datetime.utcnow()
    db.commit()

    # Actualizar stats de la palabra en vocabulario
    vocab = db.query(Vocabulary).filter(Vocabulary.id == exercise.vocabulary_id).first()
    if vocab:
        vocab.times_practiced += 1
        vocab.last_score = score
        db.commit()

    return {
        "score": score,
        "feedback": feedback,
        "level_changed": level_changed,
        "new_level": new_level,
        "status": exercise.status
    }
