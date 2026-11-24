"""ComfyUI-H3DirectorBoard: a director dashboard for the MiniMax H3 Extender.

- node "H3 Director Board": cast (4 people), up to 12 scenes, presence / voice / line / position per person and scene,
  prompts written for H3, live preview, warnings.
- routing_patch: the Extender gives each clip only the photos and voices of its own scene (board packs only).
"""
import json
import logging

from .board import H3DirectorBoard, compose, default_board
from . import routing_patch

_LOG = logging.getLogger("H3DirectorBoard")

routing_patch.install()

try:
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/h3board/compose")
    async def _compose(request):
        try:
            data = await request.json()
            res = compose(data.get("board") or {}, data.get("connected") or None)
            return web.json_response(res)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3board/loras")
    async def _loras(request):
        import folder_paths
        return web.json_response(folder_paths.get_filename_list("loras"))

    @PromptServer.instance.routes.get("/h3board/default")
    async def _default(request):
        return web.json_response(default_board())
except Exception as exc:  # pragma: no cover
    _LOG.warning("H3 Director Board: routes not installed (%s)", exc)

NODE_CLASS_MAPPINGS = {"H3DirectorBoard": H3DirectorBoard}
NODE_DISPLAY_NAME_MAPPINGS = {"H3DirectorBoard": "🎬 H3 Director Board"}
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
