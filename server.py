from pathlib import Path

from aiohttp import web
from server import PromptServer

from .storage import atomic_write_json, read_json


_REGISTERED = False
_DTYPES = ["default", "fp8_e4m3fn", "fp8_e4m3fn_fast", "fp8_e5m2"]


def _data_root():
    try:
        import folder_paths
        root = Path(folder_paths.get_user_directory())
    except (ImportError, AttributeError):
        root = Path(__file__).resolve().parent / "_data"
    result = root / "kemmy_model_set_library"
    result.mkdir(parents=True, exist_ok=True)
    return result


def _library_path():
    return _data_root() / "presets.json"


def _default_library():
    return {"version": 1, "presets": []}


def _text(value):
    return str(value or "").strip()


def _number(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _clean_profile(item):
    if not isinstance(item, dict) or not _text(item.get("id")):
        return None
    loras = []
    for lora in item.get("loras", []) if isinstance(item.get("loras"), list) else []:
        if not isinstance(lora, dict) or not _text(lora.get("name")):
            continue
        loras.append({
            "enabled": bool(lora.get("enabled", True)),
            "name": _text(lora.get("name")),
            "strength_model": _number(lora.get("strength_model"), 1.0),
            "strength_clip": _number(lora.get("strength_clip"), 0.0),
        })
    return {
        "id": _text(item.get("id")),
        "name": _text(item.get("name")) or "Untitled model set",
        "unet_name": _text(item.get("unet_name")),
        "weight_dtype": _text(item.get("weight_dtype")) or "default",
        "clip_name": _text(item.get("clip_name")),
        "clip_type": _text(item.get("clip_type")) or "stable_diffusion",
        "clip_device": _text(item.get("clip_device")) or "default",
        "vae_name": _text(item.get("vae_name")),
        "loras": loras,
    }


def _clean_library(data):
    source = data.get("presets", []) if isinstance(data, dict) else []
    result = []
    for item in source if isinstance(source, list) else []:
        cleaned = _clean_profile(item)
        if cleaned:
            result.append(cleaned)
    return {"version": 1, "presets": result}


def register_routes():
    global _REGISTERED
    if _REGISTERED:
        return
    _REGISTERED = True
    routes = PromptServer.instance.routes

    @routes.get("/kemmy-model-set-library/presets")
    async def get_presets(request):
        return web.json_response(read_json(_library_path(), _default_library()))

    @routes.post("/kemmy-model-set-library/presets")
    async def save_presets(request):
        payload = _clean_library(await request.json())
        atomic_write_json(_library_path(), payload)
        return web.json_response(payload)

    @routes.get("/kemmy-model-set-library/options")
    async def get_options(request):
        import folder_paths
        from nodes import CLIPLoader, VAELoader

        clip_types = list(CLIPLoader.INPUT_TYPES()["required"]["type"][0])
        return web.json_response({
            "unets": folder_paths.get_filename_list("diffusion_models"),
            "clips": folder_paths.get_filename_list("text_encoders"),
            "vaes": VAELoader.vae_list(VAELoader),
            "loras": folder_paths.get_filename_list("loras"),
            "clip_types": clip_types,
            "weight_dtypes": _DTYPES,
            "clip_devices": ["default", "cpu"],
        })
