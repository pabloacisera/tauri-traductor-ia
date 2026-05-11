import asyncio
import json
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["SSE"])

active_connections: Dict[str, asyncio.Queue] = {}


async def event_generator(device_seed: str, queue: asyncio.Queue):
    heartbeat_interval = 30
    try:
        yield f"event: connected\ndata: {json.dumps({'event': 'connected', 'device_seed': device_seed})}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=heartbeat_interval)
                yield f"event: {event['event']}\ndata: {json.dumps(event)}\n\n"
                if event.get('event') == 'close':
                    break
            except asyncio.TimeoutError:
                yield f"event: heartbeat\ndata: {json.dumps({'event': 'heartbeat', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
    except asyncio.CancelledError:
        yield f"event: close\ndata: {json.dumps({'event': 'close', 'reason': 'client_disconnect'})}\n\n"
    finally:
        if device_seed in active_connections:
            del active_connections[device_seed]


@router.get("/usage")
async def sse_usage_events(device_seed: str = Query(...)):
    if not device_seed:
        return StreamingResponse(
            iter([f"event: error\ndata: {json.dumps({'error': 'device_seed requerido'})}\n\n"]),
            media_type="text/event-stream"
        )

    queue: asyncio.Queue = asyncio.Queue(maxsize=10)
    active_connections[device_seed] = queue

    return StreamingResponse(
        event_generator(device_seed, queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


def notify_usage_change(device_seed: str, translations_used: int, exercises_used: int):
    if device_seed in active_connections:
        try:
            from middleware.usage import LIMITS
            limit = LIMITS.get("anonymous", 5)
            remaining_translations = max(0, limit - translations_used)
            remaining_exercises = max(0, limit - exercises_used)
            event = {
                "event": "usage_update",
                "device_seed": device_seed,
                "translations_used": translations_used,
                "exercises_used": exercises_used,
                "translations_remaining": remaining_translations,
                "exercises_remaining": remaining_exercises,
                "timestamp": datetime.utcnow().isoformat()
            }
            queue = active_connections[device_seed]

            # [FIX] Asegurar thread-safety para SSE desde middleware (threads de uvicorn)
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.call_soon_threadsafe(queue.put_nowait, event)
                else:
                    queue.put_nowait(event)
            except (RuntimeError, AssertionError):
                # Si no hay loop en este thread, intentamos directo
                queue.put_nowait(event)
        except Exception:
            # Nunca romper el flujo principal por un fallo en la notificación SSE
            pass