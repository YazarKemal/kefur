import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from wallet_manager import (
    NETWORK_IDS,
    deduct_gas,
    get_gas_fee,
    init_wallets,
    select_optimal_network,
    total_wallet_cash,
    wallet_summary,
)

PORTFOLIO_PATH = Path(__file__).resolve().parent / "portfolio.json"
INITIAL_BALANCE = 1000.0  # ₺1,000 TL starting budget
ASSETS = ["BTC", "ETH", "SOL"]
AGENT_IDS = ["nexus", "oracle", "sentinel"]
AGENT_NAMES = {"nexus": "Nexus", "oracle": "Oracle", "sentinel": "Sentinel"}

# ── Hard Risk Rules (bypass AI) ─────────────────────────────────────────────
STOP_LOSS_PCT = -0.02   # -2% loss → force sell
TAKE_PROFIT_PCT = 0.05  # +5% profit → force sell


def _empty_agent(agent_id: str) -> dict:
    return {
        "id": agent_id,
        "name": AGENT_NAMES[agent_id],
        "cash": INITIAL_BALANCE,
        "managed_balance": INITIAL_BALANCE,
        "wallets": init_wallets(INITIAL_BALANCE),
        "positions": {a: 0.0 for a in ASSETS},
        "cost_basis": {a: 0.0 for a in ASSETS},
        "recent_trades": [],
        "trading_diary": [],
        "total_trades": 0,
        "winning_trades": 0,
        "pnl_percent": 0.0,
        "win_rate": 0.0,
        "uptime_minutes": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }


def load_portfolio() -> dict:
    if PORTFOLIO_PATH.exists():
        with open(PORTFOLIO_PATH, "r") as f:
            data = json.load(f)
        # Ensure all 3 agents exist (handles partial/corrupt files)
        for aid in AGENT_IDS:
            if aid not in data.get("agents", {}):
                data["agents"][aid] = _empty_agent(aid)
            else:
                ag = data["agents"][aid]
                # Backfill wallets for legacy agents
                if "wallets" not in ag or not ag["wallets"]:
                    ag["wallets"] = init_wallets(ag.get("cash", INITIAL_BALANCE))
                # Ensure total cash matches wallet sum
                wallet_total = total_wallet_cash(ag["wallets"])
                if abs(ag.get("cash", 0) - wallet_total) > 0.01:
                    ag["cash"] = wallet_total
        return data
    return _init_portfolio()


def _init_portfolio() -> dict:
    data = {
        "agents": {aid: _empty_agent(aid) for aid in AGENT_IDS},
        "last_loop_at": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    save_portfolio(data)
    return data


def save_portfolio(data: dict):
    with open(PORTFOLIO_PATH, "w") as f:
        json.dump(data, f, indent=2, default=str)


def add_diary_entry(agent: dict, trade: dict, pnl_pct: float, reason: str, success: bool):
    """Record a closed trade outcome in the agent's trading diary for self-reflection memory."""
    pnl_val = trade.get("pnl")
    if pnl_val is None:
        pnl_val = 0.0
    trigger_val = trade.get("_trigger")
    if trigger_val is None:
        trigger_val = "MANUAL"
    entry = {
        "trade_id": trade.get("trade_id", trade.get("id", "")),
        "pair": trade.get("pair", ""),
        "side": trade.get("side", ""),
        "asset": trade.get("asset", ""),
        "quantity": trade.get("quantity", 0),
        "price": trade.get("price", 0),
        "pnl_usd": pnl_val,
        "pnl_percent": round(pnl_pct, 2) if pnl_pct is not None else 0.0,
        "reason": reason or "",
        "success": bool(success),
        "trigger": trigger_val,
        "time": trade.get("time", datetime.now(timezone.utc).isoformat()),
    }
    agent.setdefault("trading_diary", []).insert(0, entry)
    if len(agent["trading_diary"]) > 50:
        agent["trading_diary"] = agent["trading_diary"][:50]
    return entry


def get_recent_diary(agent: dict, count: int = 3) -> list[dict]:
    """Return the last N trading diary entries for prompt injection."""
    return agent.get("trading_diary", [])[:count]


def add_diary_note(agent: dict, note_type: str, content: str, related_trade_id: str = ""):
    """Add a free-form note (e.g. self-criticism) to the trading diary."""
    from datetime import datetime as _dt
    entry = {
        "trade_id": f"note-{related_trade_id}" if related_trade_id else "note",
        "pair": "",
        "side": "",
        "asset": "",
        "quantity": 0,
        "price": 0.0,
        "pnl_usd": 0.0,
        "pnl_percent": 0.0,
        "reason": content or "",
        "success": False,
        "trigger": note_type or "SELF_CRITICISM",
        "time": _dt.now(timezone.utc).isoformat(),
    }
    agent.setdefault("trading_diary", []).insert(0, entry)
    if len(agent["trading_diary"]) > 50:
        agent["trading_diary"] = agent["trading_diary"][:50]
    return entry


def calc_total_value(agent: dict, prices: dict[str, float]) -> float:
    total = agent.get("cash") or 0.0
    for asset in ASSETS:
        qty = agent["positions"].get(asset, 0) or 0.0
        total += qty * (prices.get(asset, 0) or 0.0)
    return total


def refresh_uptime(agent: dict):
    started = datetime.fromisoformat(agent["started_at"])
    delta = datetime.now(timezone.utc) - started
    agent["uptime_minutes"] = int(delta.total_seconds() / 60)


def update_pnl(agent: dict, prices: dict[str, float]):
    tv = calc_total_value(agent, prices)
    managed = agent.get("managed_balance") or INITIAL_BALANCE
    if managed <= 0:
        managed = INITIAL_BALANCE
    agent["pnl_percent"] = round((tv - managed) / managed * 100, 2)
    total_trades = agent.get("total_trades") or 0
    if total_trades > 0:
        agent["win_rate"] = round(
            (agent.get("winning_trades") or 0) / total_trades * 100, 1
        )


def execute_buy(agent: dict, asset: str, percentage: float, price: float, network: str = "arbitrum") -> Optional[dict]:
    usd_amount = agent["cash"] * (percentage / 100)
    if usd_amount < 10 or price <= 0:
        return None

    wallets = agent.setdefault("wallets", init_wallets(agent["cash"]))
    gas_fee = get_gas_fee(network)
    total_needed = usd_amount + gas_fee

    # Check if selected network has enough funds
    network_balance = wallets.get(network, 0)
    if network_balance < total_needed:
        # Try to pull from other networks
        deficit = total_needed - network_balance
        for src_net in NETWORK_IDS:
            if src_net == network:
                continue
            available = wallets.get(src_net, 0)
            transfer = min(deficit, available)
            if transfer > 0:
                wallets[src_net] = round(wallets[src_net] - transfer, 2)
                wallets[network] = round(wallets.get(network, 0) + transfer, 2)
                deficit -= transfer
            if deficit <= 0:
                break
        if deficit > 0:
            return None  # Can't cover trade + gas across all networks

    # Deduct trade amount + gas from network wallet
    wallets[network] = round(wallets[network] - usd_amount, 2)
    gas_deducted = deduct_gas(wallets, network)

    # Sync total cash
    agent["cash"] = total_wallet_cash(wallets)

    qty = usd_amount / price

    # Update average cost basis
    held = agent["positions"].get(asset, 0)
    old_basis = agent["cost_basis"].get(asset, 0)
    if held > 0:
        agent["cost_basis"][asset] = ((old_basis * held) + (price * qty)) / (held + qty)
    else:
        agent["cost_basis"][asset] = price

    agent["positions"][asset] = held + qty
    now = datetime.now(timezone.utc)
    agent["total_trades"] += 1

    trade = {
        "id": f"{agent['id']}-{agent['total_trades']}",
        "pair": f"{asset}/USDT",
        "side": "LONG",
        "asset": asset,
        "quantity": round(qty, 6),
        "price": price,
        "usd_amount": round(usd_amount, 2),
        "network": network,
        "gas_fee": round(gas_deducted, 2),
        "time": now.isoformat(),
        "pnl": None,
    }
    agent["recent_trades"].insert(0, trade)
    if len(agent["recent_trades"]) > 20:
        agent["recent_trades"] = agent["recent_trades"][:20]

    # Record gas cost in trading diary
    if gas_deducted > 0:
        add_diary_entry(agent, trade, 0, f"Gas fee: ₺{gas_deducted:.2f} on {network}", False)

    return trade


def execute_sell(agent: dict, asset: str, percentage: float, price: float, reason: str = "", network: str = "arbitrum") -> Optional[dict]:
    qty_held = agent["positions"].get(asset, 0)
    if qty_held <= 0 or price <= 0:
        return None
    qty_to_sell = qty_held * (percentage / 100)
    cost_basis = agent["cost_basis"].get(asset, 0)
    realized_pnl = (price - cost_basis) * qty_to_sell
    pnl_pct = ((price - cost_basis) / cost_basis * 100) if cost_basis > 0 else 0

    proceeds = qty_to_sell * price

    # Return proceeds to the selected network's wallet
    wallets = agent.setdefault("wallets", init_wallets(agent["cash"]))
    wallets[network] = round(wallets.get(network, 0) + proceeds, 2)

    # Deduct gas from the network
    gas_deducted = deduct_gas(wallets, network)

    # Sync total cash
    agent["cash"] = total_wallet_cash(wallets)

    agent["positions"][asset] = qty_held - qty_to_sell
    if agent["positions"][asset] < 0.0001:
        agent["positions"][asset] = 0
        agent["cost_basis"][asset] = 0

    agent["total_trades"] += 1
    if realized_pnl > 0:
        agent["winning_trades"] += 1

    now = datetime.now(timezone.utc)
    trade = {
        "id": f"{agent['id']}-{agent['total_trades']}",
        "pair": f"{asset}/USDT",
        "side": "SHORT",
        "asset": asset,
        "quantity": round(qty_to_sell, 6),
        "price": price,
        "usd_amount": round(proceeds, 2),
        "network": network,
        "gas_fee": round(gas_deducted, 2),
        "time": now.isoformat(),
        "pnl": round(realized_pnl, 2),
    }
    agent["recent_trades"].insert(0, trade)
    if len(agent["recent_trades"]) > 20:
        agent["recent_trades"] = agent["recent_trades"][:20]

    # Record outcome in trading diary for self-reflection memory
    diary_reason = reason if reason else f"{trade.get('_trigger', 'MANUAL')} kapanis"
    add_diary_entry(agent, trade, pnl_pct, diary_reason, realized_pnl > 0)

    # Record gas cost
    if gas_deducted > 0:
        add_diary_entry(agent, trade, 0, f"Gas fee: ₺{gas_deducted:.2f} on {network}", False)

    return trade


# ---- Hard Risk Rules (Stop-Loss / Take-Profit) -------------------------------

def check_risk_rules(agent: dict, prices: dict[str, float]) -> list[dict]:
    """Enforce stop-loss (-2%) and take-profit (+5%) without AI involvement.
    Returns a list of forced-sell trades that were executed."""
    forced_sells: list[dict] = []
    for asset in ASSETS:
        qty = agent["positions"].get(asset, 0)
        if qty <= 0:
            continue
        cost = agent["cost_basis"].get(asset, 0)
        current_price = prices.get(asset, 0)
        if cost <= 0 or current_price <= 0:
            continue

        pnl_pct = (current_price - cost) / cost
        trigger = None
        if pnl_pct <= STOP_LOSS_PCT:
            trigger = "STOP_LOSS"
        elif pnl_pct >= TAKE_PROFIT_PCT:
            trigger = "TAKE_PROFIT"

        if trigger:
            reason = f"{trigger}: fiyat ₺{current_price:,.2f}, maliyet ₺{cost:,.2f} (%{round(pnl_pct * 100, 2)} hareket)"
            trade = execute_sell(agent, asset, 100, current_price, reason=reason)
            if trade:
                trade["_forced"] = True
                trade["_trigger"] = trigger
                forced_sells.append(trade)
    return forced_sells
