// 🎬 H3 Director Board — dashboard widget for the H3DirectorBoard node.
// The board lives as JSON in the node's (hidden) `board_json` widget; this file only edits it.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const N_PEOPLE = 4, N_VOICES = 3, MAX_SCENES = 12, N_LORAS = 4;
const LORA_COLORS = ["#ff6b4a", "#b98bff", "#3fd0c9", "#e8d44d"];
let LORA_FILES = null;
async function loraFiles() {
  if (LORA_FILES) return LORA_FILES;
  try { LORA_FILES = await (await api.fetchApi("/h3board/loras")).json(); } catch { LORA_FILES = []; }
  return LORA_FILES;
}
const KINDS = ["woman", "man", "young woman", "young man", "girl", "boy", "older woman", "older man", "person"];
const WHERE = [["", "position…"], ["left", "left"], ["center", "center"], ["right", "right"], ["foreground", "foreground"],
               ["background", "background"], ["left-bg", "back left"], ["right-bg", "back right"]];
const CAMERAS = ["static medium shot, locked-off (no camera visible)", "slow push-in to a medium close-up",
  "slow pull-back to a wide shot", "slow orbit around them", "half orbit behind them", "slow pan from left to right",
  "slow pan from right to left", "handheld, follows the action closely", "crane up from low to high",
  "crane down from high to low", "low-angle shot looking up", "high-angle shot looking down",
  "close-up on the faces", "over-the-shoulder shot", "the subject's point of view (POV)"];
const COLORS = ["#e0559a", "#3fa7f5", "#f5b335", "#62d26f"];

const CSS = `
.h3b{font:12px/1.35 system-ui,Segoe UI,sans-serif;color:#ddd;background:#16181d;border-radius:8px;height:100%;
  overflow:auto;box-sizing:border-box;padding:10px;user-select:text}
.h3b *{box-sizing:border-box}
.h3b h2{margin:0;font-size:17px;letter-spacing:.5px}
.h3b .bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.h3b .sp{flex:1}
.h3b button{background:#2a2f3a;color:#ddd;border:1px solid #3a4150;border-radius:6px;padding:3px 9px;cursor:pointer;font:inherit}
.h3b button:hover{background:#364055}
.h3b button.on{background:#2f6d3b;border-color:#4ea35d}
.h3b button.mic.on{background:#7a3d9c;border-color:#b06bd6}
.h3b button.danger:hover{background:#7a2d2d}
.h3b input,.h3b textarea,.h3b select{background:#0f1115;color:#eee;border:1px solid #333a46;border-radius:5px;padding:3px 5px;font:inherit;width:100%}
.h3b textarea{resize:vertical;min-height:44px}
.h3b .sec{background:#1d2027;border:1px solid #2a2f3a;border-radius:8px;padding:8px;margin-bottom:10px}
.h3b .sec>.t{font-weight:700;font-size:13px;margin-bottom:6px;display:flex;gap:8px;align-items:center;cursor:pointer}
.h3b .muted{color:#888;font-size:11px}
.h3b .cast{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.h3b .pc{border:1px solid #2f3542;border-top:4px solid var(--c);border-radius:8px;padding:6px;background:#191c22}
.h3b .pc.off{opacity:.45}
.h3b .pc .top{display:flex;gap:6px;align-items:center;margin-bottom:5px}
.h3b .thumb{width:64px;height:64px;border-radius:6px;object-fit:cover;background:#0b0c0f;border:1px solid #333;flex:none}
.h3b .thumb.sm{width:34px;height:34px}
.h3b .noimg{display:flex;align-items:center;justify-content:center;color:#666;font-size:10px;text-align:center}
.h3b .row{display:flex;gap:5px;align-items:center;margin-top:4px}
.h3b .tl{display:flex;gap:3px;height:46px;margin-bottom:10px}
.h3b .tl .b{border-radius:6px;background:#273041;border:1px solid #39465d;padding:3px 5px;overflow:hidden;cursor:pointer;min-width:34px}
.h3b .tl .b.off{opacity:.3}
.h3b .tl .b .n{font-weight:700}
.h3b .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:2px;vertical-align:middle}
.h3b .sc{display:grid;grid-template-columns:118px 1.25fr 2fr;gap:8px;border:1px solid #2a2f3a;border-radius:8px;padding:7px;margin-bottom:7px;background:#191c22}
.h3b .sc.off{opacity:.5}
.h3b .sc .num{font-size:22px;font-weight:800;color:#8fb4ff}
.h3b .cells{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:6px}
.h3b .cell{border:1px solid #2f3542;border-left:4px solid var(--c);border-radius:6px;padding:5px;background:#15171c}
.h3b .cell.in{background:#1f2633}
.h3b .cell .who{display:flex;gap:5px;align-items:center}
.h3b .chip{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.h3b .warn{background:#3a2a12;border:1px solid #7a5a1d;color:#ffd58a;border-radius:6px;padding:6px 8px;margin-bottom:10px}
.h3b .ok{background:#13301b;border:1px solid #2f6d3b;color:#9fe0ad;border-radius:6px;padding:4px 8px;margin-bottom:10px}
.h3b pre{white-space:pre-wrap;background:#0b0c0f;border:1px solid #2a2f3a;border-radius:6px;padding:7px;font:11px/1.4 ui-monospace,Consolas,monospace;color:#bfe;max-height:360px;overflow:auto;margin:6px 0 0}
.h3b .tags{font-size:11px;color:#9ab}
.h3b .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.h3b .lb{display:inline-block;border-radius:5px;padding:1px 6px;font-size:11px;margin:1px 2px;color:#111;font-weight:700}
.h3b button.lora{border-left:5px solid var(--lc);font-size:11px;padding:2px 6px}
.h3b button.lora.on{background:#4a3a1a;border-color:var(--lc);color:#fff}
.h3b .lr{display:grid;grid-template-columns:90px 2.2fr 70px 1.2fr;gap:6px;align-items:center;margin-bottom:5px;border-left:5px solid var(--lc);padding-left:6px}
.h3b label.lab{font-size:11px;color:#9aa3b2;display:block;margin:4px 0 2px}
`;

function injectCss() {
  if (document.getElementById("h3b-css")) return;
  const s = document.createElement("style");
  s.id = "h3b-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};

function emptyCast() {
  return Array.from({ length: N_PEOPLE }, () => ({ in: false, speaks: false, line: "", where: "", extra: false }));
}

function ensure(b) {
  b = b && typeof b === "object" ? b : {};
  b.version = 1;
  b.language ??= "French";
  b.style ??= "";
  b.camera ??= "";
  b.decor ??= "";
  b.sound ??= "";
  b.music ??= "N/A";
  b.people = (b.people || []).slice(0, N_PEOPLE);
  while (b.people.length < N_PEOPLE) b.people.push({ enabled: false, name: `Person ${b.people.length + 1}`, kind: "person", desc: "" });
  b.people.forEach((p, i) => { p.color ??= COLORS[i]; p.extra_text ??= "a full-body view of the same person (same outfit)"; p.kind ??= "person"; p.name ??= `Person ${i + 1}`; p.desc ??= ""; });
  b.loras = (b.loras || []).slice(0, N_LORAS);
  while (b.loras.length < N_LORAS) b.loras.push({});
  b.loras.forEach((l, k) => { l.name ??= ""; l.strength ??= 1.0; l.trigger ??= ""; l.label ??= `LoRA ${k + 1}`; });
  b.scenes = (b.scenes || []).slice(0, MAX_SCENES);
  b.scenes.forEach((s) => {
    s.on ??= true; s.title ??= ""; s.duration ??= 5; s.decor ??= true; s.camera ??= ""; s.action ??= "";
    s.loras = (s.loras || []).slice(0, N_LORAS).map(Boolean);
    while (s.loras.length < N_LORAS) s.loras.push(false);
    s.cast = (s.cast || []).slice(0, N_PEOPLE);
    while (s.cast.length < N_PEOPLE) s.cast.push({ in: false, speaks: false, line: "", where: "", extra: false });
  });
  return b;
}

function linkOf(id) {
  const g = app.graph;
  if (id == null) return null;
  return g.getLink ? g.getLink(id) : (g.links?.get ? g.links.get(id) : g.links?.[id]);
}

// Upstream loader of an input: {connected, file, url, kind}
function upstream(node, name) {
  const inp = (node.inputs || []).find((i) => i.name === name);
  if (!inp || inp.link == null) return { connected: false };
  const l = linkOf(inp.link);
  const src = l && app.graph.getNodeById(l.origin_id);
  if (!src) return { connected: false };
  if (src.mode === 2 || src.mode === 4) return { connected: false, muted: true, title: src.title };
  const w = (src.widgets || []).find((w) => w.name === "image" || w.name === "audio");
  const file = w && typeof w.value === "string" ? w.value : "";
  let url = "";
  if (file) {
    const parts = file.split(/[\\/]/);
    const fn = parts.pop();
    url = api.apiURL(`/view?filename=${encodeURIComponent(fn)}&type=input&subfolder=${encodeURIComponent(parts.join("/"))}`);
  }
  return { connected: true, file, url, title: src.title || src.type };
}

function connectedInfo(node) {
  const images = [1, 2, 3, 4].map((i) => upstream(node, `person_${i}`).connected)
    .concat([upstream(node, "decor").connected])
    .concat([1, 2, 3, 4].map((i) => upstream(node, `extra_${i}`).connected));
  const voices = [1, 2, 3].map((i) => upstream(node, `voice_${i}`).connected);
  return { images, voices };
}

function setupBoard(node) {
  injectCss();
  const jw = node.widgets?.find((w) => w.name === "board_json");
  if (!jw) return;
  // hide the raw JSON widget
  jw.hidden = true;
  jw.computeSize = () => [0, -4];
  if (jw.inputEl) jw.inputEl.style.display = "none";
  if (jw.element) jw.element.style.display = "none";

  const root = el("div", { class: "h3b" });
  root.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
  root.addEventListener("pointerdown", (e) => e.stopPropagation());
  root.addEventListener("keydown", (e) => e.stopPropagation());

  const state = { board: null, open: new Set(), showGlobal: true, compose: null, timer: null, lastJson: null };

  const read = () => {
    try { state.board = ensure(JSON.parse(jw.value || "{}")); } catch { state.board = ensure({}); }
    state.lastJson = jw.value;
  };
  const save = (rerender = false) => {
    jw.value = JSON.stringify(state.board);
    state.lastJson = jw.value;
    jw.callback?.(jw.value);
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
    if (rerender) render();
    scheduleCompose();
  };
  const scheduleCompose = () => {
    clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      try {
        const r = await api.fetchApi("/h3board/compose", { method: "POST", body: JSON.stringify({ board: state.board, connected: connectedInfo(node) }) });
        state.compose = await r.json();
      } catch (e) { state.compose = { error: String(e) }; }
      renderLive();
    }, 350);
  };

  // live parts (warnings, timeline tags, previews) — no full re-render, keeps focus
  const live = { warn: el("div"), previews: new Map(), tags: new Map() };
  function renderLive() {
    const c = state.compose || {};
    live.warn.replaceChildren(
      c.error ? el("div", { class: "warn" }, "⚠ preview error: " + c.error)
        : (c.warnings || []).length ? el("div", { class: "warn" }, el("b", {}, `⚠ ${c.warnings.length} warning(s)`), el("ul", { style: { margin: "4px 0 0 16px", padding: 0 } }, c.warnings.map((w) => el("li", {}, w))))
          : el("div", { class: "ok" }, "✔ board OK — each clip gets only its own photos and voices"));
    const byScene = new Map();
    (c.scene_index || []).forEach((si, k) => byScene.set(si, { prompt: c.prompts[k], info: c.scenes[k] }));
    for (const [si, box] of live.previews) {
      const d = byScene.get(si);
      box.textContent = d ? d.prompt : "(scene OFF — not generated)";
    }
    for (const [si, t] of live.tags) {
      const d = byScene.get(si);
      t.textContent = d ? `sends → ${d.info.pictures.map((p) => `<Picture ${p}>`).join(" ") || "no picture"}  ${d.info.voices.map((v) => `<Audio ${v}>`).join(" ") || "· no voice"}` : "OFF";
    }
  }

  function personName(i) { return state.board.people[i].name || `Person ${i + 1}`; }

  function castSection() {
    const b = state.board;
    const cards = b.people.map((p, i) => {
      const up = upstream(node, `person_${i + 1}`), ex = upstream(node, `extra_${i + 1}`);
      const vo = i < N_VOICES ? upstream(node, `voice_${i + 1}`) : null;
      const img = up.url ? el("img", { class: "thumb", src: up.url, title: up.file }) : el("div", { class: "thumb noimg" }, up.muted ? "loader muted" : `connect person_${i + 1}`);
      let audio = null;
      const voiceRow = i >= N_VOICES ? el("div", { class: "muted row" }, "🎙 no voice slot (Extender: 3 voices max)")
        : el("div", { class: "row" },
          el("span", {}, "🎙"),
          el("span", { class: "muted", style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: vo.file || "" },
            vo.connected ? vo.file || vo.title : (vo.muted ? "voice loader muted" : `connect voice_${i + 1}`)),
          vo.url ? el("button", { title: "play", onclick: () => { if (!audio) audio = new Audio(vo.url); if (audio.paused) audio.play(); else { audio.pause(); audio.currentTime = 0; } } }, "▶") : null);
      return el("div", { class: "pc" + (p.enabled ? "" : " off"), style: { "--c": p.color } },
        el("div", { class: "top" }, img,
          el("div", { style: { flex: 1 } },
            el("div", { class: "row", style: { marginTop: 0 } },
              el("button", { class: p.enabled ? "on" : "", onclick: () => { p.enabled = !p.enabled; save(true); } }, p.enabled ? "ON" : "OFF"),
              el("input", { value: p.name, placeholder: "name", oninput: (e) => { p.name = e.target.value; save(); } })),
            el("div", { class: "row" },
              el("select", { onchange: (e) => { p.kind = e.target.value; save(); } }, KINDS.map((k) => el("option", { value: k, selected: k === p.kind }, k))),
              el("input", { type: "color", value: p.color, style: { width: "34px", padding: 0 }, oninput: (e) => { p.color = e.target.value; save(true); } })))),
        el("textarea", { placeholder: "look / outfit / what must stay (e.g. beard, glasses, red sweater)", oninput: (e) => { p.desc = e.target.value; save(); } }, p.desc),
        voiceRow,
        el("div", { class: "row" },
          ex.url ? el("img", { class: "thumb sm", src: ex.url, title: ex.file }) : el("div", { class: "thumb sm noimg", title: `extra_${i + 1}` }, "+"),
          el("input", { value: p.extra_text, title: `what <Picture ${i + 6}> shows`, placeholder: "extra ref = full body / face…", oninput: (e) => { p.extra_text = e.target.value; save(); } })));
    });
    return el("div", { class: "sec" }, el("div", { class: "t" }, "👥 CAST", el("span", { class: "muted" }, "photos / voices come from the loaders wired into this node · write names in the scenes, they become <Subject n>")), el("div", { class: "cast" }, cards));
  }

  function timeline() {
    const b = state.board;
    const total = b.scenes.filter((s) => s.on).reduce((a, s) => a + Number(s.duration || 0), 0);
    return el("div", {},
      el("div", { class: "muted", style: { marginBottom: "3px" } }, `⏱ ${total.toFixed(1)} s planned · ${b.scenes.filter((s) => s.on).length} clip(s)`),
      el("div", { class: "tl" }, b.scenes.map((s, si) => el("div", {
        class: "b" + (s.on ? "" : " off"), style: { flex: Math.max(1, Number(s.duration) || 1) },
        title: s.title, onclick: () => root.querySelector(`[data-scene="${si}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      }, el("div", {}, el("span", { class: "n" }, si + 1), " ", el("span", { class: "muted" }, `${s.duration}s`)),
        el("div", {}, s.cast.map((c, i) => c.in && b.people[i].enabled ? el("span", { title: personName(i) }, el("span", { class: "dot", style: { background: b.people[i].color } }), c.speaks ? "🎙" : "") : null),
          b.loras.map((l, k) => s.loras[k] && l.name ? el("span", { class: "lb", title: l.name, style: { background: LORA_COLORS[k] } }, l.label || `L${k + 1}`) : null))))));
  }

  function sceneRow(s, si) {
    const b = state.board;
    const active = b.people.map((p, i) => [p, i]).filter(([p]) => p.enabled);
    const pre = el("pre", { style: { display: state.open.has(si) ? "block" : "none" } });
    live.previews.set(si, pre);
    const tags = el("div", { class: "tags" });
    live.tags.set(si, tags);
    const move = (d) => { const j = si + d; if (j < 0 || j >= b.scenes.length) return; [b.scenes[si], b.scenes[j]] = [b.scenes[j], b.scenes[si]]; save(true); };
    const cells = active.map(([p, i]) => {
      const c = s.cast[i];
      return el("div", { class: "cell" + (c.in ? " in" : ""), style: { "--c": p.color } },
        el("div", { class: "who" },
          el("button", { class: "chip" + (c.in ? " on" : ""), title: "in this scene?", onclick: () => { c.in = !c.in; if (!c.in) c.speaks = false; save(true); } }, (c.in ? "✔ " : "✖ ") + (p.name || `P${i + 1}`)),
          el("button", { class: "mic" + (c.speaks ? " on" : ""), title: "speaks in this scene (gets his/her voice)", disabled: !c.in, onclick: () => { c.speaks = !c.speaks; save(true); } }, "🎙")),
        c.in ? el("div", { class: "row" },
          el("select", { onchange: (e) => { c.where = e.target.value; save(); } }, WHERE.map(([v, t]) => el("option", { value: v, selected: v === c.where }, t))),
          el("label", { class: "muted", title: `send <Picture ${i + 6}> (extra_${i + 1})`, style: { whiteSpace: "nowrap" } },
            el("input", { type: "checkbox", checked: c.extra, style: { width: "auto" }, onchange: (e) => { c.extra = e.target.checked; save(); } }), " +extra")) : null,
        c.in && c.speaks ? el("input", { value: c.line, placeholder: `${p.name} says… (${b.language})`, style: { marginTop: "4px" }, oninput: (e) => { c.line = e.target.value; save(); } }) : null);
    });
    return el("div", { class: "sc" + (s.on ? "" : " off"), "data-scene": si, style: {} },
      el("div", {},
        el("div", { class: "row", style: { marginTop: 0 } }, el("span", { class: "num" }, si + 1),
          el("button", { class: s.on ? "on" : "", onclick: () => { s.on = !s.on; save(true); } }, s.on ? "ON" : "OFF")),
        el("div", { class: "row" }, el("input", { type: "number", min: 1, max: 15, step: 0.5, value: s.duration, title: "duration (s)", oninput: (e) => { s.duration = Number(e.target.value) || 5; save(); } }), el("span", { class: "muted" }, "s")),
        el("label", { class: "muted row", title: "use the DECOR photo <Picture 5> in this scene" },
          el("input", { type: "checkbox", checked: s.decor, style: { width: "auto" }, onchange: (e) => { s.decor = e.target.checked; save(); } }), " 🏠 decor"),
        el("div", { class: "row", style: { flexWrap: "wrap", gap: "3px" } }, b.loras.map((l, k) => l.name ? el("button", {
          class: "lora" + (s.loras[k] ? " on" : ""), style: { "--lc": LORA_COLORS[k] }, title: `${l.name} (${l.strength})${l.trigger ? " · trigger: " + l.trigger : ""}`,
          onclick: () => { s.loras[k] = !s.loras[k]; save(true); } }, (s.loras[k] ? "✔ " : "") + (l.label || `L${k + 1}`)) : null)),
        el("div", { class: "row" },
          el("button", { title: "move up", onclick: () => move(-1) }, "▲"), el("button", { title: "move down", onclick: () => move(1) }, "▼"),
          el("button", { title: "duplicate", onclick: () => { if (b.scenes.length >= MAX_SCENES) return; b.scenes.splice(si + 1, 0, JSON.parse(JSON.stringify(s))); save(true); } }, "⧉"),
          el("button", { class: "danger", title: "delete", onclick: () => { if (confirm(`Delete scene ${si + 1}?`)) { b.scenes.splice(si, 1); save(true); } } }, "🗑"))),
      el("div", {},
        el("input", { value: s.title, placeholder: "scene title", style: { fontWeight: 700, marginBottom: "4px" }, oninput: (e) => { s.title = e.target.value; save(); } }),
        el("textarea", { rows: 4, placeholder: "Action — write the names (Nico sits at the table, Alex looks at the screen…). Lines go in the 🎙 boxes →", oninput: (e) => { s.action = e.target.value; save(); } }, s.action),
        el("input", { value: s.camera, list: "h3b-cams", placeholder: "🎥 camera move (pick or type)", style: { marginTop: "4px" }, oninput: (e) => { s.camera = e.target.value; save(); } })),
      el("div", {},
        el("div", { class: "cells", style: { "--n": Math.max(1, active.length) } }, cells.length ? cells : el("div", { class: "muted" }, "Turn people ON in the cast")),
        el("div", { class: "row" }, el("button", { onclick: () => { if (state.open.has(si)) state.open.delete(si); else state.open.add(si); pre.style.display = state.open.has(si) ? "block" : "none"; } }, "👁 prompt"),
          el("button", { title: "copy this prompt", onclick: () => navigator.clipboard?.writeText(pre.textContent) }, "📋"), tags),
        pre));
  }

  function loraSection() {
    const b = state.board;
    const files = LORA_FILES || [];
    const rows = b.loras.map((l, k) => {
      const sel = el("select", { onchange: (e) => { l.name = e.target.value; if (l.name && /^LoRA \d$/.test(l.label)) l.label = l.name.split(/[\\/]/).pop().replace(/\.safetensors$/, "").slice(0, 14); save(true); } },
        el("option", { value: "" }, "— none —"),
        (files.includes(l.name) || !l.name ? files : [l.name, ...files]).map((f) => el("option", { value: f, selected: f === l.name }, f)));
      const used = b.scenes.map((s, si) => s.loras[k] ? si + 1 : null).filter(Boolean);
      return el("div", { class: "lr", style: { "--lc": LORA_COLORS[k] } },
        el("input", { value: l.label, title: "short label (scene buttons)", oninput: (e) => { l.label = e.target.value; save(); }, onchange: () => render() }),
        sel,
        el("input", { type: "number", step: 0.05, value: l.strength, title: "strength", oninput: (e) => { l.strength = Number(e.target.value); save(); } }),
        el("input", { value: l.trigger, placeholder: "trigger word(s), added to the prompt", oninput: (e) => { l.trigger = e.target.value; save(); } }),
        el("span", { class: "muted", style: { gridColumn: "2 / 5" } }, l.name ? (used.length ? `active in scene ${used.join(", ")}` : "not used in any scene (tick it in the scenes)") : ""));
    });
    return el("div", { class: "sec" },
      el("div", { class: "t" }, "🎛 LORAS PER SCENE", el("span", { class: "muted" }, "up to 4 · tick them per scene in the scene rows · model-only, applied to that clip only · trigger added at the start of the shot")),
      rows);
  }

  function globalSection() {
    const b = state.board;
    const field = (label, key, rows = 2, ph = "") => el("div", {}, el("label", { class: "lab" }, label),
      rows ? el("textarea", { rows, placeholder: ph, oninput: (e) => { b[key] = e.target.value; save(); } }, b[key]) : el("input", { value: b[key], placeholder: ph, oninput: (e) => { b[key] = e.target.value; save(); } }));
    return el("div", { class: "sec" },
      el("div", { class: "t", onclick: () => { state.showGlobal = !state.showGlobal; render(); } }, (state.showGlobal ? "▾" : "▸") + " 🌍 GLOBAL (style, camera, decor, sound)", el("span", { class: "muted" }, "shared by every scene")),
      state.showGlobal ? el("div", {},
        el("div", { class: "g2" }, field("🎨 Style / light", "style", 2, "Live-action, natural, daylight…"), field("🎥 Camera style (every scene)", "camera", 2, "Medium shots, faces large…")),
        el("div", { class: "g2" }, field("🏠 Decor text (used when 🏠 is ticked and a decor photo is wired) — keep <Picture 5>", "decor", 2), field("🔊 Sound (ambience, foley)", "sound", 2)),
        el("div", { class: "g2" }, field("🎵 Music (non_diegetic_music, N/A = none)", "music", 0), field("🗣 Language of the lines", "language", 0))) : null);
  }

  function render() {
    live.previews.clear(); live.tags.clear();
    const b = state.board;
    const dl = el("datalist", { id: "h3b-cams" }, CAMERAS.map((c) => el("option", { value: c })));
    root.replaceChildren(
      dl,
      el("div", { class: "bar" },
        el("h2", {}, "🎬 H3 DIRECTOR BOARD"), el("span", { class: "muted" }, "cast × scenes → prompts, photos and voices per clip"),
        el("span", { class: "sp" }),
        el("button", { onclick: () => { if (b.scenes.length >= MAX_SCENES) return; const last = b.scenes[b.scenes.length - 1]; b.scenes.push(last ? { ...JSON.parse(JSON.stringify(last)), title: "", action: "", cast: last.cast.map((c) => ({ ...c, speaks: false, line: "" })) } : { on: true, title: "", duration: 5, decor: true, camera: "", action: "", loras: [false, false, false, false], cast: emptyCast() }); save(true); } }, "＋ scene"),
        el("button", { onclick: () => { const all = b.scenes.every((_, i) => state.open.has(i)); b.scenes.forEach((_, i) => all ? state.open.delete(i) : state.open.add(i)); render(); } }, "👁 all prompts"),
        el("button", { title: "copy the board JSON", onclick: () => navigator.clipboard?.writeText(JSON.stringify(b, null, 1)) }, "⤓ export"),
        el("button", { title: "paste a board JSON", onclick: () => { const t = prompt("Paste a board JSON"); if (!t) return; try { state.board = ensure(JSON.parse(t)); save(true); } catch (e) { alert("Invalid JSON: " + e); } } }, "⤒ import"),
        el("button", { title: "re-read loaders (thumbnails)", onclick: () => { render(); scheduleCompose(); } }, "⟳")),
      live.warn,
      timeline(),
      castSection(),
      loraSection(),
      el("div", { class: "sec" }, el("div", { class: "t" }, "🎞 SCENES", el("span", { class: "muted" }, "✔ = in the scene (photo sent) · 🎙 = speaks (voice sent) · empty scenes get no voice")),
        b.scenes.map((s, si) => sceneRow(s, si))),
      globalSection());
    renderLive();
  }

  read();
  render();
  scheduleCompose();
  loraFiles().then(() => render());

  node.addDOMWidget("director_board", "h3board", root, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => 500,
  });
  node.__h3b = { reload: () => { read(); render(); scheduleCompose(); } };
  if (node.size[0] < 1700 || node.size[1] < 1000) node.setSize([Math.max(node.size[0], 1700), Math.max(node.size[1], 1100)]);

  // refresh thumbnails / warnings when wires change or a loader file changes
  const onCC = node.onConnectionsChange;
  node.onConnectionsChange = function () { const r = onCC?.apply(this, arguments); setTimeout(() => { render(); scheduleCompose(); }, 50); return r; };
  const iv = setInterval(() => {
    if (!root.isConnected) return;
    if (jw.value !== state.lastJson) { read(); render(); scheduleCompose(); }
  }, 1500);
  const onRemoved = node.onRemoved;
  node.onRemoved = function () { clearInterval(iv); return onRemoved?.apply(this, arguments); };
}

app.registerExtension({
  name: "h3.director.board",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "H3DirectorBoard") return;
    const onCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onCreated?.apply(this, arguments);
      setupBoard(this);
      return r;
    };
    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = onConfigure?.apply(this, arguments);
      setTimeout(() => this.__h3b?.reload(), 0);
      return r;
    };
  },
});
