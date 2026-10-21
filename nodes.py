import json


def parse_state(raw):
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(str(raw or ""))
        return value if isinstance(value, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def selected_profile(raw):
    state = parse_state(raw)
    current = state.get("current")
    if not isinstance(current, dict):
        raise ValueError("Select or configure a model-set preset first.")
    required = ("unet_name", "clip_name", "clip_type", "vae_name")
    missing = [name for name in required if not str(current.get(name) or "").strip()]
    if missing:
        raise ValueError("Model-set preset is missing: " + ", ".join(missing))
    return current


class KemmyModelSetLibrary:
    """Load one reusable UNET/CLIP/VAE/LoRA set selected in the browser UI."""

    RETURN_TYPES = ("MODEL", "CLIP", "VAE")
    RETURN_NAMES = ("model", "clip", "vae")
    FUNCTION = "load_set"
    CATEGORY = "kemmy/Loaders"
    DESCRIPTION = "Save and switch reusable model, text encoder, VAE, and multi-LoRA sets."

    @classmethod
    def INPUT_TYPES(cls):
        default = json.dumps(
            {"version": 1, "selected_id": None, "current": None, "snapshot": []},
            ensure_ascii=False,
        )
        return {"required": {"state_json": ("STRING", {"default": default, "multiline": True, "dynamicPrompts": False})}}

    @classmethod
    def IS_CHANGED(cls, state_json):
        return state_json

    def load_set(self, state_json):
        profile = selected_profile(state_json)
        # Import at execution time to avoid circular imports during custom-node discovery.
        from nodes import CLIPLoader, LoraLoader, UNETLoader, VAELoader

        model = UNETLoader().load_unet(
            str(profile["unet_name"]), str(profile.get("weight_dtype") or "default")
        )[0]
        clip = CLIPLoader().load_clip(
            str(profile["clip_name"]),
            str(profile["clip_type"]),
            str(profile.get("clip_device") or "default"),
        )[0]
        vae = VAELoader().load_vae(str(profile["vae_name"]))[0]

        loader = LoraLoader()
        for item in profile.get("loras", []):
            if not isinstance(item, dict) or not item.get("enabled", True):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            model_strength = float(item.get("strength_model", 1.0))
            clip_strength = float(item.get("strength_clip", 0.0))
            model, clip = loader.load_lora(model, clip, name, model_strength, clip_strength)
        return model, clip, vae


NODE_CLASS_MAPPINGS = {"KemmyModelSetLibrary": KemmyModelSetLibrary}
NODE_DISPLAY_NAME_MAPPINGS = {"KemmyModelSetLibrary": "cn_04_kemmy_Model Set Library"}
