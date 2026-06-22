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


def select_optimal_network(trade_amount_usd: float, wallets: dict[str, float]) -> tuple[str, str]:
    """Pick the best network for a trade based on gas/trade ratio and wallet balance.

    Rules:
    - trade < ₺20  → Osmosis only (₺0.02 gas = 0.1% of ₺20)
    - trade < ₺200 → Arbitrum preferred (₺0.10 gas = 0.05% of ₺200)
    - trade >= ₺200 → Ethereum viable (₺5 gas = 2.5% of ₺200, acceptable)
    - If preferred network lacks funds, fall back to the next one with enough balance.
    """
    gas_ratio_threshold = 0.02  # max 2% gas cost of trade amount is acceptable

    candidates: list[tuple[str, float]] = []
    for net_id in NETWORK_IDS:
        gas = NETWORKS[net_id]["gas_fee"]
        if trade_amount_usd <= 0:
            continue
        ratio = gas / trade_amount_usd
        balance = wallets.get(net_id, 0)
        if balance >= (trade_amount_usd + gas):
            candidates.append((net_id, ratio))

    if not candidates:
        # No single network can cover the trade — try to find any with funds
        for net_id in NETWORK_IDS:
            if wallets.get(net_id, 0) >= NETWORKS[net_id]["gas_fee"]:
                return net_id, f"Insufficient balance on optimal network — forced {NETWORKS[net_id]['name']}"
        return "osmosis", "All networks depleted — forced Osmosis"

    # Sort by gas ratio (lowest first = cheapest)
    candidates.sort(key=lambda x: x[1])

    # Prefer the cheapest network whose gas ratio is under threshold
    for net_id, ratio in candidates:
        if ratio <= gas_ratio_threshold:
            return net_id, f"Optimal: {NETWORKS[net_id]['name']} (gas={ratio*100:.2f}% of trade)"

    # All too expensive — pick cheapest anyway
    best = candidates[0]
    return best[0], f"High gas: {NETWORKS[best[0]]['name']} (gas={best[1]*100:.2f}% of trade — above 2% threshold)"


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
