import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const API_ROOT = "/kemmy-model-set-library";
const css = `
.dom-widget:has(> .kms-panel){background:transparent!important;border:0!important;box-shadow:none!important;outline:0!important}
.kms-panel{font:12px sans-serif;color:var(--input-text,#ddd);background:var(--comfy-input-bg,#222);box-sizing:border-box;width:100%;height:720px;overflow:hidden;display:flex;flex-direction:column;border-radius:6px;padding:8px;gap:7px}
.kms-panel *{box-sizing:border-box}.kms-panel button,.kms-panel input,.kms-panel select{font:inherit;color:inherit;background:#292929;border:1px solid #555;border-radius:4px;padding:5px;min-width:0}.kms-panel button{cursor:pointer}.kms-panel button:hover{background:#3a3a3a}
.kms-editor{flex:none;border:1px solid #555;border-radius:6px;padding:8px;background:#202020}.kms-title{font-weight:700;margin:1px 0 6px}.kms-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.kms-field label{display:block;opacity:.75;margin-bottom:3px}.kms-span{grid-column:1/-1}.kms-field input,.kms-field select{width:100%}
.kms-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:7px}.kms-status{min-height:16px;color:#9dccff;margin-top:3px}.kms-loras{max-height:180px;overflow:auto;overscroll-behavior:contain;border:1px solid #444;border-radius:5px;padding:4px}.kms-lora{display:grid;grid-template-columns:auto minmax(120px,1fr) 62px 62px auto;gap:4px;align-items:center;margin:3px 0}.kms-lora input[type=number]{width:62px}
.kms-head{display:flex;gap:6px;align-items:center;flex:none}.kms-head .kms-title{flex:1;margin:0}.kms-list{flex:1 1 auto;min-height:90px;overflow:auto;overscroll-behavior:contain}.kms-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;border:1px solid #555;border-radius:6px;padding:7px;margin:5px 0;background:#202020}.kms-selected{border-color:#6aa9ff;background:#17283c;box-shadow:inset 3px 0 #6aa9ff}.kms-card-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kms-muted{opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kms-card-actions{display:flex;gap:4px}.kms-empty{opacity:.7;padding:10px}
`;

function el(tag, props = {}, children = []) {
  const x = document.createElement(tag);
  const { list, ...assignableProps } = props;
  Object.assign(x, assignableProps);
  // HTMLInputElement.list is a read-only property.  The datalist reference
  // must be written as an HTML attribute or workflow restoration can fail.
  if (list != null) x.setAttribute("list", list);
  for (const c of children) x.append(c);
  return x;
}
function parseJSON(value, fallback) { try { return typeof value === "string" ? JSON.parse(value) : (value ?? fallback); } catch { return fallback; } }
function uuid() { return crypto?.randomUUID?.() || `model-set-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function widget(node, name) { return node.widgets?.find(w => w.name === name); }
function hideWidget(w) { if (!w) return; w.hidden = true; w.type = "hidden"; w.draw = () => {}; w.computeSize = () => [0, 0]; w.computeLayoutSize = () => ({ minHeight: 0, maxHeight: 0, minWidth: 0, maxWidth: 0 }); w.serializeValue = async () => w.value; }
function isolateWheel(x) { const stop = e => e.stopPropagation(); x.addEventListener("wheel", stop, { capture: true, passive: true }); x.addEventListener("mousewheel", stop, { capture: true, passive: true }); }
async function request(url, options = {}) { const r = await api.fetchApi(url, options); if (!r.ok) throw new Error((await r.text()) || `${r.status}`); return r.json(); }
function ensureStyles() { if (document.getElementById("kemmy-model-set-style")) return; const s = el("style", { id: "kemmy-model-set-style", textContent: css }); document.head.append(s); }
function addDOM(node, container) {
  const height = 720;
  const sync = () => { const width = Math.max(380, Number(node.size?.[0] || 0)); container.style.width = `${width}px`; container.style.maxWidth = `${width}px`; };
  const w = node.addDOMWidget("model_set_library_editor", "custom", container, { serialize: false, hideOnZoom: false, getValue: () => null, setValue: () => {}, margin: 0, onDraw: sync, afterResize: sync });
  sync(); container.style.setProperty("--comfy-widget-min-height", `${height}px`); container.style.setProperty("--comfy-widget-height", `${height}px`); w.computeSize = () => [0, height]; node.setSize([Math.max(node.size[0], 470), Math.max(node.size[1], height + 90)]);
}
function datalist(id, values) { const d = el("datalist", { id }); for (const value of values || []) d.append(el("option", { value })); return d; }
function select(values) { const s = el("select"); for (const value of values || []) s.append(el("option", { value, textContent: value })); return s; }

function setup(node) {
  ensureStyles();
  const stateWidget = widget(node, "state_json"); hideWidget(stateWidget);
  const fallback = { version: 1, selected_id: null, current: null, snapshot: [] };
  let state = parseJSON(stateWidget?.value, fallback); state.snapshot ||= [];
  let library = { version: 1, presets: [...state.snapshot] };
  let options = { unets: [], clips: [], vaes: [], loras: [], clip_types: ["stable_diffusion"], weight_dtypes: ["default"], clip_devices: ["default", "cpu"] };
  let loras = [];

  const container = el("div", { className: "kms-panel" }); isolateWheel(container);
  const status = el("div", { className: "kms-status" });
  const name = el("input", { placeholder: "Preset name" });
  const unet = el("input", { placeholder: "Diffusion model", list: `kms-unet-${node.id}` });
  const clip = el("input", { placeholder: "Text encoder", list: `kms-clip-${node.id}` });
  const vae = el("input", { placeholder: "VAE", list: `kms-vae-${node.id}` });
  let dtype = select(options.weight_dtypes), clipType = select(options.clip_types), clipDevice = select(options.clip_devices);
  const loraList = el("div", { className: "kms-loras" }); isolateWheel(loraList);
  const presetList = el("div", { className: "kms-list" }); isolateWheel(presetList);

  const field = (label, input, span = false) => el("div", { className: `kms-field${span ? " kms-span" : ""}` }, [el("label", { textContent: label }), input]);
  const grid = el("div", { className: "kms-grid" });
  function rebuildSelect(old, values, current) { const next = select(values); next.value = current || values?.[0] || ""; old.replaceWith(next); return next; }
  function syncState() {
    state.version = 1;
    state.current = {
      id: state.selected_id || "workflow-current", name: name.value.trim() || "Unsaved model set",
      unet_name: unet.value.trim(), weight_dtype: dtype.value || "default",
      clip_name: clip.value.trim(), clip_type: clipType.value || "stable_diffusion", clip_device: clipDevice.value || "default",
      vae_name: vae.value.trim(), loras: loras.map(x => ({ ...x }))
    };
    const selected = library.presets.find(x => x.id === state.selected_id);
    state.snapshot = selected ? [{ ...selected, loras: selected.loras.map(x => ({ ...x })) }] : (state.current.unet_name ? [{ ...state.current }] : []);
    if (stateWidget) { stateWidget.value = JSON.stringify(state); stateWidget.callback?.(stateWidget.value); }
    node.graph?.setDirtyCanvas(true, true);
  }
  function show(profile) {
    const p = profile || {};
    name.value = p.name || ""; unet.value = p.unet_name || ""; dtype.value = p.weight_dtype || "default";
    clip.value = p.clip_name || ""; clipType.value = p.clip_type || "stable_diffusion"; clipDevice.value = p.clip_device || "default";
    vae.value = p.vae_name || ""; loras = (p.loras || []).map(x => ({ ...x })); renderLoras();
  }
  function renderLoras() {
    loraList.replaceChildren();
    loras.forEach((item, index) => {
      const enabled = el("input", { type: "checkbox", checked: item.enabled !== false, title: "Enable" });
      const modelStrength = el("input", { type: "number", value: item.strength_model ?? 1, step: "0.05", title: "Model strength" });
      const clipStrength = el("input", { type: "number", value: item.strength_clip ?? 0, step: "0.05", title: "CLIP strength" });
      const modelName = el("input", { value: item.name || "", list: `kms-lora-${node.id}`, placeholder: "LoRA file" });
      const remove = el("button", { textContent: "×", title: "Remove", onclick: () => { loras.splice(index, 1); renderLoras(); syncState(); } });
      enabled.onchange = () => { item.enabled = enabled.checked; syncState(); };
      modelName.onchange = () => { item.name = modelName.value; syncState(); };
      modelStrength.onchange = () => { item.strength_model = Number(modelStrength.value); syncState(); };
      clipStrength.onchange = () => { item.strength_clip = Number(clipStrength.value); syncState(); };
      loraList.append(el("div", { className: "kms-lora" }, [enabled, modelName, modelStrength, clipStrength, remove]));
    });
    if (!loras.length) loraList.append(el("div", { className: "kms-empty", textContent: "No LoRAs. Add one if needed." }));
  }
  async function saveLibrary() { library = await request(`${API_ROOT}/presets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(library) }); }
  async function saveCurrent() {
    if (!unet.value.trim() || !clip.value.trim() || !clipType.value || !vae.value.trim()) { status.textContent = "Model, text encoder, CLIP type, and VAE are required."; return; }
    const old = library.presets.find(x => x.id === state.selected_id);
    const preset = { id: old?.id || uuid(), name: name.value.trim() || "Untitled model set", unet_name: unet.value.trim(), weight_dtype: dtype.value, clip_name: clip.value.trim(), clip_type: clipType.value, clip_device: clipDevice.value, vae_name: vae.value.trim(), loras: loras.filter(x => x.name).map(x => ({ ...x })) };
    const index = library.presets.findIndex(x => x.id === preset.id); if (index >= 0) library.presets[index] = preset; else library.presets.push(preset);
    state.selected_id = preset.id; show(preset); await saveLibrary(); syncState(); renderPresets(); status.textContent = `Saved: ${preset.name}`;
  }
  function newPreset() { state.selected_id = null; show(null); syncState(); renderPresets(); status.textContent = "Configure a new model set."; name.focus(); }
  function selectPreset(preset) { state.selected_id = preset.id; show(preset); syncState(); renderPresets(); status.textContent = `Selected: ${preset.name}`; }
  function renderPresets() {
    presetList.replaceChildren();
    for (const preset of library.presets) {
      const selectedNow = preset.id === state.selected_id;
      const radio = el("input", { type: "radio", name: `kms-${node.id}`, checked: selectedNow }); radio.onchange = () => selectPreset(preset);
      const info = el("div", {}, [el("div", { className: "kms-card-name", textContent: preset.name }), el("div", { className: "kms-muted", textContent: `${preset.unet_name} · ${(preset.loras || []).filter(x => x.enabled !== false).length} LoRA(s)` })]);
      const actions = el("div", { className: "kms-card-actions" }, [
        el("button", { textContent: "Edit", onclick: e => { e.stopPropagation(); selectPreset(preset); } }),
        el("button", { textContent: "Duplicate", onclick: async e => { e.stopPropagation(); const copy = { ...preset, id: uuid(), name: `${preset.name} Copy`, loras: (preset.loras || []).map(x => ({ ...x })) }; library.presets.push(copy); await saveLibrary(); selectPreset(copy); } }),
        el("button", { textContent: "Delete", onclick: async e => { e.stopPropagation(); if (!confirm(`Delete ${preset.name}?`)) return; library.presets = library.presets.filter(x => x.id !== preset.id); if (state.selected_id === preset.id) newPreset(); await saveLibrary(); renderPresets(); } })
      ]);
      presetList.append(el("div", { className: `kms-card${selectedNow ? " kms-selected" : ""}`, onclick: e => { if (!e.target.closest("button,input")) selectPreset(preset); } }, [radio, info, actions]));
    }
    if (!library.presets.length) presetList.append(el("div", { className: "kms-empty", textContent: "No saved model sets yet." }));
  }

  const editor = el("div", { className: "kms-editor" }, [el("div", { className: "kms-title", textContent: "Current model set" }), grid,
    el("div", { className: "kms-title", textContent: "LoRAs  ·  Model strength / CLIP strength" }), loraList,
    el("div", { className: "kms-actions" }, [el("button", { textContent: "+ Add LoRA", onclick: () => { loras.push({ enabled: true, name: "", strength_model: 1, strength_clip: 0 }); renderLoras(); syncState(); } }), el("button", { textContent: "Save preset", onclick: saveCurrent }), el("button", { textContent: "+ New", onclick: newPreset })]), status]);
  const head = el("div", { className: "kms-head" }, [el("div", { className: "kms-title", textContent: "Model-set presets (select one)" }), el("button", { textContent: "Reload", onclick: async () => { library = await request(`${API_ROOT}/presets`); renderPresets(); status.textContent = "Library reloaded"; } })]);
  container.append(editor, head, presetList); addDOM(node, container);

  Promise.all([request(`${API_ROOT}/options`), request(`${API_ROOT}/presets`)]).then(([remoteOptions, remoteLibrary]) => {
    options = remoteOptions; library = remoteLibrary;
    const current = state.current || state.snapshot?.[0] || null;
    dtype = rebuildSelect(dtype, options.weight_dtypes, current?.weight_dtype); clipType = rebuildSelect(clipType, options.clip_types, current?.clip_type); clipDevice = rebuildSelect(clipDevice, options.clip_devices, current?.clip_device);
    grid.replaceChildren(field("Preset name", name, true), field("Diffusion model", unet, true), field("Weight dtype", dtype), field("Text encoder type", clipType), field("Text encoder", clip, true), field("Text encoder device", clipDevice), field("VAE", vae));
    container.append(datalist(`kms-unet-${node.id}`, options.unets), datalist(`kms-clip-${node.id}`, options.clips), datalist(`kms-vae-${node.id}`, options.vaes), datalist(`kms-lora-${node.id}`, options.loras));
    const merged = new Map(library.presets.map(x => [x.id, x])); for (const item of state.snapshot || []) if (!merged.has(item.id)) merged.set(item.id, item); library = { version: 1, presets: [...merged.values()] };
    const selected = library.presets.find(x => x.id === state.selected_id); show(selected || current); renderPresets(); syncState();
  }).catch(error => { show(state.current || state.snapshot?.[0]); renderPresets(); status.textContent = `Using workflow snapshot: ${error.message}`; });
  [name, unet, clip, vae].forEach(x => x.addEventListener("change", syncState));
  grid.append(field("Loading model options…", name, true)); renderLoras(); renderPresets();
}

app.registerExtension({
  name: "KemmyModelSetLibrary.Editor",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "KemmyModelSetLibrary") return;
    const original = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () { original?.apply(this, arguments); setup(this); };
  }
});
