"""Open Journal Systems (OJS) federation.

Phase 2 of sof.ai's OJS integration: a real, self-hosted OJS 3.x instance
runs alongside sof.ai (e.g. at https://ojs.sof.ai). Every mutating operation
on a sof.ai ``Journal`` / ``JournalArticle`` / ``JournalPeerReview`` /
``JournalIssue`` is mirrored asynchronously to OJS via its REST API so
sof.ai-native entities gain real-world scholarly-publishing infrastructure
(DOIs, submission management, reviewer assignment, issue publishing) for
free.

The mirror is **fire-and-forget** — OJS going down never blocks a sof.ai
write. Each row records its ``ojs_synced_at`` / ``ojs_sync_error`` state
so the admin ``POST /journals/_resync`` endpoint can retry the pending
rows on demand.

The feature is **gated**: if either ``OJS_BASE_URL`` or ``OJS_API_TOKEN``
is unset, every mirror function becomes a cheap no-op. CI, local dev, and
production before deploy stay unaffected.
"""

from .adapter import (
    mirror_article,
    mirror_issue,
    mirror_journal,
    mirror_review,
    resync_pending,
)
from .client import OJSClient, OJSError
from .settings import ojs_enabled, ojs_settings

__all__ = [
    "OJSClient",
    "OJSError",
    "mirror_article",
    "mirror_issue",
    "mirror_journal",
    "mirror_review",
    "ojs_enabled",
    "ojs_settings",
    "resync_pending",
]
