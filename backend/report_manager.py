"""Obsidian Markdown report generator for KeFur AI Hedge Fund.

Reads portfolio.json and produces a daily Markdown report suitable
for Obsidian vaults, covering macro sentiment, wallet balances,
gas fees, and agent self-reflection notes from the trading diary.
"""

from datetime import datetime, timezone
from pathlib import Path

from market import get_cached_prices, get_market_volatility
from portfolio import AGENT_IDS, AGENT_NAMES, ASSETS, calc_total_value, load_portfolio
from wallet_manager import wallet_summary


def _format_try(amount: float) -> str:
    sign = "+" if amount >= 0 else ""
    return f"{sign}₺{amount:,.2f}"


def _format_pct(value: float) -> str:
    sign = "+" if value >= 0 else ""
    return f"{sign}{value:.2f}%"


def _extract_diary_insights(agent: dict, trigger_filter: str | None = None) -> list[dict]:
    """Extract diary entries filtered by trigger type (e.g. STOP_LOSS, SELF_CRITICISM)."""
    diary = agent.get("trading_diary", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entries = []
    for entry in diary:
        entry_date = entry.get("time", "")[:10]
        if entry_date != today:
            continue
        if trigger_filter and entry.get("trigger") != trigger_filter:
            continue
        entries.append(entry)
    return entries


def generate_obsidian_report() -> str:
    """Generate a complete Obsidian-flavoured Markdown daily report."""
    portfolio = load_portfolio()
    prices = get_cached_prices()
    volatility = get_market_volatility()
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M UTC")

    ceo = portfolio.get("_last_ceo", {})
    sentiment_data = portfolio.get("_last_sentiment", {})

    lines: list[str] = []

    # ── Header ──────────────────────────────────────────────────────────────
    lines.append(f"# 🏦 KeFur AI Hedge Fund — Daily Report")
    lines.append(f"**{date_str}** — generated at {time_str}")
    lines.append("")

    # ── Macro Sentiment Summary ─────────────────────────────────────────────
    lines.append("## 📊 Macro Sentiment Summary")
    lines.append("")
    ceo_sentiment = ceo.get("sentiment", "N/A")
    ceo_risk = ceo.get("risk_level", "N/A")
    ceo_guidance = ceo.get("guidance", "No CEO analysis available.")
    news_score = sentiment_data.get("overall_score", 0)
    news_sentiment = sentiment_data.get("overall_sentiment", "NEUTRAL")
    news_analysis = sentiment_data.get("analysis", "")
    top_headline = sentiment_data.get("top_headline", "")

    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| CEO Market Sentiment | **{ceo_sentiment}** |")
    lines.append(f"| CEO Risk Level | **{ceo_risk}** |")
    lines.append(f"| Active Agents | {', '.join(ceo.get('active_agents', []))} |")
    lines.append(f"| News Sentiment Score | {news_score:+d} ({news_sentiment}) |")
    lines.append("")
    lines.append(f"> **CEO Guidance:** {ceo_guidance}")
    lines.append("")
    if top_headline:
        lines.append(f"### 🔥 Breaking News")
        lines.append(f"> {top_headline}")
        lines.append("")
    if news_analysis:
        lines.append(f"**Sentiment Analysis:** {news_analysis}")
        lines.append("")
    if sentiment_data.get("headlines"):
        lines.append("### 📰 Today's Headlines")
        lines.append("")
        for h in sentiment_data["headlines"]:
            emoji = "🟢" if h["score"] > 0 else ("🔴" if h["score"] < 0 else "⚪")
            lines.append(f"- {emoji} [{h['impact']}] **({h['score']:+d})** {h['headline']}")
            lines.append(f"  - *{h.get('reasoning', '')}*")
        lines.append("")

    # ── Wallet Balances & Gas Fees ──────────────────────────────────────────
    lines.append("## 💰 Wallet Balances & Gas Fees")
    lines.append("")

    total_gas = 0.0
    total_portfolio_value = 0.0

    for aid in AGENT_IDS:
        agent = portfolio["agents"][aid]
        name = AGENT_NAMES.get(aid, aid)
        tv = calc_total_value(agent, prices)
        total_portfolio_value += tv
        wallets = wallet_summary(agent.get("wallets", {}))

        # Sum gas from trading diary today
        agent_gas = 0.0
        for entry in agent.get("trading_diary", []):
            if entry.get("time", "")[:10] == date_str and "Gas fee" in entry.get("reason", ""):
                agent_gas += abs(entry.get("pnl_usd", 0) or 0)
        total_gas += agent_gas

        positions_str = ", ".join(
            f"{a}: {agent['positions'].get(a, 0):.6f}" for a in ASSETS
        )

        lines.append(f"### 🤖 {name} (`{aid}`)")
        lines.append(f"- **Total Value:** {_format_try(tv)} (PnL: {_format_pct(agent.get('pnl_percent', 0))})")
        lines.append(f"- **Positions:** {positions_str}")
        lines.append(f"- **Gas Spent Today:** ₺{agent_gas:,.2f}")
        lines.append(f"- **Trades:** {agent.get('total_trades', 0)} total | Win Rate: {agent.get('win_rate', 0):.1f}%")
        lines.append("")
        lines.append("| Network | Balance | Share | Gas/Tx |")
        lines.append("|---------|---------|-------|--------|")
        for w in wallets:
            lines.append(f"| {w['network_name']} ({w['network_type']}) | ₺{w['balance']:,.2f} | {w['percentage']:.1f}% | ₺{w['gas_fee']:.2f} |")
        lines.append("")

    lines.append(f"### 📊 Portfolio Totals")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Total Portfolio Value | **{_format_try(total_portfolio_value)}** |")
    lines.append(f"| Total Gas Spent Today | **₺{total_gas:,.2f}** |")
    lines.append("")

    # ── Market Volatility ───────────────────────────────────────────────────
    lines.append("## 📈 Market Volatility (ATR-Sim %14)")
    lines.append("")
    for asset in ASSETS:
        vol = volatility.get(asset, 0)
        emoji = "🔴" if vol > 1.0 else ("🟡" if vol > 0.5 else "🟢")
        lines.append(f"- {emoji} **{asset}:** {vol:.3f}%")
    lines.append("")

    # ── Agent Reflections & Criticisms ──────────────────────────────────────
    lines.append("## 🧠 Agent Reflections & Self-Criticism")
    lines.append("")

    today_has_reflections = False
    for aid in AGENT_IDS:
        agent = portfolio["agents"][aid]
        name = AGENT_NAMES.get(aid, aid)
        diary = agent.get("trading_diary", [])

        # Filter today's entries
        today_entries = [e for e in diary if e.get("time", "")[:10] == date_str]
        if not today_entries:
            continue

        criticisms = [e for e in today_entries if e.get("trigger") == "SELF_CRITICISM"]
        stop_losses = [e for e in today_entries if e.get("trigger") == "STOP_LOSS"]
        profits = [e for e in today_entries if e.get("success")]
        manual_losses = [e for e in today_entries if not e.get("success") and e.get("trigger") not in ("SELF_CRITICISM", "STOP_LOSS")]

        lines.append(f"### 🤖 {name}")
        lines.append("")

        if profits:
            today_has_reflections = True
            lines.append("#### ✅ Profitable Closes")
            for entry in profits[:5]:
                lines.append(f"- **{entry.get('pair', '')} {entry.get('side', '')}** — PnL: {_format_try(entry.get('pnl_usd', 0) or 0)} ({_format_pct(entry.get('pnl_percent', 0) or 0)})")
                lines.append(f"  - *{entry.get('reason', '')[:200]}*")
            lines.append("")

        if stop_losses:
            today_has_reflections = True
            lines.append("#### ⛔ Stop-Loss Events")
            for entry in stop_losses[:5]:
                lines.append(f"- **{entry.get('pair', '')} {entry.get('side', '')}** — Loss: {_format_try(entry.get('pnl_usd', 0) or 0)} ({_format_pct(entry.get('pnl_percent', 0) or 0)})")
                lines.append(f"  - *{entry.get('reason', '')[:200]}*")
            lines.append("")

        if manual_losses:
            today_has_reflections = True
            lines.append("#### 📉 Manual Loss Closes")
            for entry in manual_losses[:5]:
                lines.append(f"- **{entry.get('pair', '')}** — {_format_try(entry.get('pnl_usd', 0) or 0)}")
            lines.append("")

        if criticisms:
            today_has_reflections = True
            lines.append("#### 💭 Self-Criticism Reports")
            for entry in criticisms[:3]:
                lines.append(f"> {entry.get('reason', '')}")
                lines.append("")
            lines.append("")

    if not today_has_reflections:
        lines.append("*No trading activity or self-reflections recorded today.*")
        lines.append("")

    # ── Footer ──────────────────────────────────────────────────────────────
    lines.append("---")
    lines.append(f"*Generated by KeFur AI Backend — Obsidian Report Engine*")
    lines.append(f"*Next report: {date_str}T23:59 UTC*")
    lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_obsidian_report())
