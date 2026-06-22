import React, { useState, useEffect } from 'react';
import {
  Bot,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Target,
  BarChart3,
  Clock,
  Radio,
  Terminal,
  Shield,
  BookOpen,
  ShieldAlert,
  Sparkles,
  Newspaper,
  Gauge,
  RefreshCw
} from 'lucide-react';
import { AIAgent, BackendCEOStatus, TradingDiaryEntry, SentimentReport, PositionCap, WalletNetwork } from '../types';
import { TranslationSet } from '../translations';

const API_BASE = 'https://kefur-backend.onrender.com';

interface BackendAgent {
  id: string;
  name: string;
  pnl_percent: number;
  balance: number;
  uptime_minutes: number;
  win_rate: number;
  cash: number;
  wallets?: WalletNetwork[];
  recent_trades: {
    id: string;
    pair: string;
    side: string;
    price: number;
    quantity: number;
    pnl?: number;
    time: string;
  }[];
  trading_diary?: TradingDiaryEntry[];
}

const AGENT_META: Record<string, { character: string; strategy: string }> = {
  nexus: {
    character: 'High Frequency Scalper',
    strategy: 'Ultra-short time frame momentum scalping across BTC, ETH, SOL using order book imbalance detection and micro-structure analysis. Executes 40-60 trades per session.',
  },
  oracle: {
    character: 'Swing Trader',
    strategy: 'Multi-day position swings driven by on-chain whale wallet tracking, social sentiment NLP, and macro trend correlation. Averages 5-8 trades per week with 3:1 risk/reward ratio.',
  },
  sentinel: {
    character: 'Arbitrage Hunter',
    strategy: 'Cross-exchange & cross-pair triangular arbitrage. Scans 12 DEX and CEX order books simultaneously. Mean execution latency 340ms. Targets 0.3-1.2% spreads.',
  },
};

function formatUptime(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function mapBackendAgent(raw: BackendAgent): AIAgent {
  const meta = AGENT_META[raw.id] ?? { character: 'Autonomous Agent', strategy: '' };
  const totalPnl = (raw.pnl_percent / 100) * raw.balance;
  const trades = raw.recent_trades.map((t) => ({
    id: t.id,
    type: t.side === 'LONG' ? ('buy' as const) : ('sell' as const),
    asset: t.pair.split('/')[0],
    quantity: t.quantity ?? 0,
    price: t.price ?? 0,
    timestamp: new Date(t.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    pnl: t.pnl as number | undefined,
  }));
  const markets = [...new Set(raw.recent_trades.map((t) => t.pair))];

  let status: AIAgent['status'] = 'idle';
  let statusText = 'Beklemede';
  if (raw.pnl_percent > 5 && raw.win_rate > 55) {
    status = 'trading';
    statusText = `İşlemde: ${markets[0] ?? 'Piyasa'} taranıyor`;
  } else if (raw.win_rate > 60) {
    status = 'analyzing';
    statusText = `Analiz Ediyor: ${markets[0] ?? 'Piyasa'} korelasyonu taranıyor`;
  } else if (raw.pnl_percent < 0) {
    status = 'cooldown';
    statusText = 'Beklemede: Spread eşik altında';
  }

  return {
    id: raw.id,
    name: raw.name,
    character: meta.character,
    strategy: meta.strategy,
    status,
    statusText,
    totalPnl: Math.round(totalPnl * 100) / 100,
    pnlPercent: raw.pnl_percent,
    managedBalance: raw.balance,
    winRate: raw.win_rate,
    totalTrades: raw.recent_trades.length * 100 + raw.recent_trades.length * 3,
    recentTransactions: trades,
    activeMarkets: markets,
    uptime: formatUptime(raw.uptime_minutes),
  };
}

const STATUS_CONFIG: Record<AIAgent['status'], { dotClass: string; textColor: string; bgClass: string; borderClass: string }> = {
  trading: {
    dotClass: 'animate-pulse-green',
    textColor: 'text-emerald-400',
    bgClass: 'bg-emerald-500/5',
    borderClass: 'border-emerald-500/20'
  },
  analyzing: {
    dotClass: 'animate-pulse-glow',
    textColor: 'text-amber-400',
    bgClass: 'bg-amber-500/5',
    borderClass: 'border-amber-500/20'
  },
  idle: {
    dotClass: 'animate-pulse-gray',
    textColor: 'text-white/40',
    bgClass: 'bg-white/5',
    borderClass: 'border-white/10'
  },
  cooldown: {
    dotClass: 'animate-pulse-gray',
    textColor: 'text-white/40',
    bgClass: 'bg-white/5',
    borderClass: 'border-white/10'
  }
};

const STATUS_LABELS: Record<AIAgent['status'], { en: string; tr: string }> = {
  trading: { en: 'Trading', tr: 'İşlemde' },
  analyzing: { en: 'Analyzing', tr: 'Analiz Ediyor' },
  idle: { en: 'Idle', tr: 'Beklemede' },
  cooldown: { en: 'Cooldown', tr: 'Dinlenmede' }
};

interface Props {
  lang: 'en' | 'tr';
  t: TranslationSet;
}

export default function AIAgentsDashboard({ lang, t }: Props) {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [rawBackendAgents, setRawBackendAgents] = useState<BackendAgent[]>([]);
  const [ceoStatus, setCeoStatus] = useState<BackendCEOStatus | null>(null);
  const [sentimentReport, setSentimentReport] = useState<SentimentReport | null>(null);
  const [positionCaps, setPositionCaps] = useState<Record<string, PositionCap>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let isFirst = true;

    async function fetchAgents() {
      try {
        if (isFirst) {
          // Silent — don't set any loading state on initial mount,
          // the isInitialLoad flag already shows the spinner.
        } else {
          setIsRefreshing(true);
        }
        setError(null);
        const res = await fetch(`${API_BASE}/api/agents`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const rawAgents = data.agents as BackendAgent[];
        setRawBackendAgents(rawAgents);
        setAgents(rawAgents.map(mapBackendAgent));
        if (data.ceo_status) {
          setCeoStatus(data.ceo_status as BackendCEOStatus);
        }
        if (data.sentiment) {
          setSentimentReport(data.sentiment as SentimentReport);
        }
        if (data.position_caps) {
          setPositionCaps(data.position_caps as Record<string, PositionCap>);
        }
        if (isFirst) {
          setIsInitialLoad(false);
          isFirst = false;
        }
      } catch (e) {
        if (!cancelled && isFirst) {
          setError(e instanceof Error ? e.message : 'Unknown error');
          setIsInitialLoad(false);
        }
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Initial load: full-screen spinner ──────────────────────────────────
  if (isInitialLoad && agents.length === 0 && !error) {
    return (
      <div className="flex flex-col gap-4.5 animate-fade-in" id="kefur-agents-screen">
        <div className="border-b border-white/10 pb-3">
          <h1 className="text-lg font-light font-serif italic text-white text-left tracking-tight">
            {t.aiTradingAgents}
          </h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
              {lang === 'tr' ? 'Ajanlar yükleniyor...' : 'Loading agents...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error || agents.length === 0) {
    return (
      <div className="flex flex-col gap-4.5 animate-fade-in" id="kefur-agents-screen">
        <div className="border-b border-white/10 pb-3">
          <h1 className="text-lg font-light font-serif italic text-white text-left tracking-tight">
            {t.aiTradingAgents}
          </h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <Shield className="w-10 h-10 text-rose-400/50" />
            <p className="text-sm font-mono text-rose-400">
              {lang === 'tr' ? 'Backend sunucusuna bağlanılamadı' : 'Cannot connect to backend server'}
            </p>
            <p className="text-[10px] text-white/30 font-mono">
              {error ?? (lang === 'tr' ? 'Sunucu yanıt vermedi' : 'No response from server')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4.5 animate-fade-in" id="kefur-agents-screen">
      {/* Header with Total PnL + Silent Refresh Indicator */}
      <div className="border-b border-white/10 pb-3" id="agents-header">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-light font-serif italic text-white text-left tracking-tight">
              {t.aiTradingAgents}
            </h1>
            <p className="text-[9px] text-white/40 font-mono uppercase tracking-[0.25em] leading-none mt-1">
              {t.autonomousAgents}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Total Portfolio PnL */}
            {agents.length > 0 && (() => {
              const totalPnl = agents.reduce((sum, a) => sum + a.totalPnl, 0);
              const totalPnlPct = agents.reduce((sum, a) => sum + a.pnlPercent, 0);
              const isProfitable = totalPnl >= 0;
              return (
                <div className={`flex flex-col items-end ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className="text-[12px] font-bold font-mono tracking-tight">
                    {isProfitable ? '+' : ''}₺{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[8px] font-mono opacity-80">
                    ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)
                  </span>
                </div>
              );
            })()}
            {/* Silent Refresh Indicator */}
            <div className="w-6 h-6 flex items-center justify-center">
              {isRefreshing ? (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400/70 animate-spin" />
              ) : agents.length > 0 ? (
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400/60"></span>
                  <span className="text-[7px] text-emerald-400/40 font-mono uppercase">Live</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* CEO Macro Status Banner */}
      {ceoStatus && (
        <div className={`rounded-xl border p-3.5 flex flex-col gap-2 ${
          ceoStatus.risk_level === 'HIGH' ? 'bg-rose-500/5 border-rose-500/20' :
          ceoStatus.risk_level === 'LOW' ? 'bg-emerald-500/5 border-emerald-500/20' :
          'bg-amber-500/5 border-amber-500/20'
        }`} id="ceo-status-banner">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-400" />
            <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-white/60">
              CEO Directive
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse-glow inline-block"></span>
              <span className="text-[8px] text-purple-400/70 font-mono uppercase">Orchestrating</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${
              ceoStatus.sentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              ceoStatus.sentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
              'bg-amber-400/10 text-amber-400 border-amber-400/20'
            }`}>
              {ceoStatus.sentiment}
            </span>
            <span className="text-[9px] text-white/30 font-mono">|</span>
            <span className={`text-[9px] font-bold font-mono uppercase ${
              ceoStatus.risk_level === 'LOW' ? 'text-emerald-400' :
              ceoStatus.risk_level === 'HIGH' ? 'text-rose-400' :
              'text-amber-400'
            }`}>
              Risk: {ceoStatus.risk_level}
            </span>
            <span className="text-[9px] text-white/30 font-mono">|</span>
            <span className="text-[8px] text-white/40 font-mono">
              Active: {ceoStatus.active_agents.map(id => id.charAt(0).toUpperCase() + id.slice(1)).join(', ')}
            </span>
          </div>
          <p className="text-[9px] text-white/50 font-sans leading-relaxed">
            {ceoStatus.guidance}
          </p>

          {/* Breaking News Sentiment in CEO Banner */}
          {sentimentReport && sentimentReport.top_headline && (
            <div className={`rounded-lg border p-2.5 flex flex-col gap-1.5 ${
              sentimentReport.overall_sentiment === 'BULLISH' ? 'border-emerald-500/20 bg-emerald-500/[0.03]' :
              sentimentReport.overall_sentiment === 'BEARISH' ? 'border-rose-500/20 bg-rose-500/[0.03]' :
              'border-amber-500/20 bg-amber-500/[0.03]'
            }`}>
              <div className="flex items-center gap-1.5">
                <Newspaper className={`w-3 h-3 ${
                  sentimentReport.overall_sentiment === 'BULLISH' ? 'text-emerald-400' :
                  sentimentReport.overall_sentiment === 'BEARISH' ? 'text-rose-400' :
                  'text-amber-400'
                }`} />
                <span className="text-[7px] font-bold font-mono uppercase tracking-[0.15em] text-white/40">
                  {lang === 'tr' ? 'Haber Duyarlılığı' : 'News Sentiment'}
                </span>
                <span className={`ml-auto text-[7px] font-bold font-mono uppercase px-1 py-0.5 rounded border ${
                  sentimentReport.overall_sentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  sentimentReport.overall_sentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                  'bg-amber-400/10 text-amber-400 border-amber-400/20'
                }`}>
                  {sentimentReport.overall_sentiment} {sentimentReport.overall_score > 0 ? '+' : ''}{sentimentReport.overall_score}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className={`text-[6px] font-bold font-mono uppercase px-1 py-0.5 rounded shrink-0 mt-0.5 ${
                  sentimentReport.top_impact === 'BULLISH' ? 'bg-emerald-500/15 text-emerald-400' :
                  sentimentReport.top_impact === 'BEARISH' ? 'bg-rose-500/15 text-rose-400' :
                  'bg-white/10 text-white/40'
                }`}>
                  {sentimentReport.top_impact}
                </span>
                <p className="text-[9px] text-white/60 font-sans leading-relaxed">
                  {sentimentReport.top_headline}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Cards */}
      <div className="flex flex-col gap-4" id="agents-list">
        {agents.map((agent) => {
          const config = STATUS_CONFIG[agent.status];
          const statusLabel = lang === 'tr' ? STATUS_LABELS[agent.status].tr : STATUS_LABELS[agent.status].en;

          return (
            <div
              key={agent.id}
              className={`rounded-2xl border ${config.borderClass} ${config.bgClass} p-4.5 flex flex-col gap-3.5 transition`}
              id={`agent-card-${agent.id}`}
            >
              {/* Top Row: Identity + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white/70" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono tracking-wider">
                        {agent.name}
                      </span>
                      <span className="text-[10px] text-white/40 font-serif italic">
                        — {agent.character}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/30 font-mono uppercase tracking-[0.1em] mt-0.5 max-w-[280px] leading-relaxed line-clamp-2">
                      {agent.strategy}
                    </p>
                  </div>
                </div>

                {/* Live Status Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`relative flex h-2.5 w-2.5 ${config.dotClass}`}>
                    <span className={`absolute inline-flex h-full w-full rounded-full ${
                      agent.status === 'trading' ? 'bg-emerald-400' :
                      agent.status === 'analyzing' ? 'bg-amber-400' :
                      'bg-white/30'
                    }`}></span>
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      agent.status === 'trading' ? 'bg-emerald-400' :
                      agent.status === 'analyzing' ? 'bg-amber-400' :
                      'bg-white/30'
                    }`}></span>
                  </span>
                  <span className={`text-[9px] font-bold font-mono uppercase tracking-[0.15em] ${config.textColor}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* Status Description Bar */}
              <div className={`rounded-lg border ${config.borderClass} px-3 py-2 flex items-center gap-2`}>
                <Activity className={`w-3.5 h-3.5 ${config.textColor}`} />
                <span className={`text-[10px] font-mono ${config.textColor} animate-blink`}>
                  {agent.statusText}
                </span>
              </div>

              {/* Dynamic Position Cap Indicator */}
              {positionCaps[agent.id] && (() => {
                const cap = positionCaps[agent.id];
                const capPct = cap.cap_pct;
                const isCapped = capPct < 100;
                const capColor = capPct <= 25
                  ? { border: 'border-rose-500/20', bg: 'bg-rose-500/5', text: 'text-rose-400', bar: 'bg-rose-500/40' }
                  : capPct <= 50
                  ? { border: 'border-amber-500/20', bg: 'bg-amber-500/5', text: 'text-amber-400', bar: 'bg-amber-400/40' }
                  : { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', bar: 'bg-emerald-400/40' };

                const isInactive = capPct === 0;

                return (
                  <div className={`rounded-lg border ${capColor.border} ${capColor.bg} px-3 py-2 flex flex-col gap-1.5`}>
                    <div className="flex items-center gap-2">
                      <Gauge className={`w-3.5 h-3.5 ${capColor.text}`} />
                      <span className={`text-[8px] font-bold font-mono uppercase tracking-[0.1em] ${capColor.text}`}>
                        {lang === 'tr' ? 'Risk Kapasitesi' : 'Dynamic Risk Cap'}
                      </span>
                      <span className={`ml-auto text-[9px] font-bold font-mono ${capColor.text}`}>
                        {isInactive ? (lang === 'tr' ? 'Kapalı' : 'Inactive') : `%${capPct} Capital`}
                      </span>
                    </div>
                    {/* Cap progress bar */}
                    {!isInactive && (
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${capColor.bar}`}
                          style={{ width: `${Math.max(capPct, 5)}%` }}
                        />
                      </div>
                    )}
                    <p className={`text-[8px] font-mono leading-relaxed ${isInactive ? 'text-white/25' : 'text-white/45'}`}>
                      {isInactive
                        ? (lang === 'tr' ? 'CEO bu ajanı pasif bıraktı' : 'Paused by CEO directive')
                        : cap.reason}
                    </p>
                  </div>
                );
              })()}

              {/* Performance Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricBadge
                  icon={<TrendingUp className="w-3.5 h-3.5" />}
                  label={t.pnl}
                  value={`${agent.pnlPercent >= 0 ? '+' : ''}${agent.pnlPercent}%`}
                  valueColor={agent.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                  sub={`₺${agent.totalPnl.toLocaleString()}`}
                  subColor={agent.totalPnl >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}
                />
                <MetricBadge
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  label={t.managedBalance}
                  value={`₺${(agent.managedBalance / 1000).toFixed(1)}K`}
                  valueColor="text-white"
                  sub={undefined}
                  subColor={undefined}
                />
                <MetricBadge
                  icon={<Target className="w-3.5 h-3.5" />}
                  label={t.winRate}
                  value={`${agent.winRate}%`}
                  valueColor="text-white"
                  sub={`${agent.totalTrades} ${lang === 'tr' ? 'işlem' : 'trades'}`}
                  subColor="text-white/40"
                />
                <MetricBadge
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label={t.uptime}
                  value={agent.uptime}
                  valueColor="text-white"
                  sub={undefined}
                  subColor={undefined}
                />
              </div>

              {/* Multi-Chain Network Distribution */}
              {(() => {
                const rawAgent = rawBackendAgents.find(ra => ra.id === agent.id);
                const wallets = rawAgent?.wallets;
                if (!wallets || wallets.length === 0) return null;

                const networkColors: Record<string, { dot: string; bar: string; label: string }> = {
                  ethereum: { dot: 'bg-blue-400', bar: 'bg-blue-500/40', label: 'text-blue-400' },
                  arbitrum: { dot: 'bg-emerald-400', bar: 'bg-emerald-500/40', label: 'text-emerald-400' },
                  osmosis: { dot: 'bg-purple-400', bar: 'bg-purple-500/40', label: 'text-purple-400' },
                };

                return (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
                      <Radio className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-[8px] font-bold font-mono uppercase tracking-[0.15em] text-white/40">
                        {lang === 'tr' ? 'Ağ Dağılımı' : 'Network Distribution'}
                      </span>
                      <span className="ml-auto text-[7px] text-white/20 font-mono">
                        {lang === 'tr' ? 'Gas dahil' : 'incl. gas'}
                      </span>
                    </div>
                    <div className="px-3 py-2.5 flex flex-col gap-2">
                      {wallets.map((w: WalletNetwork) => {
                        const colors = networkColors[w.network_id] ?? networkColors.ethereum;
                        return (
                          <div key={w.network_id} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-white/60">
                                  {w.network_name}
                                </span>
                                <span className="text-[9px] font-bold font-mono text-white/70">
                                  ${w.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                                    style={{ width: `${Math.max(w.percentage, 3)}%` }}
                                  />
                                </div>
                                <span className="text-[7px] font-mono text-white/25 w-10 text-right">
                                  {w.percentage}%
                                </span>
                                <span className="text-[7px] font-mono text-white/15 w-12 text-right">
                                  gas ${w.gas_fee.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Active Markets */}
              <div className="flex items-center gap-2 flex-wrap">
                <Radio className="w-3 h-3 text-white/30" />
                <span className="text-[9px] text-white/30 font-mono uppercase tracking-wider">
                  {t.activeMarkets}:
                </span>
                {agent.activeMarkets.map((m) => (
                  <span
                    key={m}
                    className="text-[8px] font-bold font-mono text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded"
                  >
                    {m}
                  </span>
                ))}
              </div>

              {/* Recent Transaction Log */}
              <div className="rounded-xl border border-white/10 bg-[#050505] overflow-hidden" id={`tx-log-${agent.id}`}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
                  <Terminal className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-white/40">
                    {t.recentActivity}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/60 animate-pulse-green inline-block"></span>
                    <span className="text-[8px] text-white/30 font-mono uppercase">Live</span>
                  </span>
                </div>
                <div className="px-3 py-2" id={`tx-log-body-${agent.id}`}>
                  {agent.recentTransactions.map((tx) => {
                    const isBuy = tx.type === 'buy';
                    return (
                      <div key={tx.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-b-0 text-[10px] font-mono">
                        <span className={`w-7 font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                        <span className="text-white/70 font-medium w-10">{tx.asset}</span>
                        <span className="text-white/30 w-10 text-right">{tx.quantity}</span>
                        <span className="text-white/30">@</span>
                        <span className="text-white/50 w-20 text-right">₺{tx.price.toLocaleString()}</span>
                        <span className="text-white/20 ml-auto text-[9px]">{tx.timestamp}</span>
                        {tx.pnl != null && (
                          <span className={`font-bold ${tx.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tx.pnl >= 0 ? '+' : ''}₺{tx.pnl!.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trading Diary / Self-Reflection Section */}
              {(() => {
                const rawAgent = rawBackendAgents.find(ra => ra.id === agent.id);
                const diaryEntries = rawAgent?.trading_diary || [];
                if (diaryEntries.length === 0) return null;

                const recentDiary = diaryEntries.slice(0, 3);
                return (
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 overflow-hidden" id={`diary-${agent.id}`}>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-500/20 bg-purple-500/[0.03]">
                      <BookOpen className="w-3.5 h-3.5 text-purple-400/70" />
                      <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-purple-400/70">
                        {lang === 'tr' ? 'YZ Günlüğü' : 'AI Diary'}
                      </span>
                      <span className="ml-auto flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-400/60" />
                        <span className="text-[8px] text-purple-400/50 font-mono uppercase">
                          {lang === 'tr' ? 'Öz-Yansıtma' : 'Self-Reflection'}
                        </span>
                      </span>
                    </div>
                    <div className="px-3 py-2 flex flex-col gap-2" id={`diary-body-${agent.id}`}>
                      {recentDiary.map((entry, idx) => {
                        const isCriticism = entry.trigger === 'SELF_CRITICISM';
                        const isStopLoss = entry.trigger === 'STOP_LOSS';
                        const isProfit = entry.success;

                        const borderClass = isCriticism
                          ? 'border-purple-500/15'
                          : isStopLoss
                          ? 'border-rose-500/15'
                          : isProfit
                          ? 'border-emerald-500/15'
                          : 'border-amber-500/15';

                        const icon = isCriticism
                          ? <ShieldAlert className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                          : isStopLoss
                          ? <TrendingDown className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                          : isProfit
                          ? <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          : <TrendingDown className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />;

                        const titleText = isCriticism
                          ? (lang === 'tr' ? 'Öz-Eleştiri' : 'Self-Criticism')
                          : isStopLoss
                          ? (lang === 'tr' ? 'Stop-Loss' : 'Stop-Loss')
                          : isProfit
                          ? (lang === 'tr' ? 'Kârlı Kapanış' : 'Profitable Close')
                          : (lang === 'tr' ? 'Zararlı Kapanış' : 'Loss Close');

                        const titleColor = isCriticism
                          ? 'text-purple-400'
                          : isStopLoss
                          ? 'text-rose-400'
                          : isProfit
                          ? 'text-emerald-400'
                          : 'text-amber-400';

                        return (
                          <div key={`diary-${idx}`} className={`rounded-lg border ${borderClass} bg-[#050505] p-2.5 flex flex-col gap-1.5`}>
                            <div className="flex items-center gap-2">
                              {icon}
                              <span className={`text-[8px] font-bold font-mono uppercase tracking-[0.1em] ${titleColor}`}>
                                {titleText}
                              </span>
                              {!isCriticism && entry.pair && (
                                <>
                                  <span className="text-[8px] text-white/30 font-mono">{entry.pair}</span>
                                  <span className={`ml-auto text-[8px] font-bold font-mono ${(entry.pnl_usd ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {(entry.pnl_usd ?? 0) >= 0 ? '+' : ''}{(entry.pnl_usd ?? 0).toFixed(2)} ({(entry.pnl_percent ?? 0) >= 0 ? '+' : ''}{entry.pnl_percent ?? 0}%)
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-[9px] text-white/50 font-sans leading-relaxed line-clamp-2">
                              {entry.reason}
                            </p>
                            <span className="text-[7px] text-white/20 font-mono">
                              {new Date(entry.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Performance Summary Footer */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div>
            <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-white/50">
              {t.agentPerformance}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {(() => {
                const sumPnl = agents.reduce((s, a) => s + a.totalPnl, 0);
                const sumPct = agents.reduce((s, a) => s + a.pnlPercent, 0);
                const isProfitable = sumPnl >= 0;
                return (
                  <>
                    <span className={`text-lg font-bold font-mono ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfitable ? '+' : ''}₺{Math.abs(sumPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[10px] font-mono ${isProfitable ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                      ({sumPct >= 0 ? '+' : ''}{sumPct.toFixed(1)}%)
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-white/30">
          <span>{agents.length} {lang === 'tr' ? 'Aktif Ajan' : 'Active Agents'}</span>
          <span className="text-white/10">|</span>
          <span>{agents.reduce((sum, a) => sum + a.totalTrades, 0)} {lang === 'tr' ? 'Toplam İşlem' : 'Total Trades'}</span>
        </div>
      </div>

      {/* Developer Note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <Shield className="w-3.5 h-3.5 text-white/20 shrink-0 mt-0.5" />
        <p className="text-[9px] text-white/30 font-mono uppercase leading-relaxed tracking-[0.06em]">
          {lang === 'tr'
            ? 'Bu ajanlar şu anda simülasyon modunda çalışmaktadır. Gerçek fonlar risk altında değildir. Performans verileri canlı piyasa simülasyonlarına dayanmaktadır.'
            : 'These agents are currently running in simulation mode. No real funds are at risk. Performance data is based on live market simulations.'
          }
        </p>
      </div>
    </div>
  );
}

function MetricBadge({ icon, label, value, valueColor, sub, subColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/30">
        {icon}
        <span className="text-[8px] font-mono uppercase tracking-[0.1em]">{label}</span>
      </div>
      <span className={`text-sm font-bold font-mono tracking-tight ${valueColor}`}>{value}</span>
      {sub && (
        <span className={`text-[9px] font-mono ${subColor || 'text-white/30'}`}>{sub}</span>
      )}
    </div>
  );
}
