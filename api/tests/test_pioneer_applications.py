"""Tests for the School of Freedom Pioneer-application routes.

Coverage:
  * Public POST persists with sane defaults + status "pending"
  * Slug shape is validated server-side (rejects uppercase / underscores)
  * Email/slug uniqueness is enforced (409 on collision, distinct messages)
  * Public reads (by-slug, /approved) only surface approved Pioneers
  * Admin GET (list + detail) requires no header in test env
    (internal-auth disabled when settings.internal_api_key is empty,
    same gating as the existing applications suite)
  * PATCH status="approved" upserts a UserProfile row keyed on email
  * Re-approving an existing email no-ops the upsert (no duplicate row)
"""

from fastapi.testclient import TestClient
from sqlmodel import select

from sof_ai_api.db import get_session, init_db
from sof_ai_api.main import app
from sof_ai_api.models import UserProfile
from sof_ai_api.routes import pioneer_applications as mod

init_db()
client = TestClient(app)


def _submit(
    full_name: str = "Ada Lovelace",
    email: str = "ada@example.com",
    slug: str = "ada",
    pathway: str = "ai",
) -> dict:
    body = {
        "full_name": full_name,
        "email": email,
        "slug": slug,
        "pathway": pathway,
        "mission_statement": "I want to teach machines to dream.",
        "personal_statement": (
            "I built my first calculating engine at thirteen. "
            "I'm here to apply that obsession to autonomous learning."
        ),
        "identity_tags": ["Builder", "Researcher"],
    }
    r = client.post("/pioneer-applications", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _patch(application_id: int, **kwargs) -> dict:
    r = client.patch(f"/pioneer-applications/{application_id}", json=kwargs)
    assert r.status_code == 200, r.text
    return r.json()


def test_submit_persists_with_pending_status_and_canonical_email_slug():
    out = _submit(full_name="Grace Hopper", email="GRACE@Example.COM ", slug="GRACE-h")
    assert out["status"] == "pending"
    assert out["email"] == "grace@example.com"
    assert out["slug"] == "grace-h"
    assert out["identity_tags"] == ["Builder", "Researcher"]
    assert out["reviewed_at"] is None


def test_submit_rejects_invalid_slug_shape():
    body = {
        "full_name": "Bad Slug",
        "email": "bad@example.com",
        "slug": "Bad Slug!",
        "pathway": "ai",
        "mission_statement": "x" * 12,
        "personal_statement": "y" * 30,
        "identity_tags": [],
    }
    r = client.post("/pioneer-applications", json=body)
    # Server-side validator returns 422 with the specific message.
    assert r.status_code in (400, 422), r.text


def test_submit_rejects_duplicate_slug_with_distinct_message():
    _submit(full_name="First", email="first@example.com", slug="claimed-slug")
    body = {
        "full_name": "Second",
        "email": "second@example.com",
        "slug": "claimed-slug",
        "pathway": "vr",
        "mission_statement": "I want this slug too.",
        "personal_statement": "z" * 30,
        "identity_tags": [],
    }
    r = client.post("/pioneer-applications", json=body)
    assert r.status_code == 409, r.text
    assert "slug" in r.json()["detail"].lower()


def test_submit_rejects_duplicate_email_with_distinct_message():
    _submit(full_name="First", email="dupe@example.com", slug="dupe-1")
    body = {
        "full_name": "Same Person Different Slug",
        "email": "dupe@example.com",
        "slug": "dupe-2",
        "pathway": "vr",
        "mission_statement": "Testing email collision.",
        "personal_statement": "z" * 30,
        "identity_tags": [],
    }
    r = client.post("/pioneer-applications", json=body)
    assert r.status_code == 409, r.text
    assert "email" in r.json()["detail"].lower()


def test_by_slug_only_returns_approved_pioneers():
    submitted = _submit(full_name="Pending Penny", email="penny@example.com", slug="penny")
    # While pending, by-slug 404s
    r = client.get(f"/pioneer-applications/by-slug/{submitted['slug']}")
    assert r.status_code == 404
    # Approve and re-fetch
    _patch(submitted["id"], status="approved", reviewed_by_email="freedom@thevrschool.org")
    r = client.get(f"/pioneer-applications/by-slug/{submitted['slug']}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["full_name"] == "Pending Penny"
    assert body["slug"] == "penny"
    # Public projection MUST NOT leak the email or review fields
    assert "email" not in body
    assert "review_note" not in body


def test_approved_directory_lists_only_approved():
    a = _submit(full_name="Approved A", email="appra@example.com", slug="appra")
    _submit(full_name="Pending B", email="pendb@example.com", slug="pendb")
    _patch(a["id"], status="approved")

    r = client.get("/pioneer-applications/approved")
    assert r.status_code == 200, r.text
    slugs = [row["slug"] for row in r.json()]
    assert "appra" in slugs
    assert "pendb" not in slugs


def test_approve_upserts_user_profile_keyed_on_email():
    submitted = _submit(
        full_name="Linus Torvalds",
        email="linus-pioneer@example.com",
        slug="linus-pioneer",
    )
    assert submitted["status"] == "pending"

    _patch(submitted["id"], status="approved", reviewed_by_email="freedom@thevrschool.org")

    with next(get_session()) as s:
        profile = s.exec(
            select(UserProfile).where(UserProfile.email == "linus-pioneer@example.com")
        ).first()
    assert profile is not None
    assert profile.handle == "linus-pioneer"
    assert profile.display_name == "Linus Torvalds"
    assert profile.user_type == "student"  # ai pathway → student


def test_re_approving_does_not_duplicate_user_profile():
    submitted = _submit(
        full_name="Idempotency Ivy",
        email="ivy@example.com",
        slug="ivy",
    )
    _patch(submitted["id"], status="approved")
    # PATCH again with the same status — the upsert helper should no-op
    # (the status flip is gated on the *transition*, not the resulting state).
    _patch(submitted["id"], status="approved", review_note="updated note")

    with next(get_session()) as s:
        rows = s.exec(
            select(UserProfile).where(UserProfile.email == "ivy@example.com")
        ).all()
    assert len(rows) == 1


def test_approve_recovers_when_upsert_raises_non_integrity_error(monkeypatch):
    """Regression for Devin Review #BUG_..._0001 (PR #50 follow-up).

    If `_upsert_user_profile` raises a non-IntegrityError commit failure
    (OperationalError, lost connection, etc.) the PATCH route must
    rollback the session, recover, and still return 200 with the
    persisted application — the status flip itself was committed before
    the upsert, so a 500 here would mislead the admin into thinking
    nothing was saved when in reality the row is already approved.
    """
    submitted = _submit(
        full_name="Recovery R",
        email="recovery@example.com",
        slug="recovery",
    )

    def _exploding_upsert(*_args, **_kwargs):
        raise RuntimeError("simulated transient db failure")

    monkeypatch.setattr(mod, "_upsert_user_profile", _exploding_upsert)

    r = client.patch(
        f"/pioneer-applications/{submitted['id']}",
        json={"status": "approved"},
    )
    # The status flip itself succeeded; the upsert failure is recovered
    # by the PATCH handler. No 500.
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved"
    assert body["slug"] == "recovery"


def test_admin_list_filter_by_status():
    _submit(full_name="Status A", email="sa@example.com", slug="sa")
    sb = _submit(full_name="Status B", email="sb@example.com", slug="sb")
    _patch(sb["id"], status="approved")

    r = client.get("/pioneer-applications?status=pending")
    assert r.status_code == 200, r.text
    statuses = {row["status"] for row in r.json()}
    assert statuses <= {"pending"}
