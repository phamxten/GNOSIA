# GNOSIA — one image: FastAPI serves the API, the WebSocket and the built React app on port 8000.
# Node.js is included at runtime because learner code runs in the Node sandbox (backend/runner/sandbox.mjs).

# ---- 1. build the frontend ---------------------------------------------------------
FROM node:24-bookworm-slim AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. runtime -----------------------------------------------------------------------
FROM python:3.13-slim-bookworm AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Node runtime for the code sandbox (same version the frontend was built with)
COPY --from=web /usr/local/bin/node /usr/local/bin/node
RUN apt-get update \
 && apt-get install -y --no-install-recommends libstdc++6 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && node --version

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=web /src/frontend/dist /app/frontend/dist

# run as an unprivileged user
RUN useradd --create-home --uid 10001 gnosia && chown -R gnosia /app
USER gnosia

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"

# Create tables and seed the demo data on first start (skipped when the database already has data), then serve.
CMD ["sh", "-c", "python -m app.seed && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
