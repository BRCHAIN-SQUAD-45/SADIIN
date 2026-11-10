import asyncio
import time
import unicodedata

import httpx

from app.integrations.ibge import IbgeConector

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_MIN_INTERVAL_SECONDS = 1.0
REVERSE_CACHE_TTL_SECONDS = 15 * 60
_request_lock = asyncio.Lock()
_next_request_at = 0.0
_reverse_cache: dict[tuple[float, float], tuple[float, dict[str, str]]] = {}


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    unaccented = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return " ".join(unaccented.casefold().split())


async def _reverse_lookup(lat: float, lng: float) -> dict:
    global _next_request_at
    async with _request_lock:
        wait_seconds = _next_request_at - time.monotonic()
        if wait_seconds > 0:
            await asyncio.sleep(wait_seconds)
        async with httpx.AsyncClient(
            timeout=10.0,
            headers={
                "Accept": "application/json",
                "User-Agent": "SADIIN/1.0 (Brazilian public health information portal)",
            },
        ) as client:
            response = await client.get(
                NOMINATIM_URL,
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "zoom": 10,
                },
            )
            response.raise_for_status()
            _next_request_at = time.monotonic() + NOMINATIM_MIN_INTERVAL_SECONDS
            payload = response.json()
    address = payload.get("address") if isinstance(payload, dict) else None
    if not isinstance(address, dict):
        raise ValueError("A geocodificação não retornou o município da localização.")
    return address


async def municipio_por_coordenadas(lat: float, lng: float) -> dict[str, str]:
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise ValueError("Coordenadas GPS inválidas.")

    cache_key = (round(lat, 3), round(lng, 3))
    now = time.monotonic()
    cached = _reverse_cache.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]

    address = await _reverse_lookup(lat, lng)
    state_name = address.get("state")
    if not state_name:
        raise ValueError("A geocodificação não identificou o estado.")

    async with IbgeConector() as ibge:
        states = await ibge.listar_estados()
        state = next(
            (item for item in states if _normalize(item["name"]) == _normalize(state_name)),
            None,
        )
        if state is None:
            raise ValueError("O estado retornado pela geocodificação não existe no IBGE.")
        cities = await ibge.listar_municipios(state["uf"])

    place_names = [
        address[key]
        for key in ("city", "town", "village", "municipality", "county")
        if isinstance(address.get(key), str) and address[key].strip()
    ]
    normalized_names = {_normalize(name) for name in place_names}
    city = next(
        (item for item in cities if _normalize(item["name"]) in normalized_names),
        None,
    )
    if city is None and len(cities) == 1:
        city = cities[0]
    if city is None:
        raise ValueError("Não foi possível associar o GPS a um município IBGE.")

    _reverse_cache[cache_key] = (now + REVERSE_CACHE_TTL_SECONDS, city)
    return city