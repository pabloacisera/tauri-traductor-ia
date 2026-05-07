# [ADDED MVP-v1] Router de historial de traducciones
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from db.new_models import TranslationHistory, Subscription
from middleware.auth_middleware import require_auth
from middleware.usage import get_user_plan
from pydantic import BaseModel as _BaseModel

router = APIRouter()

@router.get("")
def get_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Historial paginado. Todos los usuarios registrados pueden ver su historial."""
    offset = (page - 1) * per_page
    total = db.query(TranslationHistory).filter(
        TranslationHistory.user_id == user.id
    ).count()

    items = db.query(TranslationHistory).filter(
        TranslationHistory.user_id == user.id
    ).order_by(TranslationHistory.created_at.desc()).offset(offset).limit(per_page).all()

    plan = get_user_plan(user, db)

    return {
        "items": [
            {
                "id": h.id,
                "original_text": h.original_text,
                "translated_text": h.translated_text,
                "source_language": h.source_language,
                "target_language": h.target_language,
                "has_analysis": h.analysis is not None,
                "has_audio": h.audio_base64 is not None,
                "created_at": h.created_at.isoformat()
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "plan": plan
    }

@router.get("/{history_id}")
def get_history_item(
    history_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Obtener traducción específica con análisis completo."""
    item = db.query(TranslationHistory).filter(
        TranslationHistory.id == history_id,
        TranslationHistory.user_id == user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Traducción no encontrada")

    analysis = None
    if item.analysis:
        try:
            analysis = json.loads(item.analysis)
        except Exception:
            analysis = item.analysis

    return {
        "id": item.id,
        "original_text": item.original_text,
        "translated_text": item.translated_text,
        "source_language": item.source_language,
        "target_language": item.target_language,
        "audio_base64": item.audio_base64,
        "analysis": analysis,
        "created_at": item.created_at.isoformat()
    }

@router.delete("/{history_id}")
def delete_history_item(
    history_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    item = db.query(TranslationHistory).filter(
        TranslationHistory.id == history_id,
        TranslationHistory.user_id == user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="No encontrado")
    db.delete(item)
    db.commit()
    return {"success": True}

# [ADDED MVP-v1] Endpoint PATCH para guardar análisis generado on-demand
import json as _json

class PatchAnalysisRequest(_BaseModel):
    analysis: dict

@router.patch("/{history_id}/analysis")
def patch_history_analysis(
    history_id: str,
    body: PatchAnalysisRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    item = db.query(TranslationHistory).filter(
        TranslationHistory.id == history_id,
        TranslationHistory.user_id == user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="No encontrado")
    item.analysis = _json.dumps(body.analysis, ensure_ascii=False)
    db.commit()
    return {"success": True}
