import os
import json
import functools
import langid
import time
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from transformers import MarianMTModel, MarianTokenizer
from langchain_groq import ChatGroq
from models.Models import TranslationRequest, GrammarRequest

load_dotenv()

app = FastAPI(title="Traductor Multilingüe")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Groq (sanitización - NO TOCAR) ──────────────────────────────────────────
llm = ChatGroq(
    temperature=0,
    model="llama-3.1-8b-instant",
    groq_api_key=os.getenv("GROQ_API_KEY"),
)

# ── Mapa de modelos Helsinki verificados ──────────────────────────────────────
# Estrategia: pivot en inglés. X→en→Y
# Si el origen o destino ES inglés, un solo salto.
# Si ninguno es inglés, dos saltos: X→en→Y
MODELS_TO_EN = {
    "es": "Helsinki-NLP/opus-mt-es-en",
    "fr": "Helsinki-NLP/opus-mt-fr-en",
    "pt": "Helsinki-NLP/opus-mt-pt-en",
    "zh": "Helsinki-NLP/opus-mt-zh-en",
    "ja": "Helsinki-NLP/opus-mt-ja-en",
}

MODELS_FROM_EN = {
    "es": "Helsinki-NLP/opus-mt-en-es",
    "fr": "Helsinki-NLP/opus-mt-en-fr",
    "pt": "Helsinki-NLP/opus-mt-en-ROMANCE",  # cubre pt, es, fr, it, etc.
    "zh": "Helsinki-NLP/opus-mt-en-zh",
    "ja": "Helsinki-NLP/opus-mt-en-jap",
}

# ── Carga lazy de modelos (solo cuando se necesitan) ─────────────────────────
# No cargamos los 10 al inicio — Render free tiene 500MB.
# Cada modelo Helsinki pesa ~300MB en disco pero ~80MB en RAM.
# Con lazy loading solo viven en RAM los que se usaron recientemente.
_model_cache: dict = {}

def get_model(model_name: str):
    if model_name not in _model_cache:
        print(f"⏳ Cargando modelo: {model_name}")
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        model.eval()
        _model_cache[model_name] = (tokenizer, model)
        print(f"✅ Listo: {model_name}")
    return _model_cache[model_name]


def translate_with_helsinki(text: str, src_lang: str, tgt_lang: str) -> str:
    """
    Traduce usando pivot en inglés si es necesario.
    - en→X : un salto directo
    - X→en : un salto directo  
    - X→Y  : dos saltos (X→en→Y)
    """
    import torch

    def _translate(text: str, model_name: str) -> str:
        tokenizer, model = get_model(model_name)
        inputs = tokenizer([text], return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.inference_mode():
            translated = model.generate(
                **inputs,
                num_beams=1,        # greedy — máxima velocidad
                max_new_tokens=256,
            )
        return tokenizer.decode(translated[0], skip_special_tokens=True)

    # Caso 1: origen es inglés → directo en→tgt
    if src_lang == "en":
        return _translate(text, MODELS_FROM_EN[tgt_lang])

    # Caso 2: destino es inglés → directo src→en
    if tgt_lang == "en":
        return _translate(text, MODELS_TO_EN[src_lang])

    # Caso 3: pivot → src→en→tgt
    in_english = _translate(text, MODELS_TO_EN[src_lang])
    return _translate(in_english, MODELS_FROM_EN[tgt_lang])


# ── Detección de idioma cacheada ──────────────────────────────────────────────
@functools.lru_cache(maxsize=256)
def detect_language(text: str) -> str:
    return langid.classify(text)[0]


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_in_cache": list(_model_cache.keys()),
    }


@app.post("/process")
async def process_translation(request: TranslationRequest):
    start_time = time.time()
    print(f"--- Petición: '{request.text[:40]}' ---")

    # ── 1. Sanitización con Groq (NO TOCAR) ──────────────────────────────────
    sanitization_prompt = (
        "Eres un corrector gramatical estricto. Analiza el texto entre ###.\n"
        "REGLAS:\n"
        "1. Si el texto tiene CUALQUIER error ortográfico, tipográfico o gramatical, responde ÚNICAMENTE un JSON.\n"
        "2. Si el texto es correcto, responde ÚNICAMENTE la palabra 'OK'.\n"
        "EJEMPLOS:\n"
        "- Texto: 'Hola muando' -> {\"status\": \"correction\", \"suggestions\": [\"Hola mundo\"]}\n"
        "- Texto: 'I is happy' -> {\"status\": \"correction\", \"suggestions\": [\"I am happy\"]}\n"
        "- Texto: 'Hola mundo' -> OK\n\n"
        f"### {request.text} ###"
    )

    try:
        analysis_raw = llm.invoke(sanitization_prompt)
        analysis = analysis_raw.content.strip()
        print(f"DEBUG Groq: {analysis}")

        if "{" in analysis and "suggestions" in analysis:
            json_start = analysis.find("{")
            json_end = analysis.rfind("}") + 1
            return JSONResponse(content=json.loads(analysis[json_start:json_end]))

        if "OK" not in analysis.upper():
            print(f"⚠️ Groq no formateó bien: {analysis}")

    except Exception as e:
        print(f"❌ Error en Groq: {e}")

    # ── 2. Traducción con Helsinki pivot ──────────────────────────────────────
    try:
        source = (
            detect_language(request.text)
            if request.source_lang == "auto"
            else request.source_lang
        )

        # Validar que los idiomas estén soportados
        supported = set(MODELS_TO_EN.keys()) | {"en"}
        if source not in supported:
            return JSONResponse(status_code=400, content={
                "status": "error",
                "msg": f"Idioma origen no soportado: {source}. Soportados: {sorted(supported)}"
            })
        if request.target_lang not in supported:
            return JSONResponse(status_code=400, content={
                "status": "error",
                "msg": f"Idioma destino no soportado: {request.target_lang}. Soportados: {sorted(supported)}"
            })

        # Si origen == destino, devolvemos el mismo texto
        if source == request.target_lang:
            return JSONResponse(content={
                "status": "success",
                "translated": request.text,
                "detected_source": source,
            })

        translated = translate_with_helsinki(request.text, source, request.target_lang)

        elapsed = time.time() - start_time
        print(f"⏱️ Completado en {elapsed:.2f}s")

        return JSONResponse(content={
            "status": "success",
            "translated": translated,
            "detected_source": source,
        })

    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "msg": str(e)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)