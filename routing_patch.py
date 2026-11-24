"""Per-clip routing for the MiniMax H3 Extender, active ONLY when its prompt_pack comes from the H3 Director Board.

Stock Extender behaviour (extender.py, read 2026-11-24):
  - every image of the Reference Pack goes into every clip (no per-clip selection);
  - voices: one connected voice goes into every clip; with several, a clip gets the <Audio n> written in its prompt,
    and a clip with no tag gets the FIRST connected voice (silent scenes mumble with someone's voice);
  - card durations come from the cards only.
With a board pack:
  - a clip receives only the pictures <Picture n> written in its own prompt;
  - a clip receives only the voices <Audio n> written in its own prompt (none if none);
  - the duration of each NOT validated card is set from the board.
Other workflows (no board pack) are untouched.
"""
from __future__ import annotations

import contextvars
import json
import logging
import re
import sys

from .board import SOURCE

_LOG = logging.getLogger("H3DirectorBoard")
_BOARD = contextvars.ContextVar("h3_director_board_pack", default=None)
_PIC = re.compile(r"<Picture\s+(\d+)>", re.IGNORECASE)
_AUD = re.compile(r"<Audio\s+(\d+)>", re.IGNORECASE)
_PATCHED = False


def _is_board(pack):
    return isinstance(pack, dict) and pack.get("source") == SOURCE


def patch():
    global _PATCHED
    if _PATCHED:
        return True
    try:
        import nodes
        cls = nodes.NODE_CLASS_MAPPINGS.get("MiniMaxH3Extender")
    except Exception:
        cls = None
    if cls is None:
        return False
    mod = sys.modules.get(cls.__module__)
    need = ("_select_standalone_audio_refs_for_prompt", "_make_ref2va_conditioning", "_sync_clips_from_prompt_pack")
    if mod is None or not all(hasattr(mod, n) for n in need):
        _LOG.warning("H3 Director Board: Extender internals changed, per-clip routing disabled (%s)",
                     [n for n in need if not hasattr(mod, n)])
        _PATCHED = True
        return True

    orig_select = mod._select_standalone_audio_refs_for_prompt
    orig_cond = mod._make_ref2va_conditioning
    orig_sync = mod._sync_clips_from_prompt_pack

    def select(prompt, ref_audios):
        if _BOARD.get() is None:
            return orig_select(prompt, ref_audios)
        audios = list(ref_audios or [])
        referenced = {int(m.group(1)) for m in _AUD.finditer(str(prompt or ""))}
        slots = sorted(s for s, a in enumerate(audios, start=1) if a is not None and s in referenced)
        return [a if s in slots else None for s, a in enumerate(audios, start=1)], slots

    def cond(clip, vae, prompt, width, height, frame_count, ref_items, ref_blocks, active_picture_slots,
             active_video_slots, *a, **k):
        if _BOARD.get() is not None and active_picture_slots:
            referenced = {int(m.group(1)) for m in _PIC.finditer(str(prompt or ""))}
            n = len(active_picture_slots)
            keep = [j for j, s in enumerate(active_picture_slots) if int(s) in referenced]
            if keep and len(keep) < n:
                items, blocks = list(ref_items or []), list(ref_blocks or [])
                ref_items = [items[j] for j in keep] + items[n:]
                ref_blocks = [blocks[j] for j in keep] + blocks[n:]
                dropped = [s for j, s in enumerate(active_picture_slots) if j not in keep]
                active_picture_slots = [active_picture_slots[j] for j in keep]
                _LOG.info("H3 Director Board: clip uses Pictures %s, not sent: %s", active_picture_slots, dropped)
        return orig_cond(clip, vae, prompt, width, height, frame_count, ref_items, ref_blocks, active_picture_slots,
                         active_video_slots, *a, **k)

    def sync(clips, pack, stored_signature=""):
        res = orig_sync(clips, pack, stored_signature)
        board = _BOARD.get()
        if board is not None:
            try:
                synced = res[0]
                for c, d in zip(synced, board.get("durations") or []):
                    if isinstance(c, dict) and not c.get("validated") and float(c.get("duration") or 0) != float(d):
                        c["duration"] = float(d)
            except Exception as exc:
                _LOG.warning("H3 Director Board: durations not applied (%s)", exc)
        return res

    mod._select_standalone_audio_refs_for_prompt = select
    mod._make_ref2va_conditioning = cond
    mod._sync_clips_from_prompt_pack = sync

    original = getattr(cls, cls.FUNCTION)

    def extend(self, *args, **kwargs):
        pack = kwargs.get("prompt_pack")
        if not _is_board(pack):
            return original(self, *args, **kwargs)
        token = _BOARD.set(pack)
        try:
            cj = kwargs.get("clips_json")
            if isinstance(cj, str):   # cards that already exist: durations from the board (not validated cards)
                try:
                    d = json.loads(cj)
                    for c, dur in zip(d.get("clips") or [], pack.get("durations") or []):
                        if isinstance(c, dict) and not c.get("validated"):
                            c["duration"] = float(dur)
                    kwargs["clips_json"] = json.dumps(d, ensure_ascii=False)
                except Exception:
                    pass
            _LOG.info("H3 Director Board: per-clip routing ON (%d scenes)", len(pack.get("prompts") or []))
            return original(self, *args, **kwargs)
        finally:
            _BOARD.reset(token)

    extend.__wrapped__ = original
    setattr(cls, cls.FUNCTION, extend)
    _PATCHED = True
    _LOG.info("H3 Director Board: MiniMaxH3Extender patched (per-clip pictures / voices / durations)")
    return True


def install():
    if patch():
        return
    try:
        from server import PromptServer

        def on_prompt(json_data):
            patch()
            return json_data

        PromptServer.instance.add_on_prompt_handler(on_prompt)
    except Exception as exc:
        _LOG.warning("H3 Director Board: cannot install routing (%s)", exc)
