"""H3 Director Board: one node = cast + scenes + who is in which scene + who speaks where -> MiniMax H3 Extender packs.

The board (edited in the dashboard widget, stored as JSON in the hidden `board_json` widget) is turned into:
  - ref_pack     : Picture 1-4 = persons, 5 = decor, 6-9 = extra ref of person 1-4 (body / face)
  - prompt_pack  : one prompt per active scene, written for H3 (subject_definitions / [Shot 1] / soundscape / music),
                   source "H3 Director Board" + per-scene durations
  - audio_1..3   : voices of persons 1-3 (to Extender ref_audio_1..3; the Extender reads only 3 voice slots)
The routing patch (routing_patch.py) makes the Extender honour the board per clip: a clip only receives the photos
<Picture n> and voices <Audio n> written in its own prompt, and takes its duration from the board.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re

SOURCE = "H3 Director Board"
MAX_SCENES = 12
N_PEOPLE = 4
N_VOICES = 3

KINDS = ["woman", "man", "young woman", "young man", "girl", "boy", "older woman", "older man", "person"]
WHERE = {
    "": "",
    "left": "on the left of the frame",
    "center": "in the center of the frame",
    "right": "on the right of the frame",
    "foreground": "in the foreground, close to the camera",
    "background": "in the background",
    "left-bg": "in the background on the left",
    "right-bg": "in the background on the right",
}


def default_board():
    person = lambda name, kind, color, desc: {
        "enabled": True, "name": name, "kind": kind, "color": color, "desc": desc,
        "extra_text": "a full-body view of the same person (same outfit)",
    }
    cast = lambda *on: [{"in": bool(on[i]) if i < len(on) else False, "speaks": False, "line": "", "where": "",
                         "extra": False} for i in range(N_PEOPLE)]
    s1 = cast(1, 1)
    s1[0]["where"], s1[1]["where"] = "left", "right"
    s2 = cast(1, 1)
    s2[0]["where"], s2[1]["where"] = "left", "right"
    s2[1].update(speaks=True, line="Salut, ça va ?")
    return {
        "version": 1,
        "language": "French",
        "style": "Live-action, natural and realistic, daytime, soft natural light. No text or subtitles on screen.",
        "camera": "Medium shots, faces always large, sharp and clearly visible, smooth natural handheld camera "
                  "(no camera visible).",
        "decor": "The place is exactly the place shown in <Picture 5>: same layout, furniture and colours. "
                 "<Picture 5> shows only the place: nobody from it appears in the video.",
        "sound": "Quiet room tone, soft footsteps, small everyday sounds.",
        "music": "N/A",
        "people": [
            person("Anna", "woman", "#e0559a", "She wears a light-blue t-shirt and jeans."),
            person("Tom", "man", "#3fa7f5", "He wears a dark grey t-shirt and jeans."),
            person("Person 3", "person", "#f5b335", ""),
            person("Person 4", "person", "#62d26f", ""),
        ],
        "scenes": [
            {"on": True, "title": "Arrival", "duration": 5.0, "decor": True, "camera": "slow push-in",
             "action": "Anna sits on the sofa reading, Tom walks in and sits next to her.", "cast": s1},
            {"on": True, "title": "Hello", "duration": 5.0, "decor": True, "camera": "static medium shot",
             "action": "Tom turns to Anna and smiles.", "cast": s2},
        ],
    }


def normalize(board):
    """Fill missing keys so old / hand-edited boards never crash."""
    base = default_board()
    if not isinstance(board, dict):
        return base
    out = copy.deepcopy(board)
    for k, v in base.items():
        if k not in out:
            out[k] = v if k != "scenes" else []
    people = list(out.get("people") or [])[:N_PEOPLE]
    while len(people) < N_PEOPLE:
        people.append(copy.deepcopy(base["people"][len(people)]) | {"enabled": False})
    for i, p in enumerate(people):
        for k, v in base["people"][i].items():
            p.setdefault(k, v)
    out["people"] = people
    scenes = []
    for s in list(out.get("scenes") or [])[:MAX_SCENES]:
        s = dict(s)
        s.setdefault("on", True)
        s.setdefault("title", "")
        s.setdefault("duration", 5.0)
        s.setdefault("decor", True)
        s.setdefault("camera", "")
        s.setdefault("action", "")
        cast = list(s.get("cast") or [])[:N_PEOPLE]
        while len(cast) < N_PEOPLE:
            cast.append({})
        s["cast"] = [{"in": bool(c.get("in")), "speaks": bool(c.get("speaks")), "line": str(c.get("line") or ""),
                      "where": str(c.get("where") or ""), "extra": bool(c.get("extra"))} for c in cast]
        scenes.append(s)
    out["scenes"] = scenes
    return out


def _sentence(text):
    text = (text or "").strip()
    if text and text[-1] not in ".!?\"'":
        text += "."
    return text


def _names_to_tags(text, people, present):
    """Replace person names (whole words, outside quotes) by <Subject n> for persons in the scene."""
    parts = re.split(r'("[^"]*"|«[^»]*»)', text or "")
    names = sorted(((p["name"].strip(), i) for i, p in enumerate(people) if i in present and p["name"].strip()),
                   key=lambda x: -len(x[0]))
    for k in range(0, len(parts), 2):
        seg = parts[k]
        for name, i in names:
            seg = re.sub(r"(?<![\w<])" + re.escape(name) + r"(?![\w>])", f"<Subject {i + 1}>", seg, flags=re.IGNORECASE)
        parts[k] = seg
    return "".join(parts)


def compose(board, connected=None):
    """Return dict(prompts, durations, scene_index, warnings, scenes) for the active scenes.

    connected = {"images": [bool]*9, "voices": [bool]*3}: which inputs are wired (unknown -> assumed wired)."""
    b = normalize(board)
    conn = connected or {}
    img = list(conn.get("images") or [True] * 9) + [True] * 9
    voi = list(conn.get("voices") or [True] * N_VOICES) + [True] * N_VOICES
    people = b["people"]
    lang = (b.get("language") or "French").strip() or "French"
    prompts, durations, index, warnings, infos = [], [], [], [], []
    for si, s in enumerate(b["scenes"]):
        if not s.get("on"):
            continue
        sn = si + 1
        tag = f"Scene {sn}" + (f" ({s['title']})" if s.get("title") else "")
        present = [i for i in range(N_PEOPLE) if people[i].get("enabled") and s["cast"][i]["in"]]
        for i in range(N_PEOPLE):
            if s["cast"][i]["in"] and not people[i].get("enabled"):
                warnings.append(f"{tag}: {people[i]['name'] or f'person {i + 1}'} is ticked but disabled in the cast.")
        defs, pics, auds = [], [], []
        for i in present:
            p, c = people[i], s["cast"][i]
            n = i + 1
            if not img[i]:
                warnings.append(f"{tag}: no photo connected for {p['name'] or f'person {n}'} (person_{n}).")
            line = f"<Subject {n}> is the {p.get('kind') or 'person'} from <Picture {n}>"
            pics.append(n)
            extra = c.get("extra") and img[5 + i]
            if c.get("extra") and not img[5 + i]:
                warnings.append(f"{tag}: '+ extra ref' ticked for {p['name']} but extra_{n} is not connected.")
            line += f": same face, same hair. {_sentence(p.get('desc'))}".rstrip()
            if extra:
                line += f" <Picture {n + 5}> is {p.get('extra_text') or 'another view of the same person'}."
                pics.append(n + 5)
            speaks = c.get("speaks") and c.get("line", "").strip()
            if speaks:
                if i >= N_VOICES:
                    warnings.append(f"{tag}: {p['name']} speaks but the Extender has only 3 voice slots: person 4 "
                                    "gets an invented voice.")
                elif not voi[i]:
                    warnings.append(f"{tag}: {p['name']} speaks but voice_{n} is not connected: invented voice.")
                else:
                    line += (f" The voice of <Subject {n}> is the voice of <Audio {n}> (timbre only: never repeat "
                             f"any word from <Audio {n}>).")
                    auds.append(n)
            defs.append(line.strip())
        use_decor = s.get("decor") and img[4] and (b.get("decor") or "").strip()
        if use_decor:
            pics.append(5)
        if not present:
            warnings.append(f"{tag}: nobody is in this scene.")
        # --- description
        k = len(present)
        if k:
            who = ", ".join(
                f"<Subject {i + 1}>" + (f" {WHERE.get(s['cast'][i]['where'], '')}" if WHERE.get(s['cast'][i]['where']) else "")
                for i in present)
            count = (f"Exactly one person in the frame: {who}." if k == 1 else
                     f"Exactly {k} people in the frame: {who}.")
            count += " Each person appears only once, nobody else in the room."
        else:
            count = "Nobody is in the frame."
        action = _sentence(_names_to_tags(s.get("action"), people, present))
        speakers = [i for i in present if s["cast"][i]["speaks"] and s["cast"][i]["line"].strip()]
        lines = " ".join(f'<Subject {i + 1}> says in {lang}: "{s["cast"][i]["line"].strip()}"' for i in speakers)
        if speakers:
            only = " and ".join(f"<Subject {i + 1}>" for i in speakers)
            silent = [i for i in present if i not in speakers]
            talk = (f"{lines} Only {only} speak{'s' if len(speakers) == 1 else ''}"
                    + (f"; {' and '.join(f'<Subject {i + 1}>' for i in silent)} stay{'s' if len(silent) == 1 else ''} silent." if silent else "."))
        else:
            talk = "No words, no dialogue."
        cam = _sentence(s.get("camera"))
        if cam and not cam.lower().startswith(("the camera", "camera")):
            cam = "The camera: " + cam[0].lower() + cam[1:]
        shot = " ".join(x for x in (_sentence(b.get("style")), count, action, talk, cam, _sentence(b.get("camera"))) if x)
        sound = _sentence(b.get("sound"))
        sound += (" No speech except the lines written in this scene." if speakers else " No speech, no words at all.")
        prompt = ("subject_definitions:\n" + "\n".join(defs) + "\n"
                  + "The photos give identity only, not expression. Each person appears only once, never twice.\n"
                  + ((b.get("decor") or "").strip() + "\n" if use_decor else "")
                  + "\nintegrated_multimodal_description:\n[Shot 1] " + shot
                  + "\n\noverall_soundscape: " + sound.strip()
                  + "\nnon_diegetic_music: " + ((b.get("music") or "").strip() or "N/A"))
        try:
            dur = max(1.0, min(15.0, float(s.get("duration") or 5.0)))
        except (TypeError, ValueError):
            dur = 5.0
        prompts.append(prompt)
        durations.append(dur)
        index.append(si)
        infos.append({"scene": sn, "pictures": sorted(set(pics)), "voices": auds, "people": [i + 1 for i in present],
                      "duration": dur})
    if not prompts:
        warnings.append("No active scene: turn at least one scene ON.")
    return {"prompts": prompts, "durations": durations, "scene_index": index, "warnings": warnings, "scenes": infos}


def signature(prompts):
    payload = json.dumps(list(prompts), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


class H3DirectorBoard:
    @classmethod
    def INPUT_TYPES(cls):
        opt = {}
        for i in range(1, N_PEOPLE + 1):
            opt[f"person_{i}"] = ("IMAGE", {"tooltip": f"Photo of person {i} = <Picture {i}>"})
        opt["decor"] = ("IMAGE", {"tooltip": "Photo of the empty place = <Picture 5>"})
        for i in range(1, N_PEOPLE + 1):
            opt[f"extra_{i}"] = ("IMAGE", {"tooltip": f"Extra ref of person {i} (body / face / sheet vignette) = <Picture {i + 5}>"})
        for i in range(1, N_VOICES + 1):
            opt[f"voice_{i}"] = ("AUDIO", {"tooltip": f"Voice of person {i} = <Audio {i}> (sent only to the scenes where person {i} speaks)"})
        return {
            "required": {"board_json": ("STRING", {"multiline": True, "default": json.dumps(default_board(), ensure_ascii=False)})},
            "optional": opt,
        }

    RETURN_TYPES = ("H3_REF_PACK", "H3_PROMPT_PACK", "AUDIO", "AUDIO", "AUDIO", "STRING", "INT")
    RETURN_NAMES = ("ref_pack", "prompt_pack", "audio_1", "audio_2", "audio_3", "prompts_preview", "scene_count")
    FUNCTION = "build"
    CATEGORY = "MiniMax H3"
    DESCRIPTION = ("Director board for the MiniMax H3 Extender: cast, scenes, presence and voices per scene, prompts "
                   "written for you. Each clip gets only its own photos and voices.")

    def build(self, board_json, **kw):
        try:
            board = json.loads(board_json or "{}")
        except Exception as exc:
            raise ValueError(f"H3 Director Board: board_json is not valid JSON ({exc})")
        images = [kw.get(f"person_{i}") for i in range(1, N_PEOPLE + 1)] + [kw.get("decor")] + \
                 [kw.get(f"extra_{i}") for i in range(1, N_PEOPLE + 1)]
        voices = [kw.get(f"voice_{i}") for i in range(1, N_VOICES + 1)]
        res = compose(board, {"images": [x is not None for x in images], "voices": [x is not None for x in voices]})
        if not res["prompts"]:
            raise ValueError("H3 Director Board: no active scene.")
        for w in res["warnings"]:
            print(f"[H3 Director Board] warning: {w}")
        ref_pack = {"type": "H3_REF_PACK", "version": 1, "source": SOURCE,
                    "count": sum(x is not None for x in images), "slots": images}
        prompt_pack = {"type": "H3_PROMPT_PACK", "version": 1, "source": SOURCE, "count": len(res["prompts"]),
                       "prompts": res["prompts"], "signature": signature(res["prompts"]),
                       "durations": res["durations"], "routing": res["scenes"]}
        preview = "\n\n".join(f"===== SCENE {info['scene']} ({info['duration']:g} s) pictures {info['pictures']} "
                              f"voices {info['voices']} =====\n{p}" for p, info in zip(res["prompts"], res["scenes"]))
        if res["warnings"]:
            preview = "WARNINGS:\n- " + "\n- ".join(res["warnings"]) + "\n\n" + preview
        return (ref_pack, prompt_pack, voices[0], voices[1], voices[2], preview, len(res["prompts"]))
