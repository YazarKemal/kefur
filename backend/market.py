import asyncio
import time
from collections import deque
from typing import Optional

import httpx

BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price"
SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
ASSET_MAP = {s: s.replace("USDT", "") for s in SYMBOLS}
ASSETS = list(ASSET_MAP.values())

# ── Currency: Turkish Lira (TRY) ─────────────────────────────────────────────
USD_TRY_RATE = 33.5  # Simulated USD/TRY exchange rate


def usd_to_try(usd_amount: float) -> float:
    """Convert a USD amount to TRY."""
    return round(usd_amount * USD_TRY_RATE, 2)


_last_valid_prices: dict[str, float] = {}
_last_fetch_ts: float = 0.0
_CACHE_TTL = 10  # seconds — reuse cached prices within this window

# ── Price History Buffer (last 14 periods for technical indicators) ─────────
_MAX_HISTORY = 14
_price_history: dict[str, deque[float]] = {a: deque(maxlen=_MAX_HISTORY) for a in ASSETS}


def get_cached_prices() -> dict[str, float]:
    """Return last known good prices (non-blocking, for UI endpoints)."""
    return dict(_last_valid_prices)


def get_price_history() -> dict[str, list[float]]:
    """Return the price history buffer for all assets."""
    return {a: list(_price_history[a]) for a in ASSETS}


def _update_price_history(prices: dict[str, float]):
    """Append latest prices to the rolling history buffer."""
    for asset in ASSETS:
        if asset in prices and prices[asset] > 0:
            _price_history[asset].append(prices[asset])


# ── Technical Indicators ────────────────────────────────────────────────────

def calc_sma(asset: str, period: int = 14) -> Optional[float]:
    """Simple Moving Average over *period* entries."""
    prices = list(_price_history.get(asset, []))
    if len(prices) < period:
        return None
    return round(sum(prices[-period:]) / period, 2)


def calc_rsi(asset: str, period: int = 14) -> Optional[float]:
    """Relative Strength Index (14-period, Wilder's smoothing approximation)."""
    prices = list(_price_history.get(asset, []))
    if len(prices) < period + 1:
        return None

    window = prices[-(period + 1):]
    gains = 0.0
    losses = 0.0
    for i in range(1, len(window)):
        delta = window[i] - window[i - 1]
        if delta > 0:
            gains += delta
        else:
            losses += abs(delta)

    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 1)


def calc_trend(asset: str) -> str:
    """Derive a simple trend label from SMA cross of short (7) vs long (14)."""
    sma_short = calc_sma(asset, 7)
    sma_long = calc_sma(asset, 14)
    if sma_short is None or sma_long is None:
        return "INSUFFICIENT_DATA"
    if sma_short > sma_long * 1.005:
        return "UPTREND"
    if sma_short < sma_long * 0.995:
        return "DOWNTREND"
    return "SIDEWAYS"


def calc_volatility(asset: str, period: int = 14) -> float:
    """Normalized volatility (%) — average absolute period-over-period change.
    Uses the rolling price history buffer. Returns 0.0 if insufficient data."""
    prices = list(_price_history.get(asset, []))
    if len(prices) < 3:
        return 0.0
    changes: list[float] = []
    for i in range(1, len(prices)):
        if prices[i - 1] > 0:
            pct = abs(prices[i] - prices[i - 1]) / prices[i - 1] * 100
            changes.append(pct)
    if not changes:
        return 0.0
    window = changes[-period:]
    return round(sum(window) / len(window), 3)


def get_market_volatility() -> dict[str, float]:
    """Return normalized volatility (%) for all tracked assets."""
    return {a: calc_volatility(a) for a in ASSETS}


def get_market_analysis() -> dict:
    """Aggregate prices + indicators into a single market report."""
    prices = get_cached_prices()
    indicators = {}
    for asset in ASSETS:
        indicators[asset] = {
            "price": prices.get(asset, 0),
            "sma_7": calc_sma(asset, 7),
            "sma_14": calc_sma(asset, 14),
            "rsi": calc_rsi(asset),
            "trend": calc_trend(asset),
            "volatility": calc_volatility(asset),
        }
    return {
        "prices": prices,
        "indicators": indicators,
        "history_depth": min(len(_price_history[a]) for a in ASSETS),
        "fetched_at": time.time(),
    }


# ── Binance Price Fetching ──────────────────────────────────────────────────

async def _fetch_one(client: httpx.AsyncClient, symbol: str) -> Optional[tuple[str, float]]:
    try:
        resp = await client.get(BINANCE_TICKER_URL, params={"symbol": symbol})
        resp.raise_for_status()
        data = resp.json()
        return (ASSET_MAP[symbol], float(data["price"]))
    except Exception:
        return None


async def fetch_prices(force: bool = False) -> dict[str, float]:
    """Fetch live prices from Binance in parallel. Updates history buffer."""
    global _last_valid_prices, _last_fetch_ts

    now = time.monotonic()
    if not force and _last_valid_prices and (now - _last_fetch_ts) < _CACHE_TTL:
        return dict(_last_valid_prices)

    async with httpx.AsyncClient(timeout=10) as client:
        results = await asyncio.gather(*[_fetch_one(client, sym) for sym in SYMBOLS])

    prices: dict[str, float] = {}
    for result in results:
        if result is not None:
            asset, price = result
            prices[asset] = price

    # Convert fresh USD prices to TRY FIRST (before any cache fallback)
    try_prices: dict[str, float] = {a: usd_to_try(p) for a, p in prices.items()}

    # Fill any missing assets from last valid cache (already in TL — no re-conversion)
    for asset in ASSETS:
        cached = _last_valid_prices.get(asset, 0.0)
        if try_prices.get(asset, 0.0) <= 0 and cached > 0:
            try_prices[asset] = cached

    if try_prices:
        _last_valid_prices = dict(try_prices)
        _last_fetch_ts = now
        _update_price_history(try_prices)

    return try_prices
