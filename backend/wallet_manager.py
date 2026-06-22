"""Multi-chain simulated wallet infrastructure for KeFur AI agents.

Each agent's cash is distributed across 3 simulated networks with different
gas-fee profiles. The system selects the optimal network per trade based on
trade size vs gas cost, and deducts gas fees from the agent's balance.
"""

NETWORKS: dict[str, dict] = {
    "ethereum": {
        "name": "Ethereum Mainnet",
        "type": "EVM L1",
        "gas_fee": 167.50,  # ₺5.00 * 33.5 TL
        "description": "High security, ₺167.50 gas per tx",
    },
    "arbitrum": {
        "name": "Arbitrum",
        "type": "EVM L2",
        "gas_fee": 3.35,  # ₺0.10 * 33.5 TL
        "description": "Low cost, ₺3.35 gas per tx",
    },
    "osmosis": {
        "name": "Osmosis",
        "type": "Cosmos IBC",
        "gas_fee": 0.67,  # ₺0.02 * 33.5 TL
        "description": "Minimal gas, ₺0.67 per tx",
    },
}

DEFAULT_ALLOCATION = {"ethereum": 0.40, "arbitrum": 0.30, "osmosis": 0.30}
NETWORK_IDS = list(NETWORKS.keys())


def init_wallets(cash_amount: float) -> dict[str, float]:
    """Distribute initial cash across networks according to default allocation."""
    wallets: dict[str, float] = {}
    for net_id, pct in DEFAULT_ALLOCATION.items():
        wallets[net_id] = round(cash_amount * pct, 2)
    # Handle rounding errors — give remainder to ethereum
    allocated = sum(wallets.values())
    if allocated != cash_amount:
        wallets["ethereum"] += round(cash_amount - allocated, 2)
    return wallets


def select_optimal_network(trade_amount_usd: float, wallets: dict[str, float], agent_id: str = "") -> tuple[str, str]:
    """Pick the best network for a trade based on gas/trade ratio and wallet balance.

    Hard rules:
    - 20x rule: if trade < 20 × gas_fee, the network is HARD-REJECTED (gas > 5% of trade).
    - L2 priority: oracle & sentinel skip Ethereum unless trade > ₺3,350 (20 × ₺167.50).
    - Ethereum only viable when trade >= ₺3,350 (gas ≤ 5%).
    """
    GAS_RATIO_HARD_CAP = 0.05  # max 5% — equivalent to 20x rule

    candidates: list[tuple[str, float]] = []
    for net_id in NETWORK_IDS:
        gas = NETWORKS[net_id]["gas_fee"]
        if trade_amount_usd <= 0:
            continue

        # ── 20x Hard Rule: reject network if gas > 5% of trade ─────────
        ratio = gas / trade_amount_usd
        if ratio > GAS_RATIO_HARD_CAP:
            continue  # hard-reject — gas would eat the position

        # ── L2 Priority: Oracle & Sentinel skip Ethereum for small trades ─
        if agent_id in ("oracle", "sentinel") and net_id == "ethereum":
            continue  # these agents must use L2

        balance = wallets.get(net_id, 0)
        if balance >= (trade_amount_usd + gas):
            candidates.append((net_id, ratio))

    if not candidates:
        # Fallback: re-check with relaxed rules, but still enforce 20x
        for net_id in NETWORK_IDS:
            gas = NETWORKS[net_id]["gas_fee"]
            ratio = gas / trade_amount_usd if trade_amount_usd > 0 else 1.0
            if ratio > GAS_RATIO_HARD_CAP:
                continue
            if wallets.get(net_id, 0) >= gas:
                return net_id, (
                    f"Fallback: {NETWORKS[net_id]['name']} "
                    f"(gas={ratio*100:.1f}% — balance insufficient for full trade)"
                )

        # Last resort: any network with funds (bypass 20x to avoid deadlock)
        for net_id in NETWORK_IDS:
            if wallets.get(net_id, 0) >= NETWORKS[net_id]["gas_fee"]:
                return net_id, f"Emergency: {NETWORKS[net_id]['name']} (20x rule bypassed — no viable network)"
        return "osmosis", "All networks depleted — forced Osmosis"

    # Sort by gas ratio (lowest first = cheapest)
    candidates.sort(key=lambda x: x[1])
    best = candidates[0]
    return best[0], f"Optimal: {NETWORKS[best[0]]['name']} (gas={best[1]*100:.2f}% of trade)"


def get_gas_fee(network: str) -> float:
    """Return the gas fee for a given network ID."""
    return NETWORKS.get(network, {}).get("gas_fee", 0.0)


def deduct_gas(wallets: dict[str, float], network: str) -> float:
    """Deduct gas fee from the network's wallet. Returns the fee deducted."""
    fee = get_gas_fee(network)
    if network in wallets and wallets[network] >= fee:
        wallets[network] = round(wallets[network] - fee, 2)
        return fee
    # If network can't cover gas, try any other network
    for net_id in NETWORK_IDS:
        if wallets.get(net_id, 0) >= fee:
            wallets[net_id] = round(wallets[net_id] - fee, 2)
            return fee
    return 0.0  # can't pay gas — shouldn't happen


def total_wallet_cash(wallets: dict[str, float]) -> float:
    """Sum all wallet balances."""
    return round(sum(wallets.values()), 2)


def wallet_summary(wallets: dict[str, float]) -> list[dict]:
    """Return a human-readable summary of wallet balances."""
    result = []
    total = total_wallet_cash(wallets)
    for net_id in NETWORK_IDS:
        balance = wallets.get(net_id, 0)
        pct = round(balance / total * 100, 1) if total > 0 else 0
        result.append({
            "network_id": net_id,
            "network_name": NETWORKS[net_id]["name"],
            "network_type": NETWORKS[net_id]["type"],
            "gas_fee": NETWORKS[net_id]["gas_fee"],
            "balance": balance,
            "percentage": pct,
        })
    return result
