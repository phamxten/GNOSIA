"""Create the PostgreSQL role and databases described in backend/.env.

    python scripts/setup_postgres.py

Reads GNOSIA_DATABASE_URL (role, password, database) and GNOSIA_PG_SUPERUSER_PASSWORD,
connects as the `postgres` superuser, and creates the role plus `<db>` and `<db>_test`.
Safe to run again: existing objects are kept and the role password is updated.
"""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

ENV = Path(__file__).resolve().parent.parent / ".env"


def read_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def main() -> int:
    env = read_env()
    url = make_url(env["GNOSIA_DATABASE_URL"])
    if not url.drivername.startswith("postgresql"):
        print("GNOSIA_DATABASE_URL bukan PostgreSQL; tidak ada yang perlu disiapkan.")
        return 0
    su_pw = env.get("GNOSIA_PG_SUPERUSER_PASSWORD", "")
    host, port = url.host or "localhost", url.port or 5432
    with psycopg.connect(host=host, port=port, user="postgres", password=su_pw, dbname="postgres", autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (url.username,)).fetchone()
        verb = sql.SQL("ALTER") if exists else sql.SQL("CREATE")
        conn.execute(sql.SQL("{} ROLE {} LOGIN PASSWORD {}").format(verb, sql.Identifier(url.username), sql.Literal(url.password)))
        for db in (url.database, f"{url.database}_test"):
            if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db,)).fetchone():
                conn.execute(sql.SQL("CREATE DATABASE {} OWNER {} ENCODING 'UTF8' TEMPLATE template0").format(sql.Identifier(db), sql.Identifier(url.username)))
                print(f"database {db} dibuat")
            else:
                print(f"database {db} sudah ada")
    print(f"role {url.username} siap di {host}:{port}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
