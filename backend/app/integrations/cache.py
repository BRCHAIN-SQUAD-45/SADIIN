"""Cache em memória com TTL e "single-flight" por chave.

- Duas requisições pedindo a mesma chave ao mesmo tempo fazem UM download: a segunda
  espera a primeira terminar e reaproveita o resultado.
- O lock é por chave, então chaves diferentes (outras UBS, outras cidades) não se bloqueiam.
- Exceções não são guardadas: a próxima chamada tenta de novo.

Vale por processo do uvicorn. Para vários workers/instâncias, o próximo passo é o PostgreSQL
ou um Redis, como previsto na arquitetura.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: float, max_entries: int = 2048):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._values: dict[Hashable, tuple[float, T]] = {}
        self._locks: dict[Hashable, asyncio.Lock] = {}

    def _fresh(self, key: Hashable) -> tuple[bool, T | None]:
        entry = self._values.get(key)
        if entry and entry[0] > time.monotonic():
            return True, entry[1]
        return False, None

    async def get_or_load(self, key: Hashable, loader: Callable[[], Awaitable[T]]) -> T:
        hit, value = self._fresh(key)
        if hit:
            return value  # type: ignore[return-value]

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            hit, value = self._fresh(key)
            if hit:
                return value  # type: ignore[return-value]
            value = await loader()
            if len(self._values) >= self.max_entries:
                self._evict()
            self._values[key] = (time.monotonic() + self.ttl_seconds, value)
            return value

    def _evict(self) -> None:
        now = time.monotonic()
        for key in [k for k, (expires, _) in self._values.items() if expires <= now]:
            self._values.pop(key, None)
            self._locks.pop(key, None)
        # Ainda cheio: descarta os mais antigos (inseridos primeiro).
        while len(self._values) >= self.max_entries:
            oldest = next(iter(self._values))
            self._values.pop(oldest, None)
            self._locks.pop(oldest, None)

    def clear(self) -> None:
        self._values.clear()
        self._locks.clear()
