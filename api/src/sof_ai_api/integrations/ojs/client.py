"""Thin httpx wrapper around the OJS 3.x REST API.

OJS exposes a small, consistent REST surface:

*  ``POST /api/v1/contexts``                          create a journal
*  ``POST /<context>/api/v1/submissions``             submit an article
*  ``POST /<context>/api/v1/submissions/{id}/publication``  metadata
*  ``POST /<context>/api/v1/reviewAssignments``       assign a reviewer
*  ``POST /<context>/api/v1/issues``                  create issue
*  ``POST /<context>/api/v1/issues/{id}/publish``     publish issue

Full reference: https://docs.pkp.sfu.ca/dev/api/ojs/3.3/

Auth: every mutating call requires ``?apiToken=<token>``. The API token is
minted once inside OJS admin — see ``ojs-host/README.md`` for the recipe.

This client is deliberately minimal. It is not a full OJS SDK — it only
covers the flows the sof.ai adapter actually needs. Adding a new field?
Add it to the payload builder in ``adapter.py``, not here.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

from .settings import OJSSettings, ojs_settings


class OJSError(Exception):
    """Raised when an OJS call fails. The caller in adapter.py catches this
    and records ``ojs_sync_error`` on the row so /journals/_resync can
    retry later without losing context."""

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        body: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.body = body

    def __str__(self) -> str:
        base = super().__str__()
        if self.status is not None:
            return f"{base} (status={self.status})"
        return base


class OJSClient:
    """Synchronous HTTP client for OJS 3.x.

    We stay sync because the sof.ai code base is sync SQLModel; the mirror
    runs inside a FastAPI ``BackgroundTasks`` worker which already isolates
    the call from the request path. Going async here would buy nothing and
    would tangle two execution models.
    """

    def __init__(self, settings: Optional[OJSSettings] = None) -> None:
        self._settings = settings or ojs_settings()
        if not self._settings.base_url or not self._settings.api_token:
            raise OJSError(
                "OJSClient requires OJS_BASE_URL and OJS_API_TOKEN to be set."
            )

    # ---- low-level ----------------------------------------------------------

    def _url(self, path: str) -> str:
        base = (self._settings.base_url or "").rstrip("/")
        return f"{base}{path}"

    def _params(self, extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        params: dict[str, Any] = {"apiToken": self._settings.api_token}
        if extra:
            params.update(extra)
        return params

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        try:
            resp = httpx.request(
                method,
                self._url(path),
                params=self._params(params),
                json=json,
                timeout=self._settings.timeout_s,
            )
        except httpx.HTTPError as exc:
            raise OJSError(f"OJS HTTP transport error: {exc}") from exc

        if resp.status_code >= 400:
            raise OJSError(
                f"OJS {method} {path} failed",
                status=resp.status_code,
                body=resp.text[:500],
            )
        if not resp.content:
            return {}
        try:
            return resp.json()
        except ValueError as exc:
            raise OJSError(
                f"OJS {method} {path} returned non-JSON", body=resp.text[:500]
            ) from exc

    # ---- domain calls -------------------------------------------------------

    def create_context(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create an OJS context (a journal). Returns the OJS response
        including the new context's id + urlPath.

        OJS routes site-wide (non-context-scoped) API calls through the
        synthetic ``/index`` path; hitting ``/api/v1/contexts`` directly
        collides with Apache's handling of the ``api/`` subdirectory and
        bypasses the framework bootstrap (500). ``/index/api/v1/...`` always
        goes through the main ``index.php`` and reaches the router.
        """
        return self._request("POST", "/index/api/v1/contexts", json=payload)

    def list_contexts(self) -> dict[str, Any]:
        """List all OJS contexts. Mainly used by the adapter to map an
        existing context path back to its numeric id during resync."""
        return self._request("GET", "/index/api/v1/contexts")

    def create_submission(
        self, context_path: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Create a submission inside a given context.

        OJS 3.4 rejects any POST body that tries to set ``submissionProgress``
        (that field is managed by the workflow, not the caller), and requires
        ``sectionId`` + ``locale``. The POST returns a near-empty submission;
        title/abstract/authors are set on the child publication via
        ``update_publication``.
        """
        return self._request(
            "POST", f"/{context_path}/api/v1/submissions", json=payload
        )

    def update_publication(
        self,
        context_path: str,
        submission_id: int,
        publication_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """PUT metadata onto a publication.

        OJS submissions are two-phase: ``POST /submissions`` creates an empty
        submission with one child publication (id returned in the response),
        then ``PUT /submissions/{sid}/publications/{pid}`` sets everything the
        reader actually cares about — title, abstract, keywords, etc.
        """
        return self._request(
            "PUT",
            f"/{context_path}/api/v1/submissions/"
            f"{submission_id}/publications/{publication_id}",
            json=payload,
        )

    def create_review_assignment(
        self, context_path: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/{context_path}/api/v1/reviewAssignments",
            json=payload,
        )

    def create_issue(
        self, context_path: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._request(
            "POST", f"/{context_path}/api/v1/issues", json=payload
        )

    def publish_issue(
        self, context_path: str, issue_id: int
    ) -> dict[str, Any]:
        return self._request(
            "PUT",
            f"/{context_path}/api/v1/issues/{issue_id}/publish",
        )
