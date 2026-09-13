from collections import defaultdict, deque
from threading import Lock
from time import monotonic


class InMemoryRateLimiter:
    """Small per-process limiter suitable for the local Phase 2 deployment."""

    def __init__(self, requests: int, window_seconds: int):
        self.requests = requests
        self.window_seconds = window_seconds
        self._values: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = monotonic()
        boundary = now - self.window_seconds
        with self._lock:
            values = self._values[key]
            while values and values[0] <= boundary:
                values.popleft()
            if len(values) >= self.requests:
                return False
            values.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._values.clear()
