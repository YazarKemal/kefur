export interface Asset {
  symbol: string;
  name: string;
  category: 'stock' | 'crypto';
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  history: number[]; // Sparkline or chart values (e.g. last 30 data points)
  description: string;
}

export interface GroundingResource {
  title: string;
  uri: string;
}

export interface AISentiment {
  symbol: string;
  sentimentScore: number; // 0 (Extremely Bearish) to 100 (Extremely Bullish)
  sentimentLabel: 'Bullish' | 'Bearish' | 'Neutral' | 'Strongly Bullish' | 'Strongly Bearish';
  summary: string;
  keyFactors: string[];
  predictionRange: string;
  sources: GroundingResource[];
  compiledAt: string;
}

export interface MarketSummary {
  fearGreedIndex: number;
  fearGreedLabel: string;
  globalSentiment: string;
  topGainerSymbol: string;
  topLoserSymbol: string;
}

export interface BackendCEOStatus {
  sentiment: string;
  risk_level: string;
  active_agents: string[];
  guidance: string;
}

export interface AssetInsight {
  symbol: string;
  price: number;
  rsi: number | null;
  sma_7: number | null;
  sma_14: number | null;
  trend: string;
  sentiment: string;
}

export interface SentimentHeadline {
  headline: string;
  impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;
  reasoning: string;
}

export interface SentimentReport {
  overall_sentiment: string;
  overall_score: number;
  top_headline: string;
  top_impact: string;
  analysis: string;
  headlines: SentimentHeadline[];
  fetched_at: string;
}

export interface PositionCap {
  cap_pct: number;
  cap_multiplier: number;
  reason: string;
  asset_volatility: number;
}

export interface WalletNetwork {
  network_id: string;
  network_name: string;
  network_type: string;
  gas_fee: number;
  balance: number;
  percentage: number;
}

export interface BackendInsights {
  ceo: BackendCEOStatus | null;
  sentiment?: SentimentReport | null;
  market: {
    prices: Record<string, number>;
    indicators: Record<string, {
      price: number;
      sma_7: number | null;
      sma_14: number | null;
      rsi: number | null;
      trend: string;
    }>;
    history_depth: number;
  };
  asset_insights: AssetInsight[];
  fear_greed: {
    index: number;
    label: string;
  };
  updated_at: string;
}

export type AgentStatus = 'idle' | 'analyzing' | 'trading' | 'cooldown';

export interface TradingDiaryEntry {
  trade_id: string;
  pair: string;
  side: string;
  asset: string;
  quantity: number;
  price: number;
  pnl_usd: number;
  pnl_percent: number;
  reason: string;
  success: boolean;
  trigger: 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'SELF_CRITICISM';
  time: string;
}

export interface AgentTransaction {
  id: string;
  type: 'buy' | 'sell';
  asset: string;
  quantity: number;
  price: number;
  timestamp: string;
  pnl?: number;
}

export interface AIAgent {
  id: string;
  name: string;
  character: string;
  strategy: string;
  status: AgentStatus;
  statusText: string;
  totalPnl: number;
  pnlPercent: number;
  managedBalance: number;
  winRate: number;
  totalTrades: number;
  recentTransactions: AgentTransaction[];
  activeMarkets: string[];
  uptime: string;
}
