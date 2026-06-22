import asyncio
import json
import os
import re
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

from market import fetch_prices, get_cached_prices, get_market_analysis, get_market_volatility
from portfolio import (
    AGENT_IDS,
    AGENT_NAMES,
    ASSETS,
    add_diary_note,
    calc_total_value,
    check_risk_rules,
    execute_buy,
    execute_sell,
    get_recent_diary,
    load_portfolio,
    refresh_uptime,
    save_portfolio,
    update_pnl,
)
from sentiment_analyzer import fetch_sentiment_report, get_cached_sentiment
from wallet_manager import NETWORKS, NETWORK_IDS, select_optimal_network, get_gas_fee, wallet_summary
from report_manager import generate_obsidian_report

# ── .env ──────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()

if not DEEPSEEK_API_KEY or "your-deepseek-api-key" in DEEPSEEK_API_KEY:
    raise RuntimeError("DEEPSEEK_API_KEY .env icinde tanimli degil!")

deepseek = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

LOOP_INTERVAL = 60  # seconds
_last_prices: dict[str, float] = {}

# ── Agent Personas ────────────────────────────────────────────────────────

CEO_PERSONA = (
    "Sen KeFur AI Trading CEO'susun. Stratejik makro piyasa analizi senin sorumlulugun. "
    "3 isci ajani yonetirsin: Nexus (HFT Scalper), Oracle (Swing Trader), Sentinel (Arbitrage Hunter).\n\n"
    "Gorevin:\n"
    "1. Canli fiyatlari, RSI, SMA ve trend verilerini analiz et\n"
    "2. GUNCEL KRIPTO HABERLERINI ve duyarlilik skorlarini degerlendir (en kritik gorev!)\n"
    "3. Teknik gostergeler + haber duyarliligini BIRLESTIREREK piyasa yonunu belirle\n"
    "4. Risk seviyesini (LOW / MEDIUM / HIGH) degerlendir\n"
    "5. Hangi isci ajanlarin bu turda islem yapmasi gerektigine karar ver\n"
    "6. Isci ajanlara kisa bir makro rehberlik notu yaz\n\n"
    "HABER DUYARLILIGI KARAR KURALLARI (Teknik gostergelerden DAHA ONCELIKLI):\n"
    "- Eger overall_score < -3 (guclu ayi haberi: buyuk hack, borsa cokusu, devlet yasagi) → RSI ne derse desin risk HIGH, tum agresif ajanlari durdur, sadece Sentinel kalsin\n"
    "- Eger overall_score > +3 (guclu boga haberi: ETF onayi, kurumsal alim, genisleme) → teknik ayi sinyali olsa bile riski LOW yapma, MEDIUM'da tut ama ajanlari aktif et\n"
    "- Hack / guvenlik ihlali haberi varsa → aninda risk HIGH\n"
    "- Regulasyon belirsizligi varsa (overall_score -3 ile 0 arasi) → risk MEDIUM, temkinli ol\n"
    "- Haberler ile teknik gostergeler zit yondeyse → HABERLERI daha agir tart (%60 haber, %40 teknik)\n\n"
    "Teknik karar prensipleri:\n"
    "- RSI > 70 (asiri alim) veya RSI < 30 (asiri satim) varsa risk HIGH, sadece Sentinel aktif\n"
    "- Trendler karisiksa (biri UP, digeri DOWN) risk MEDIUM, Oracle + Sentinel aktif\n"
    "- Tum asset'ler ayni yonde trend yapiyorsa risk LOW, tum ajanlar aktif\n"
    "- Piyasa tamamen yataysa (tum RSI'lar 45-55 arasi) NEUTRAL, sadece Nexus kucuk scalp\n"
    "- Genel kural: Supheli durumda az ajanla devam et, gereksiz islemden kacin\n\n"
    "Cevabi SADECE su JSON formatinda ver, baska hicbir sey yazma:\n"
    '{"market_sentiment": "BULLISH"|"BEARISH"|"NEUTRAL", '
    '"risk_level": "LOW"|"MEDIUM"|"HIGH", '
    '"trend_summary": "kisa ozet", '
    '"active_agents": ["nexus", "oracle", "sentinel"], '
    '"macro_guidance": "isci ajanlara stratejik yonlendirme (haber etkisini mutlaka belirt)", '
    '"reasoning": "CEO analiz detayi"}'
)

WORKER_PERSONAS = {
    "nexus": (
        "Sen Nexus'sun — High Frequency Scalper. Ultra kisa zaman dilimlerinde "
        "BTC, ETH ve SOL uzerinde momentum scalping yaparsin. Order book dengesizliklerini "
        "ve mikro yapi analizini kullanirsin. Seans basina 40-60 islem acarsin. "
        "Hizli karar ver, kucuk ama sik karlar hedefle. Risk toleransin yuksek. "
        "Anlik fiyat hareketlerine gore agresif al-sat yap.\n\n"
        "AG SECIMI VE GAS OPTIMIZASYONU: Cok sik islem yaptigin icin gas ucretleri senin icin KRITIK. "
        "Kucuk bütceli islemlerini (< ₺200) MUTLAKA Arbitrum veya Osmosis uzerinde ac. "
        "Ethereum'da sadece ₺500+ islemleri ac ki gas maliyeti (%1'in altinda) mantikli olsun. "
        "Her islemde gas ucretini (₺0.02 - ₺5.00) hesaba kat, kucuk islemleri gas ile zarar ettirme."
    ),
    "oracle": (
        "Sen Oracle'sin — Swing Trader. Cok gunluk pozisyon dalgalanmalarini "
        "on-chain balina cuzdan takibi, sosyal duygu NLP'si ve makro trend korelasyonu "
        "ile yakalarsin. Haftada 5-8 islem yaparsin. 3:1 risk/odul orani hedeflersin. "
        "Sabirli ve stratejiksin. Trend donuslerini yakalamaya calis.\n\n"
        "AG SECIMI VE GAS OPTIMIZASYONU: Haftada az islem yaptigin icin gas maliyeti senin icin daha az kritik. "
        "Ancak buyuk pozisyonlarini (₺1000+) guvenlik icin Ethereum'da, "
        "orta ve kucuk pozisyonlarini Arbitrum'da ac. Gas'i portfoy yuzdene gore optimize et."
    ),
    "sentinel": (
        "Sen Sentinel'sin — Arbitrage Hunter. Cross-exchange ve cross-pair ucgen "
        "arbitraj firsatlarini tararsin. 12 DEX ve CEX emir defterini ayni anda izlersin. "
        "Ortalama islem gecikmen 340ms. %0.3-1.2 spread hedeflersin. "
        "Dusuk risk, yuksek kesinlik. Arbitraj firsati yoksa bekle, zorlama.\n\n"
        "AG SECIMI VE GAS OPTIMIZASYONU: Arbitraj marjlari dar oldugu icin gas maliyetin SPREAD'I GECMEMELI. "
        "HER ZAMAN en dusuk gasli agi (Osmosis ₺0.02 veya Arbitrum ₺0.10) sec. "
        "Ethreum'da arbitraj yapma — ₺5 gas, %0.3'luk spread'i tamamen siler. "
        "Islem karari verirken ag secimini ve gas maliyetini mutlaka 'reason' alaninda belirt."
    ),
}


# ── JSON Parser ───────────────────────────────────────────────────────────

def _parse_decision(raw: str) -> dict:
    """Extract a trading decision JSON from the LLM response."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    m = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass

    return {"action": "HOLD", "asset": "BTC", "percentage": 0, "reason": "parse error"}


# ── CEO Analysis ──────────────────────────────────────────────────────────

async def get_ceo_analysis(market: dict, portfolio: dict, sentiment: dict | None = None) -> dict:
    """Ask DeepSeek CEO for macro market analysis and worker activation plan.
    Now incorporates live news sentiment analysis for informed decisions."""
    indicators = market.get("indicators", {})
    prices = market.get("prices", {})

    # Build a compact portfolio summary for the CEO
    agent_summaries = []
    for aid in AGENT_IDS:
        ag = portfolio["agents"][aid]
        tv = calc_total_value(ag, prices)
        positions_str = ", ".join(
            f"{a}: {ag['positions'].get(a, 0):.4f}" for a in ASSETS
        )
        agent_summaries.append(
            f"  {ag['name']} ({aid}): Cash=₺{ag['cash']:,.2f}, "
            f"TotalValue=₺{tv:,.2f}, PnL=%{ag['pnl_percent']}, "
            f"Trades={ag['total_trades']}, WinRate=%{ag['win_rate']}, "
            f"Positions=[{positions_str}]"
        )

    indicator_lines = []
    for asset, ind in indicators.items():
        rsi = ind.get("rsi", "N/A")
        trend = ind.get("trend", "N/A")
        sma7 = ind.get("sma_7", "N/A")
        sma14 = ind.get("sma_14", "N/A")
        price = ind.get("price", 0)
        indicator_lines.append(
            f"  {asset}: ₺{price:,.2f} | RSI={rsi} | Trend={trend} | SMA7={sma7} | SMA14={sma14}"
        )

    # Build news sentiment block for CEO
    sentiment_block = ""
    if sentiment and sentiment.get("headlines"):
        hl_lines = []
        for h in sentiment["headlines"]:
            score_emoji = "🟢" if h["score"] > 0 else ("🔴" if h["score"] < 0 else "⚪")
            hl_lines.append(
                f"  {score_emoji} [{h['impact']}] Score={h['score']:+d} | {h['headline']}\n"
                f"     Analiz: {h['reasoning'][:120]}"
            )
        sentiment_block = (
            "=== SON DAKIKA KRIPTO HABERLERI VE DUYARLILIK ANALIZI ===\n"
            f"Genel Duyarlilik: {sentiment.get('overall_sentiment', 'NEUTRAL')} "
            f"(Skor: {sentiment.get('overall_score', 0):+d})\n"
            f"Analiz Ozeti: {sentiment.get('analysis', '')}\n\n"
            + "\n".join(hl_lines) + "\n\n"
            "!!! DIKKAT: Yukaridaki haberleri KARAR PENCERENIN EN ONEMLI PARCASI OLARAK DEGERLENDIR.\n"
            "Teknik gostergelerle haber duyarliligi zit yondeyse, HABERLERE daha fazla agirlik ver (%60).\n\n"
        )

    prompt = (
        f"{CEO_PERSONA}\n\n"
        f"{sentiment_block}"
        f"=== GUNCEL PIYASA VERILERI ===\n"
        f"{chr(10).join(indicator_lines)}\n\n"
        f"=== PORTOY DURUMU ===\n"
        f"{chr(10).join(agent_summaries)}\n\n"
        f"=== TALIMAT ===\n"
        f"Piyasa verilerini, haber duyarliligini ve portfoy durumunu birlestirerek analiz et. "
        f"Kararini JSON olarak ver."
    )

    try:
        resp = await asyncio.to_thread(
            lambda: deepseek.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "Sen bir kripto trading CEO AI'sisin. Sadece JSON ciktisi ver."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=500,
            )
        )
        content = resp.choices[0].message.content.strip()
        ceo_decision = _parse_decision(content)
        ceo_decision["_raw"] = content[:300]
    except Exception as exc:
        ceo_decision = {
            "market_sentiment": "NEUTRAL",
            "risk_level": "MEDIUM",
            "trend_summary": f"CEO API hatasi: {str(exc)[:80]}",
            "active_agents": AGENT_IDS,
            "macro_guidance": "CEO devre disi - tum ajanlar serbest modda",
            "reasoning": "Fallback due to API error",
            "_raw": str(exc)[:200],
        }

    # Ensure active_agents is a list of valid agent IDs
    active = ceo_decision.get("active_agents", AGENT_IDS)
    if not isinstance(active, list):
        active = AGENT_IDS
    active = [a for a in active if a in AGENT_IDS]
    if not active:
        active = AGENT_IDS
    ceo_decision["active_agents"] = active

    return ceo_decision


# ── Worker Agent Decision ─────────────────────────────────────────────────

async def get_worker_decision(
    agent_id: str, prices: dict[str, float], agent: dict, ceo_context: dict
) -> dict:
    """Ask DeepSeek for a trading decision for a single worker agent, with CEO guidance."""
    persona = WORKER_PERSONAS.get(agent_id, "Sen bir kripto trading AI ajanisin.")
    tv = calc_total_value(agent, prices)

    guidance = ceo_context.get("macro_guidance", "")
    sentiment = ceo_context.get("market_sentiment", "NEUTRAL")
    risk = ceo_context.get("risk_level", "MEDIUM")

    # Build self-reflection memory from last 3 diary entries
    recent_notes = get_recent_diary(agent, count=3)
    memory_block = ""
    if recent_notes:
        lines = []
        for i, entry in enumerate(recent_notes, 1):
            success = entry.get("success", False)
            status = "KAZANC" if success else "ZARAR"
            pnl_usd = entry.get("pnl_usd") or 0.0
            pnl_pct = entry.get("pnl_percent") or 0.0
            price = entry.get("price") or 0.0
            trigger = entry.get("trigger") or "MANUAL"
            pair = entry.get("pair") or ""
            side = entry.get("side") or ""
            reason_text = (entry.get("reason") or "")[:150]
            pnl_str = f"+₺{pnl_usd:,.2f}" if pnl_usd >= 0 else f"-₺{abs(pnl_usd):,.2f}"
            lines.append(
                f"  {i}. [{status}] [{trigger}] {pair} {side} "
                f"@ ₺{price:,.2f} — PnL: {pnl_str} (%{pnl_pct})\n"
                f"     Sebep: {reason_text}"
            )
        memory_block = (
            "=== GECMIS HAFIZA (Son 3 Isleminin Ozeti) ===\n"
            + "\n".join(lines) + "\n\n"
            "ONEMLI TALIMAT: Mevcut karari vermeden once gecmisteki son 3 islemini analiz et. "
            "Eger benzer piyasa kosullarinda hata yapip zarar ettiysen, ayni hatayi "
            "tekrarlamamak icin stratejini otonom olarak revize et. "
            "Ozellikle stop-loss ile sonuclanan islemlerin sebeplerini dikkate al.\n\n"
        )

    prompt = (
        f"{persona}\n\n"
        f"=== CEO MAKRO REHBERLIGI ===\n"
        f"Piyasa: {sentiment} | Risk Seviyesi: {risk}\n"
        f"CEO diyor ki: {guidance}\n\n"
        f"{memory_block}"
        f"=== GUNCEL FIYATLAR ===\n"
        f"  BTC/USDT: ₺{prices.get('BTC', 0):,.2f}\n"
        f"  ETH/USDT: ₺{prices.get('ETH', 0):,.2f}\n"
        f"  SOL/USDT: ₺{prices.get('SOL', 0):,.2f}\n\n"
        f"=== PORTOY DURUMUN ===\n"
        f"  Nakit: ₺{(agent.get('cash') or 0):,.2f}\n"
        f"  Toplam deger: ₺{(tv or 0):,.2f}\n"
        f"  Baslangic bakiyesi: ₺{(agent.get('managed_balance') or 0):,.2f}\n"
        f"  PnL: %{(agent.get('pnl_percent') or 0)}\n"
        f"  Pozisyonlar: {json.dumps({a: round(agent['positions'].get(a, 0) or 0, 6) for a in ASSETS})}\n"
        f"  Toplam islem: {(agent.get('total_trades') or 0)}, Kazanma: %{(agent.get('win_rate') or 0)}\n\n"
        f"CEO'nun stratejik yonlendirmesini dikkate alarak su aksiyonlardan birini sec:\n"
        f"  BUY  — belirttigin asset'i nakdin belli yuzdesiyle satin al\n"
        f"  SELL — elindeki asset'in belli yuzdesini sat\n"
        f"  HOLD — bekle, pozisyon acma/kapatma\n\n"
        f"Cevabi SADECE su JSON formatinda ver, baska hicbir sey yazma:\n"
        f'{{"action": "BUY"|"SELL"|"HOLD", "asset": "BTC"|"ETH"|"SOL", "percentage": 1-100, "reason": "kisa aciklama"}}'
    )

    try:
        resp = await asyncio.to_thread(
            lambda: deepseek.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "Sen bir kripto trading AI ajanisin. Sadece JSON ciktisi ver."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=300,
            )
        )
        content = resp.choices[0].message.content.strip()
        decision = _parse_decision(content)
        decision["_raw"] = content[:200]
        return decision
    except Exception as exc:
        return {"action": "HOLD", "asset": "BTC", "percentage": 0, "reason": str(exc)[:100]}


# ── Self-Reflection / Self-Criticism ────────────────────────────────────────

SELF_CRITICISM_PROMPT = (
    "Sen bir kripto trading AI ajanisin. Az once bir islemin STOP-LOSS ile kapandi ve zarar ettin.\n\n"
    "Lutfen su sorulari durustce cevapla:\n"
    "1. Bu islemde neden zarar ettin? Piyasayi nerede yanlis okudun?\n"
    "2. Hangi gostergeleri veya sinyalleri goz ardi ettin?\n"
    "3. Bir sonraki islemde bu hatayi nasil duzelteceksin? Hangi kurallari ekleyeceksin?\n\n"
    "Cevabini kisa, oz ve uygulanabilir bir oz-elestiri olarak yaz (max 200 kelime)."
)


async def get_self_criticism(agent_id: str, agent_name: str, diary_entry: dict) -> str:
    """Request self-criticism from an agent after a stop-loss.
    The agent reflects on why it lost money and how to avoid the same mistake."""
    persona = WORKER_PERSONAS.get(agent_id, "Sen bir kripto trading AI ajanisin.")

    pnl_usd = diary_entry.get("pnl_usd") or 0.0
    pnl_pct = diary_entry.get("pnl_percent") or 0.0
    price = diary_entry.get("price") or 0.0
    quantity = diary_entry.get("quantity") or 0
    pair = diary_entry.get("pair") or ""
    side = diary_entry.get("side") or ""
    trigger = diary_entry.get("trigger") or "MANUAL"
    reason_text = (diary_entry.get("reason") or "")[:200]

    prompt = (
        f"{persona}\n\n"
        f"{SELF_CRITICISM_PROMPT}\n\n"
        f"=== ZARAR EDEN ISLEM DETAYLARI ===\n"
        f"  Islem: {pair} {side}\n"
        f"  Miktar: {quantity} adet @ ₺{price:,.2f}\n"
        f"  Zarar: ₺{abs(pnl_usd):,.2f} (%{pnl_pct})\n"
        f"  Tetikleyici: {trigger}\n"
        f"  Islem sebebi: {reason_text}\n\n"
        f"Lutfen yukaridaki sorulari cevaplayan oz-elestiri raporunu yaz:"
    )

    try:
        resp = await asyncio.to_thread(
            lambda: deepseek.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "Sen durust ve oz-elestiri yapabilen bir AI trading ajanisin."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=400,
            )
        )
        criticism = resp.choices[0].message.content.strip()
    except Exception as exc:
        criticism = f"Oz-elestiri API hatasi: {str(exc)[:150]}"

    print(f"\n  [OZ-ELESTIRI] {agent_name} ({agent_id}):")
    for line in criticism.split("\n"):
        print(f"    {line}")

    return criticism


# ── Dynamic Position Sizing Engine ──────────────────────────────────────────

def calc_position_cap(risk_level: str, market_vol: float, sentiment_score: int) -> tuple[float, str]:
    """Determine max position-size multiplier based on risk, volatility, and news sentiment.

    Returns (multiplier, reason_string).
    multiplier 0.25 = agent can use at most 25% of its normal max budget.
    """
    cap = 1.0
    reasons: list[str] = []

    # ── 1. CEO Risk Level ──────────────────────────────────────────────────
    if risk_level == "HIGH":
        cap = min(cap, 0.25)
        reasons.append("CEO Risk HIGH → %25 cap")
    elif risk_level == "MEDIUM":
        cap = min(cap, 0.50)
        reasons.append("CEO Risk MEDIUM → %50 cap")
    else:
        reasons.append("CEO Risk LOW → full capacity")

    # ── 2. Market Volatility (ATR-sim) ─────────────────────────────────────
    if market_vol > 1.5:
        cap = min(cap, 0.25)
        reasons.append(f"Extreme volatility %{market_vol:.2f}")
    elif market_vol > 0.8:
        cap = min(cap, 0.50)
        reasons.append(f"High volatility %{market_vol:.2f}")
    elif market_vol > 0.0:
        reasons.append(f"Volatility %{market_vol:.2f} — normal")

    # ── 3. News Sentiment Override ─────────────────────────────────────────
    if sentiment_score <= -3:
        cap = min(cap, 0.25)
        reasons.append("Bearish news (-3↓) → position limited")
    elif sentiment_score >= 3:
        # Positive news doesn't increase cap beyond what risk allows,
        # but prevents further reduction
        reasons.append("Bullish news (+3↑) — no extra restriction")

    reason = " | ".join(reasons)
    return cap, reason


# ── Background Trading Loop (CEO/Orchestrator Architecture) ───────────────

async def trading_loop():
    print("[TradingLoop] CEO/Orchestrator Paper Trading dongusu baslatildi.")
    while True:
        try:
            print(f"\n{'='*60}")
            print(f"[TradingLoop] Dongu basliyor... {datetime.now(timezone.utc).isoformat()}")

            # ── Phase 0: Fetch prices + update history ────────────────────
            prices = await fetch_prices()
            market = get_market_analysis()
            print(f"[Market] BTC=₺{prices.get('BTC', 0):,.2f} "
                  f"ETH=₺{prices.get('ETH', 0):,.2f} "
                  f"SOL=₺{prices.get('SOL', 0):,.2f}")

            # Print indicators
            for asset, ind in market["indicators"].items():
                print(f"  {asset}: RSI={ind['rsi']} Trend={ind['trend']} "
                      f"SMA7={ind['sma_7']} SMA14={ind['sma_14']}")

            portfolio = load_portfolio()

            # ── Phase 1: Hard Risk Rules (bypass AI) ──────────────────────
            print("\n[RiskRules] Stop-Loss / Take-Profit kontrolu...")
            risk_triggers = 0
            stop_loss_events: list[tuple[str, dict, dict]] = []  # (agent_id, agent, trade)
            for agent_id in AGENT_IDS:
                agent = portfolio["agents"][agent_id]
                forced = check_risk_rules(agent, prices)
                for trade in forced:
                    risk_triggers += 1
                    trade_pnl = trade.get("pnl") or 0
                    print(f"  [!] {agent['name']} {trade['_trigger']}: "
                          f"{trade['quantity']} {trade['asset']} @ ₺{trade['price']:,.2f} "
                          f"PnL=₺{trade_pnl:,.2f}")
                    if trade.get("_trigger") == "STOP_LOSS":
                        stop_loss_events.append((agent_id, agent, trade))
            if risk_triggers == 0:
                print("  [OK] Risk kurali tetiklenmedi.")

            # Save after risk rules in case of forced sells
            if risk_triggers > 0:
                portfolio["last_loop_at"] = datetime.now(timezone.utc).isoformat()
                save_portfolio(portfolio)

            # ── Phase 1.5: Self-Criticism for Stop-Loss Events ───────────
            for agent_id, agent, trade in stop_loss_events:
                agent_name = AGENT_NAMES.get(agent_id, agent_id)
                diary = get_recent_diary(agent, count=1)
                if diary:
                    print(f"\n  [OZ-ELESTIRI] {agent_name} stop-loss sonrasi oz-elestiri yapiyor...")
                    criticism = await get_self_criticism(agent_id, agent_name, diary[0])
                    add_diary_note(agent, "SELF_CRITICISM", criticism, trade["id"])
                    print(f"  [OZ-ELESTIRI] {agent_name} raporu gunluge kaydedildi.")
                portfolio["last_loop_at"] = datetime.now(timezone.utc).isoformat()
                save_portfolio(portfolio)

            # ── Phase 1.6: News Sentiment Analysis ────────────────────────
            print("\n[Sentiment] Kripto haber duyarliligi analiz ediliyor...")
            sentiment_report = await fetch_sentiment_report()
            overall_sent = sentiment_report.get("overall_sentiment", "NEUTRAL")
            overall_score = sentiment_report.get("overall_score", 0)
            print(f"  Genel Duyarlilik: {overall_sent} (Skor: {overall_score:+d})")
            for h in sentiment_report.get("headlines", [])[:3]:
                print(f"  [{h['impact']}] Score={h['score']:+d} | {h['headline'][:80]}...")

            # ── Phase 2: CEO Macro Analysis ───────────────────────────────
            print("\n[CEO] Makro piyasa analizi yapiliyor...")
            ceo_decision = await get_ceo_analysis(market, portfolio, sentiment_report)
            ceo_sentiment = ceo_decision.get("market_sentiment", "NEUTRAL")
            risk = ceo_decision.get("risk_level", "MEDIUM")
            active_agents = ceo_decision.get("active_agents", AGENT_IDS)
            guidance = ceo_decision.get("macro_guidance", "")
            print(f"  Sentiment: {ceo_sentiment} | Risk: {risk}")
            print(f"  Aktif Ajanlar: {active_agents}")
            print(f"  Rehberlik: {guidance[:120]}...")
            print(f"  Trend Ozet: {ceo_decision.get('trend_summary', '')[:100]}")

            # ── Phase 3: Worker Agent Execution ───────────────────────────
            print(f"\n[Workers] Isci ajanlar calistiriliyor...")

            # Calculate market volatility for position sizing
            market_vol_data = get_market_volatility()
            avg_vol = round(sum(market_vol_data.values()) / max(len(market_vol_data), 1), 3)
            print(f"  Piyasa Volatilitesi (ATR-sim): %{avg_vol} "
                  f"(BTC=%{market_vol_data.get('BTC', 0)}, "
                  f"ETH=%{market_vol_data.get('ETH', 0)}, "
                  f"SOL=%{market_vol_data.get('SOL', 0)})")

            # Per-agent position cap storage for frontend
            agent_position_caps: dict[str, dict] = {}

            for agent_id in AGENT_IDS:
                agent = portfolio["agents"][agent_id]
                refresh_uptime(agent)
                update_pnl(agent, prices)

                if agent_id not in active_agents:
                    print(f"  [{agent['name']}] CEO tarafindan pasif birakildi — bekleniyor.")
                    agent_position_caps[agent_id] = {"cap_pct": 0, "reason": "Agent inactive"}
                    continue

                decision = await get_worker_decision(agent_id, prices, agent, ceo_decision)
                action = decision.get("action", "HOLD").upper()
                asset = decision.get("asset", "BTC").upper()
                pct = float(decision.get("percentage", 0))
                reason = decision.get("reason", "")

                # ── Dynamic Position Sizing ──────────────────────────────
                asset_vol = market_vol_data.get(asset, avg_vol)
                cap_multiplier, cap_reason = calc_position_cap(risk, asset_vol, overall_score)
                effective_pct = round(pct * cap_multiplier, 1)
                cap_label = int(cap_multiplier * 100)

                if action == "BUY" and effective_pct < pct:
                    print(f"  [{agent['name']}] Position Cap: %{cap_label} → "
                          f"BUY %{pct} → %{effective_pct} | {cap_reason}")

                agent_position_caps[agent_id] = {
                    "cap_pct": cap_label,
                    "cap_multiplier": cap_multiplier,
                    "reason": cap_reason,
                    "asset_volatility": asset_vol,
                }

                # ── Network Selection ────────────────────────────────────
                agent_cash = agent.get("cash") or 0
                trade_amount = agent_cash * ((effective_pct if action == "BUY" else pct) / 100)
                wallets = agent.get("wallets") or {}
                selected_network, net_reason = select_optimal_network(
                    trade_amount if action == "BUY" else (pct / 100) * agent_cash,
                    wallets,
                )
                gas = get_gas_fee(selected_network)

                print(f"  [{agent['name']}] {action} {asset} @ {effective_pct if action == 'BUY' else pct}% "
                      f"on {NETWORKS[selected_network]['name']} (gas=₺{gas:.2f})  — {reason}")

                if action == "BUY":
                    trade = execute_buy(agent, asset, effective_pct, prices.get(asset, 0), network=selected_network)
                    if trade:
                        trade["_position_cap"] = cap_label
                        trade["_cap_reason"] = cap_reason
                        print(f"    [BUY]  {trade['quantity']} {asset} @ ₺{trade['price']:,.2f} "
                              f"on {selected_network} (gas=₺{trade.get('gas_fee', 0):.2f}, Cap: %{cap_label})")
                elif action == "SELL":
                    trade = execute_sell(agent, asset, pct, prices.get(asset, 0), reason=reason, network=selected_network)
                    if trade:
                        trade_pnl = trade.get("pnl") or 0
                        print(f"    [SELL] {trade['quantity']} {asset} @ ₺{trade['price']:,.2f} "
                              f"on {selected_network} (gas=₺{trade.get('gas_fee', 0):.2f})  PnL=₺{trade_pnl:,.2f}")

                update_pnl(agent, prices)

            # ── Phase 4: Persist ──────────────────────────────────────────
            portfolio["last_loop_at"] = datetime.now(timezone.utc).isoformat()
            portfolio["_last_ceo"] = {
                "sentiment": ceo_sentiment,
                "risk_level": risk,
                "active_agents": active_agents,
                "guidance": guidance[:200],
            }
            # Attach position caps for frontend
            portfolio["_position_caps"] = agent_position_caps

            # Attach sentiment report for frontend consumption
            portfolio["_last_sentiment"] = {
                "overall_sentiment": overall_sent,
                "overall_score": overall_score,
                "top_headline": sentiment_report.get("headlines", [{}])[0].get("headline", ""),
                "top_impact": sentiment_report.get("headlines", [{}])[0].get("impact", "NEUTRAL"),
                "analysis": sentiment_report.get("analysis", ""),
                "headlines": sentiment_report.get("headlines", [])[:5],
                "fetched_at": sentiment_report.get("_fetched_at", ""),
            }
            save_portfolio(portfolio)
            print(f"\n[TradingLoop] Dongu tamamlandi. {LOOP_INTERVAL}s bekleniyor...")

        except Exception as exc:
            print(f"[TradingLoop] HATA: {exc}")
            traceback.print_exc()

        await asyncio.sleep(LOOP_INTERVAL)


# ── FastAPI App ───────────────────────────────────────────────────────────

_trading_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _trading_task
    print("[Server] Trading dongusu baslatiliyor...")
    _trading_task = asyncio.create_task(trading_loop())
    yield
    if _trading_task:
        _trading_task.cancel()
        try:
            await _trading_task
        except asyncio.CancelledError:
            print("[Server] Trading dongusu durduruldu.")


app = FastAPI(title="KeFur AI Backend — CEO/Orchestrator Paper Trading", version="0.3.0", lifespan=lifespan)

# Production CORS — configurable via APP_URL env var, wildcard fallback for dev
_cors_origins = os.getenv("APP_URL", "*").split(",")
if "*" not in _cors_origins:
    _cors_origins.append("http://localhost:5173")
    _cors_origins.append("http://10.0.2.2:8000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/agents")
def get_agents():
    portfolio = load_portfolio()
    prices = get_cached_prices()
    result = []
    for agent_id in AGENT_IDS:
        agent = portfolio["agents"][agent_id]
        refresh_uptime(agent)
        total_value = calc_total_value(agent, prices)
        clean_trades = []
        for t in agent["recent_trades"][:10]:
            trade = {
                "id": t["id"],
                "pair": t["pair"],
                "side": t["side"],
                "price": t.get("price", 0),
                "quantity": t.get("quantity", 0),
                "time": t["time"],
            }
            if t.get("pnl") is not None:
                trade["pnl"] = t["pnl"]
            if t.get("_forced"):
                trade["_forced"] = True
                trade["_trigger"] = t.get("_trigger", "")
            clean_trades.append(trade)
        result.append({
            "id": agent["id"],
            "name": agent["name"],
            "pnl_percent": agent["pnl_percent"],
            "balance": round(total_value, 2),
            "uptime_minutes": agent["uptime_minutes"],
            "win_rate": agent["win_rate"],
            "managed_balance": agent["managed_balance"],
            "cash": round(agent["cash"], 2),
            "wallets": wallet_summary(agent.get("wallets", {})),
            "positions": {a: round(q, 6) for a, q in agent["positions"].items()},
            "recent_trades": clean_trades,
            "trading_diary": agent.get("trading_diary", [])[:5],
            "total_trades": agent["total_trades"],
            "winning_trades": agent["winning_trades"],
        })
    return {
        "agents": result,
        "ceo_status": portfolio.get("_last_ceo"),
        "sentiment": portfolio.get("_last_sentiment"),
        "position_caps": portfolio.get("_position_caps", {}),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_loop_at": portfolio.get("last_loop_at"),
    }


@app.get("/api/market")
def get_market():
    """Returns live prices + technical indicators (RSI, SMA, trends)."""
    return get_market_analysis()


def _derive_fear_greed(market: dict) -> dict:
    """Derive a Fear & Greed index from RSI values across all assets."""
    indicators = market.get("indicators", {})
    rsi_values = []
    for ind in indicators.values():
        rsi = ind.get("rsi")
        if rsi is not None:
            rsi_values.append(rsi)

    if len(rsi_values) < 2:
        return {"index": 50, "label": "Neutral"}

    avg_rsi = sum(rsi_values) / len(rsi_values)
    if avg_rsi >= 75:
        return {"index": 85, "label": "Extreme Greed"}
    if avg_rsi >= 62:
        return {"index": 70, "label": "Greed"}
    if avg_rsi >= 38:
        return {"index": 50, "label": "Neutral"}
    if avg_rsi >= 25:
        return {"index": 35, "label": "Fear"}
    return {"index": 20, "label": "Extreme Fear"}


@app.get("/api/insights")
def get_insights():
    """Combined endpoint: CEO status + market indicators + fear/greed for UI."""
    portfolio = load_portfolio()
    market = get_market_analysis()
    ceo = portfolio.get("_last_ceo")

    # Build per-asset analysis cards for the frontend
    asset_insights = []
    indicators = market.get("indicators", {})
    prices = market.get("prices", {})
    for asset in ["BTC", "ETH", "SOL"]:
        ind = indicators.get(asset, {})
        rsi = ind.get("rsi")
        trend = ind.get("trend", "INSUFFICIENT_DATA")
        asset_insights.append({
            "symbol": asset,
            "price": prices.get(asset, 0),
            "rsi": rsi,
            "sma_7": ind.get("sma_7"),
            "sma_14": ind.get("sma_14"),
            "trend": trend,
            "sentiment": "Bullish" if trend == "UPTREND" else (
                "Bearish" if trend == "DOWNTREND" else "Neutral"
            ),
        })

    return {
        "ceo": ceo,
        "sentiment": portfolio.get("_last_sentiment"),
        "market": {
            "prices": prices,
            "indicators": indicators,
            "history_depth": market.get("history_depth", 0),
        },
        "asset_insights": asset_insights,
        "fear_greed": _derive_fear_greed(market),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/prices")
def get_prices_sync():
    """Legacy — returns cached prices + agent summary."""
    portfolio = load_portfolio()
    return {
        "ceo_status": portfolio.get("_last_ceo"),
        "last_loop_at": portfolio.get("last_loop_at"),
        "agents": {
            aid: {
                "cash": portfolio["agents"][aid]["cash"],
                "pnl_percent": portfolio["agents"][aid]["pnl_percent"],
                "positions": portfolio["agents"][aid]["positions"],
            }
            for aid in AGENT_IDS
        },
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "loop_running": _trading_task is not None and not _trading_task.done()}


@app.get("/api/admin/obsidian-report")
def obsidian_report():
    """Generate an Obsidian-compatible Markdown daily report from portfolio data."""
    from fastapi.responses import PlainTextResponse
    md = generate_obsidian_report()
    return PlainTextResponse(content=md, media_type="text/markdown; charset=utf-8")
