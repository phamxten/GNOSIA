"""Seed the database with the curriculum, demo accounts and a realistic class history.

    python -m app.seed            # create tables + seed (refuses if data exists)
    python -m app.seed --reset    # drop everything and seed again
"""
from __future__ import annotations

import sys

from .seed import run

if __name__ == "__main__":
    run(reset="--reset" in sys.argv)
