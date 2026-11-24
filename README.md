# 🎬 ComfyUI-H3DirectorBoard

A director dashboard for the [MiniMax H3 Extender](https://github.com/tritant) (multi-clip H3 videos).

One node, **🎬 H3 Director Board**, replaces the dozens of text nodes, booleans, switches and concatenations
a multi-person / multi-scene H3 graph needs.

## What you get
- **Cast** (4 people): name, kind (woman / man…), look & outfit, colour. Photo thumbnails and a ▶ button for the
  voice come straight from the loaders wired into the node.
- **Scenes** (up to 12): ON/OFF, duration, decor on/off, action text, camera move (presets or free text),
  reorder / duplicate / delete.
- **Per person and per scene**: ✔ in the scene (photo sent), 🎙 speaks (voice sent) + the line, position
  (left / center / right / background…), + extra ref (full body / face).
- **LoRAs per scene** (up to 4): pick the file, strength, trigger word(s) and a label once, then tick them scene by scene
  (e.g. a combat LoRA only in the fight scenes). The board writes them on the Extender clip cards (model-only, that
  clip only) and adds the trigger at the start of the shot.
- **Write names, not tags**: "Nico sits at the table, Alex looks at the screen" becomes `<Subject 2> … <Subject 1>`.
- **Prompts written for H3**: `subject_definitions` (only the people of the scene), `[Shot 1]` with
  "Exactly N people in the frame", positions, action, lines (`<Subject n> says in French: "…"`), "No words, no
  dialogue" when nobody talks, camera; `overall_soundscape`, `non_diegetic_music`.
- **Live preview** of every prompt, a timeline, and warnings (photo / voice not wired, person 4 voice, empty scene…).

## Per-clip routing (the real fix)
Stock Extender behaviour: every Reference Pack image goes into every clip, one wired voice goes into every clip,
and a clip with no `<Audio n>` tag gets the first wired voice (silent scenes mumble, absent people appear).
When the Extender's `prompt_pack` comes from the board, this pack patches it so that:
- a clip receives only the `<Picture n>` written in its own prompt,
- a clip receives only the `<Audio n>` written in its own prompt (none if nobody speaks),
- each not-validated card takes its duration and its LoRA stack from the board.
Graphs without the board are untouched.

## Wiring
```
LoadImage ×4 (people) ─┐
LoadImage (decor) ─────┤                      ┌─ ref_pack ──────► MiniMax H3 Extender
LoadImage ×4 (extra) ──┼──► 🎬 H3 Director ───┼─ prompt_pack ───►
LoadAudio ×3 (voices) ─┘        Board         ├─ audio_1..3 ────► ref_audio_1..3
                                              └─ prompts_preview ► Preview as Text
```
Picture 1-4 = people, 5 = decor, 6-9 = extra ref of person 1-4. The Extender reads 3 voice slots only.

Restart ComfyUI after installing (Python routes + Extender patch).

MIT.
