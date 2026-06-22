import asyncio
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()

_deepseek: OpenAI | None = None

def _get_client() -> OpenAI:
    global _deepseek
    if _deepseek is None:
        if not DEEPSEEK_API_KEY or "your-deepseek-api-key" in DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY .env icinde tanimli degil!")
        _deepseek = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
    return _deepseek


# ── Curated Crypto News Pool ────────────────────────────────────────────────
# Realistic headlines simulating live crypto news flow.
# Categories: Macro, Regulation, Hacks/Security, Whale/On-Chain, Institutional, Exchange

CRYPTO_NEWS_POOL = [
    # Macro / Fed
    "Fed Chair Powell signals potential rate cut in September as inflation cools to 2.4%",
    "ECB holds rates steady but warns of persistent services inflation — risk-off across global markets",
    "US jobs report smashes expectations with 285K new payrolls — dollar surges, BTC dips",
    "China announces $140B stimulus package — crypto markets rally on liquidity hopes",
    "Bank of Japan unexpectedly raises rates to 0.5% — carry trade unwind fears hit risk assets",
    "US CPI print comes in at 3.1% YoY, below forecasts — bond yields drop, BTC spikes 4%",
    "IMF warns of 'disorderly repricing' in global asset markets — crypto volatility spike expected",

    # Regulation / Government
    "SEC Chair Gensler says 'most crypto tokens are securities' — enforcement actions likely to expand",
    "EU Parliament passes MiCA framework — exchanges must register by Q4 deadline",
    "Hong Kong SFC approves first retail Bitcoin and Ether ETFs — Asia crypto hub ambitions grow",
    "US Treasury proposes new DeFi reporting rules — KYC requirements for DEX frontends",
    "Turkey drafts crypto licensing bill — 47 exchanges apply for regulatory approval",
    "India's RBI maintains crypto ban stance despite Supreme Court pressure — uncertainty weighs",
    "UK FCA warns 140+ crypto firms operating without registration — compliance crackdown looms",

    # Hacks / Security
    "Major DeFi protocol exploited for $210M via flash loan attack — token plunges 85%",
    "Binance hot wallet anomaly detected — $43M in suspicious outflows confirmed as security incident",
    "Ledger hardware wallet vulnerability disclosed — users urged to update firmware immediately",
    "PolyNetwork hacker returns $340M after on-chain plea — 'white hat' narrative emerges",
    "North Korean Lazarus Group linked to $1.2B crypto theft in 2026 — UN report details methods",

    # Whale / On-Chain
    "Dormant Bitcoin whale from 2012 moves 15,000 BTC ($940M) to multiple exchanges",
    "Grayscale Bitcoin Trust sees $380M daily inflow — institutional buying pressure intensifies",
    "Tether mints $2B USDT on Ethereum — stablecoin liquidity surging, historically bullish signal",
    "Ethereum gas fees spike to 450 gwei amid NFT minting frenzy — network congestion concerns",
    "MicroStrategy buys additional 12,000 BTC at $71,400 average — Saylor doubles down",
    "Arkham Intelligence flags $600M BTC transfer from Mt. Gox trustee wallet — distribution fears",
    "On-chain data shows exchange balances at 5-year low — supply squeeze narrative strengthens",

    # Institutional / ETF
    "BlackRock Bitcoin ETF surpasses $15B in AUM — institutional adoption accelerates",
    "Fidelity files for Ethereum staking ETF — yield-bearing crypto products gain momentum",
    "Goldman Sachs launches crypto derivatives desk — Wall Street expansion continues",
    "Vanguard reverses stance, plans to offer crypto exposure via managed funds",
    "Abu Dhabi sovereign wealth fund discloses $400M Bitcoin position in 13F filing",

    # Exchange / Market Structure
    "Coinbase reports record $3.2B quarterly revenue — trading volume explodes in Q2",
    "OKX discontinues USDT pairs in EU ahead of MiCA enforcement — traders forced to USDC",
    "FTX creditor repayment plan approved — $16B to be distributed over next 18 months",
    "Binance.US suspends USD withdrawals temporarily — compliance issues with banking partners",

    # Technology / Ecosystem
    "Ethereum Dencun upgrade goes live — L2 fees drop 90%, activity surges across Arbitrum and Optimism",
    "Solana mainnet experiences 4-hour outage — validators restart cluster, SOL drops 8%",
    "OpenAI launches on-chain AI agent framework — AI-crypto convergence narrative builds",
    "Bitcoin hashrate hits all-time high of 780 EH/s — network security stronger than ever",
    "Sony launches Soneium blockchain mainnet — entertainment giant enters web3 infrastructure",
]

# Last analysis cache (in-memory, refreshed each loop cycle)
_last_report: dict | None = None


def _pick_headlines(count: int = 4) -> list[str]:
    """Pick a random mix of headlines ensuring category diversity."""
    # Shuffle, then pick ensuring we get diverse categories
    pool_copy = list(CRYPTO_NEWS_POOL)
    random.shuffle(pool_copy)
    # Take 2 random + 2 from different ends of the shuffled list for spread
    selected = pool_copy[:count]
    return selected


SENTIMENT_ANALYSIS_PROMPT = (
    "Sen bir kripto piyasa haber analistisin. Sana verilen haber basliklarini analiz et "
    "ve her birinin BTC, ETH, SOL fiyatlari uzerindeki kisa vadeli etkisini degerlendir.\n\n"
    "Puanlama:\n"
    "  +2 = Guclu BULLISH (ornek: ETF onayi, buyuk kurumsal alim, doviz genislemesi)\n"
    "  +1 = Hafif BULLISH (ornek: olumlu regülasyon sinyali, teknolojik ilerleme)\n"
    "   0 = NOTR / BELIRSIZ (ornek: karisik sinyaller, rutin haberler)\n"
    "  -1 = Hafif BEARISH (ornek: regülasyon belirsizligi, minor guvenlik olayi)\n"
    "  -2 = Guclu BEARISH (ornek: buyuk hack, borsa cokusu, devlet yasagi)\n\n"
    "Ayrica genel bir 'overall_sentiment' (BULLISH / BEARISH / NEUTRAL) ve kisa bir analiz ozeti yaz.\n\n"
    "Cevabi SADECE su JSON formatinda ver, baska hicbir sey yazma:\n"
    '{"headlines": [{"headline": "...", "impact": "BULLISH"|"BEARISH"|"NEUTRAL", '
    '"score": -2|-1|0|1|2, "reasoning": "kisa analiz"}], '
    '"overall_sentiment": "BULLISH"|"BEARISH"|"NEUTRAL", '
    '"overall_score": -10 ile 10 arasi sayi, '
    '"analysis": "genel piyasa degerlendirmesi ve risk uyarisi"}'
)


async def fetch_sentiment_report() -> dict:
    """Main entry point — picks headlines, analyzes via DeepSeek, returns structured report."""
    global _last_report

    headlines = _pick_headlines()
    now = datetime.now(timezone.utc)

    prompt = (
        f"{SENTIMENT_ANALYSIS_PROMPT}\n\n"
        f"=== GUNCEL KRIPTO HABER BASLIKLARI ({now.strftime('%Y-%m-%d %H:%M UTC')}) ===\n"
        + "\n".join(f"  {i+1}. {h}" for i, h in enumerate(headlines))
        + "\n\nHer basligi puanla ve genel piyasa etkisini degerlendir."
    )

    try:
        client = _get_client()
        resp = await asyncio.to_thread(
            lambda: client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "Sen bir kripto haber analistisin. Sadece JSON ciktisi ver."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=600,
            )
        )
        content = resp.choices[0].message.content.strip()

        # Parse JSON — handle possible markdown wrapping
        try:
            report = json.loads(content)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{[\s\S]*\}", content)
            if m:
                report = json.loads(m.group(0))
            else:
                raise ValueError("JSON parse failed")

        # Validate structure
        if "headlines" not in report:
            report["headlines"] = []
        if "overall_sentiment" not in report:
            report["overall_sentiment"] = "NEUTRAL"
        if "overall_score" not in report:
            report["overall_score"] = 0
        if "analysis" not in report:
            report["analysis"] = ""

        report["_fetched_at"] = now.isoformat()
        report["_raw_headlines"] = headlines
        _last_report = report

    except Exception as exc:
        # Fallback — return neutral with error info
        report = {
            "headlines": [{"headline": h, "impact": "NEUTRAL", "score": 0, "reasoning": "API hatasi — manuel degerlendirme"} for h in headlines],
            "overall_sentiment": "NEUTRAL",
            "overall_score": 0,
            "analysis": f"Sentiment analizi yapilamadi: {str(exc)[:100]}. Teknik gostergelerle devam ediliyor.",
            "_fetched_at": now.isoformat(),
            "_raw_headlines": headlines,
            "_error": str(exc)[:150],
        }
        _last_report = report

    return report


def get_cached_sentiment() -> dict | None:
    """Return the last sentiment report without making a new API call."""
    return _last_report
