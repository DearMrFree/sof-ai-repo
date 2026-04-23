"""Test-suite-wide fixtures.

This file must set DATABASE_URL *before* any test module triggers an import
of sof_ai_api.settings / sof_ai_api.db. Pytest loads conftest.py files before
collecting test modules, so this is the earliest hook available.

Without this, pytest collects test_health.py first (alphabetical order) and
its top-level `from sof_ai_api.main import app` import binds the db engine
to the default URL — any later `os.environ["DATABASE_URL"] = ...` set inside
test modules is a no-op because the settings singleton and engine are
already cached.
"""

import os
import tempfile

# Point the API at a throwaway sqlite file for the entire test session so
# tests never write to the developer's ./sof_ai.db.
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mktemp(suffix='.db')}",
)
