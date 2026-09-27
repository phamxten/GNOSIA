import os
import sys
import tempfile
from pathlib import Path

import pytest

# A throwaway database per test session, seeded with the demo curriculum and class.
# Set GNOSIA_TEST_DATABASE_URL to run the suite against PostgreSQL (the database is reset!).
_tmp = Path(tempfile.mkdtemp(prefix="gnosia-test-"))
os.environ["GNOSIA_DATABASE_URL"] = os.environ.get("GNOSIA_TEST_DATABASE_URL") or f"sqlite:///{(_tmp / 'test.db').as_posix()}"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed.seed import run as seed_run  # noqa: E402

seed_run(reset=True)

PASSWORD = "gnosia123"


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def login(c: TestClient, email: str) -> None:
    r = c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text


@pytest.fixture()
def db():
    from app.db import SessionLocal
    s = SessionLocal()
    yield s
    s.close()
