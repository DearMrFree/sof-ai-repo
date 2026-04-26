"""In-process pub/sub broker for new-signup SSE events.

Backs ``GET /users/admin/stream``. Each subscriber gets its own
``asyncio.Queue``; ``publish()`` fans out a copy of the event to every
live subscriber. Single-process only (FastAPI on Fly runs N machines but
SSE connections are sticky to one machine for their lifetime, so each
admin client just sees the events from the machine they're connected to
— good enough for live ops with low signup volume).

For higher throughput / multi-machine fanout we'd swap this for Redis
pub/sub or a managed bus, but that's overkill at our current scale.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from typing import Any, AsyncIterator


class _Broker:
    """Tiny fanout queue. Thread/event-loop safe via asyncio.Queue locks."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=64)
        async with self._lock:
            self._subscribers.add(q)
            # Capture the running loop the first time someone subscribes
            # so sync request handlers (which run on a worker thread) can
            # publish back to us via ``run_coroutine_threadsafe``.
            if self._loop is None:
                self._loop = asyncio.get_running_loop()
        return q

    @property
    def loop(self) -> asyncio.AbstractEventLoop | None:
        return self._loop

    async def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        async with self._lock:
            self._subscribers.discard(q)

    async def publish(self, event_name: str, payload: dict[str, Any]) -> None:
        """Fan-out to every live subscriber.

        Drops the event for any subscriber whose queue is full — that
        means the client isn't reading fast enough; missed events are
        recoverable from the seed endpoint on reconnect.
        """

        frame = _format_sse(event_name, payload)
        async with self._lock:
            targets = list(self._subscribers)
        for q in targets:
            try:
                q.put_nowait(frame)
            except asyncio.QueueFull:
                continue

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


def _format_sse(event_name: str, payload: dict[str, Any]) -> str:
    """Render a single SSE frame.

    Keeps the output to a single ``data:`` line (JSON-encoded) so the
    browser ``EventSource`` parses cleanly regardless of newlines in
    user-supplied fields. Events end with a blank line per the spec.
    """

    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return f"event: {event_name}\ndata: {body}\n\n"


broker = _Broker()


def publish_signup_threadsafe(
    loop: asyncio.AbstractEventLoop | None,
    event_name: str,
    payload: dict[str, Any],
) -> None:
    """Schedule ``broker.publish()`` from a sync context.

    The onboarding upsert handler is a sync def (SQLModel + ``Session``
    is sync). To publish from there we need to hop onto the running
    event loop. ``asyncio.run_coroutine_threadsafe`` is the canonical
    bridge, but FastAPI's request handlers are invoked in a worker
    thread so we have to grab the loop reference from the caller.
    """

    if loop is None or not loop.is_running():
        return
    coro = broker.publish(event_name, payload)
    try:
        asyncio.run_coroutine_threadsafe(coro, loop)
    except RuntimeError:
        # Loop is closing — nothing we can do, the event is dropped.
        pass


async def heartbeats(interval_seconds: float = 15.0) -> AsyncIterator[str]:
    """Generate keep-alive comments every ``interval_seconds``.

    Vercel/Cloudflare/etc. close idle connections after ~30s. Comments
    (lines starting with ``:``) are valid SSE and not surfaced as
    events to ``EventSource``, so they're a clean keep-alive.
    """

    while True:
        await asyncio.sleep(interval_seconds)
        yield ":hb\n\n"


@contextlib.asynccontextmanager
async def subscription() -> AsyncIterator[asyncio.Queue[str]]:
    """Context manager so the queue is always unsubscribed on disconnect."""

    q = await broker.subscribe()
    try:
        yield q
    finally:
        await broker.unsubscribe(q)
