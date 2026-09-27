"""GNOSIA API. In production it also serves the built frontend (frontend/dist) with an SPA fallback."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import Base, engine
from .routers import admin, auth, learner, mentor, player, workspace
from .services.runner import RunnerUnavailable

Base.metadata.create_all(engine)

app = FastAPI(title="GNOSIA API", version="1.0.0")

for r in (auth.router, learner.router, player.router, player.ws_router, workspace.router, mentor.router, admin.router):
    app.include_router(r)


@app.exception_handler(RunnerUnavailable)
def _runner_down(_: Request, exc: RunnerUnavailable) -> JSONResponse:
    return JSONResponse({"detail": {"code": "runner", "message": str(exc)}}, status_code=503)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


dist = settings.frontend_dist
if dist.exists():
    if (dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "ws/")):
            raise HTTPException(404)
        f = (dist / full_path).resolve()
        if full_path and f.is_file() and dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(dist / "index.html")
