# Changelog

## 0.1.1 - 2026-10-25

- Add explicit dropdown selectors for diffusion models, text encoders, VAEs, and LoRAs while keeping editable path fields.
- Automatically select the first saved preset when a new node has no selection.
- Fall back to the first shared preset during execution if the browser UI has not synchronized yet.

## 0.1.0

- Initial public release.
- Save and switch reusable diffusion model, text encoder, VAE, and multi-LoRA presets.
- Store shared presets under the ComfyUI user directory.
- Embed the selected preset snapshot in workflow JSON.
