"""OJS federation settings — env-gated so the feature is dark by default.

Set both ``OJS_BASE_URL`` (e.g. ``https://ojs.sof.ai``) and ``OJS_API_TOKEN``
(generated inside OJS admin → Users → Edit → API Key) to turn the mirror
on. With either one missing, every ``mirror_*`` call is a cheap no-op.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class OJSSettings:
    base_url: Optional[str]
    api_token: Optional[str]
    # Timeout for every OJS HTTP call (seconds). OJS can be slow on first
    # request after a wake-up; keep this generous but not unbounded.
    timeout_s: float
    # If True, mirror failures raise (useful in tests). In production we
    # swallow them so a flaky OJS doesn't block a sof.ai write.
    strict: bool


def ojs_settings() -> OJSSettings:
    """Read settings from the environment at call time.

    Intentionally *not* cached — tests monkey-patch env vars per case, and
    the cost of reading four os.environ lookups is nothing.
    """
    return OJSSettings(
        base_url=os.environ.get("OJS_BASE_URL") or None,
        api_token=os.environ.get("OJS_API_TOKEN") or None,
        timeout_s=float(os.environ.get("OJS_TIMEOUT_S") or "10"),
        strict=(os.environ.get("OJS_STRICT") or "").lower() in ("1", "true", "yes"),
    )


def ojs_enabled() -> bool:
    """True iff both the OJS URL and API token are configured."""
    s = ojs_settings()
    return bool(s.base_url and s.api_token)
