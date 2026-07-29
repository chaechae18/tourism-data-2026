from collections import OrderedDict, deque
from threading import Lock
from time import monotonic
from typing import Any


class TTLCache:
    def __init__(self, max_entries: int = 500) -> None:
        self.max_entries = max_entries
        self._items: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = Lock()

    def get(self, key: str) -> Any | None:
        now = monotonic()
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            expires_at, value = item
            if expires_at <= now:
                self._items.pop(key, None)
                return None
            self._items.move_to_end(key)
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        with self._lock:
            self._items[key] = (monotonic() + ttl_seconds, value)
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._requests: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(
        self,
        key: str,
        *,
        limit: int,
        window_seconds: int,
    ) -> int | None:
        now = monotonic()
        window_start = now - window_seconds
        with self._lock:
            requests = self._requests.setdefault(key, deque())
            while requests and requests[0] <= window_start:
                requests.popleft()
            if len(requests) >= limit:
                return max(1, int(requests[0] + window_seconds - now) + 1)
            requests.append(now)
            return None

    def clear(self) -> None:
        with self._lock:
            self._requests.clear()
