import json
import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nodes import KemmyModelSetLibrary, first_saved_profile, parse_state, selected_profile


class ModelSetTests(unittest.TestCase):
    def test_parse_invalid_state(self):
        self.assertEqual(parse_state("not-json"), {})

    def test_selected_profile(self):
        profile = {"unet_name": "u", "clip_name": "c", "clip_type": "moss_image", "vae_name": "v"}
        state = json.dumps({"current": profile})
        self.assertEqual(selected_profile(state), profile)

    def test_missing_value_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "vae_name"):
            selected_profile(json.dumps({"current": {"unet_name": "u", "clip_name": "c", "clip_type": "krea2"}}))

    def test_first_saved_profile_is_used_for_new_node(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "kemmy_model_set_library"
            data.mkdir()
            expected = {"id": "first", "unet_name": "u", "clip_name": "c", "clip_type": "moss_image", "vae_name": "v"}
            (data / "presets.json").write_text(json.dumps({"version": 1, "presets": [expected]}), encoding="utf-8")
            old = sys.modules.get("folder_paths")
            sys.modules["folder_paths"] = types.SimpleNamespace(get_user_directory=lambda: str(root))
            try:
                self.assertEqual(first_saved_profile(), expected)
                self.assertEqual(selected_profile(json.dumps({"current": None})), expected)
            finally:
                if old is None: sys.modules.pop("folder_paths", None)
                else: sys.modules["folder_paths"] = old

    def test_load_set_uses_standard_loaders_and_applies_enabled_loras(self):
        calls = []

        class UNETLoader:
            def load_unet(self, name, dtype):
                calls.append(("unet", name, dtype)); return ("model",)

        class CLIPLoader:
            def load_clip(self, name, kind, device):
                calls.append(("clip", name, kind, device)); return ("clip",)

        class VAELoader:
            def load_vae(self, name):
                calls.append(("vae", name)); return ("vae",)

        class LoraLoader:
            def load_lora(self, model, clip, name, model_strength, clip_strength):
                calls.append(("lora", name, model_strength, clip_strength)); return (model + "+lora", clip + "+lora")

        old = sys.modules.get("nodes")
        sys.modules["nodes"] = types.SimpleNamespace(UNETLoader=UNETLoader, CLIPLoader=CLIPLoader, VAELoader=VAELoader, LoraLoader=LoraLoader)
        try:
            profile = {
                "unet_name": "u", "weight_dtype": "default", "clip_name": "c", "clip_type": "moss_image",
                "clip_device": "default", "vae_name": "v",
                "loras": [{"enabled": True, "name": "speed", "strength_model": 0.7, "strength_clip": 0}],
            }
            result = KemmyModelSetLibrary().load_set(json.dumps({"current": profile}))
        finally:
            if old is None: sys.modules.pop("nodes", None)
            else: sys.modules["nodes"] = old
        self.assertEqual(result, ("model+lora", "clip+lora", "vae"))
        self.assertIn(("lora", "speed", 0.7, 0.0), calls)


if __name__ == "__main__":
    unittest.main()
