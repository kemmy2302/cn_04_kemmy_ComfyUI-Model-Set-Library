# cn_04_kemmy_ComfyUI-Model-Set-Library

A ComfyUI custom node for saving and switching reusable model sets inside one model family.

## What a preset stores

- Diffusion model (`UNETLoader` compatible)
- Weight dtype
- Text encoder and encoder type
- Text encoder device
- VAE
- Any number of LoRAs
- Per-LoRA enable state, model strength, and CLIP strength

The node outputs `MODEL`, `CLIP`, and `VAE`, so the rest of a workflow can stay unchanged while the complete loader configuration changes from one preset to another.

## Intended use

Keep separate workflows for model families that require different latent, sampling, or conditioning structures. Use this node to switch presets within a compatible family—for example several Krea2 production sets or several MOSS-Image LoRA combinations.

## Installation

### ComfyUI Manager / Registry

After the first Registry release, search for **Kemmy Model Set Library** in ComfyUI Manager, install it, and restart ComfyUI.

### Manual installation

Clone the repository into `ComfyUI/custom_nodes`, restart ComfyUI, and add:

```text
Add Node → kemmy → Loaders → cn_04_kemmy_Model Set Library
```

No third-party Python dependencies are required.

Repository URL:

```text
https://github.com/kemmy2302/cn_04_kemmy_ComfyUI-Model-Set-Library
```

## Basic usage

1. Choose a diffusion model, text encoder, and VAE from their dropdown lists. The adjacent path fields remain editable for manual paths and newly added files.
2. Add zero or more LoRAs, then choose each file from its dropdown or enter its path manually.
3. Set each LoRA's model and CLIP strengths. Use `0` for CLIP strength when a LoRA should affect only the diffusion model.
4. Click **Save preset**.
5. Connect `model`, `clip`, and `vae` to the existing workflow.
6. Select another preset with its radio button whenever a different production set is needed.

When a newly added node has no selection and shared presets already exist, the first saved preset is selected automatically.

## Storage

The shared preset library is stored at:

```text
ComfyUI/user/kemmy_model_set_library/presets.json
```

The selected preset is also embedded as a snapshot in the workflow JSON. Model files themselves are never copied, moved, or bundled.

## Compatibility notes

- The diffusion model must be loadable by ComfyUI's standard `UNETLoader`.
- The text encoder must be loadable by the standard `CLIPLoader`.
- The VAE must be loadable by the standard `VAELoader`.
- Presets do not replace model-specific latent or sampling nodes.
- Missing files produce the same clear loader error as standard ComfyUI nodes.

## License

MIT

## For maintainers: publishing a release

1. Update `version` in `pyproject.toml`. Registry versions cannot be overwritten.
2. Add the GitHub Actions repository secret `REGISTRY_ACCESS_TOKEN`.
3. Open **Actions → Publish to Comfy Registry → Run workflow**.
4. Confirm the new version appears in the Comfy Registry.

Do not commit the Registry token to this repository.
