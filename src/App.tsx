import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  Gauge,
  Newspaper,
  BookOpen,
  Globe,
  Bell,
  BellOff,
  PlusCircle,
  ShieldAlert,
  Bot,
  X
} from 'lucide-react';
import { Asset, MarketSummary, AISentiment, BackendInsights, TradingDiaryEntry } from './types';
import { INITIAL_ASSETS } from './mockData';
import MobileFrame from './components/MobileFrame';
import TrendChart from './components/TrendChart';
import SentimentGauge from './components/SentimentGauge';
import AIAgentsDashboard from './components/AIAgentsDashboard';
import { translations } from './translations';

type Tab = 'dashboard' | 'ai-insights' | 'agents';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(() => {
    // Live prices come from backend — never use stale localStorage cache
    return INITIAL_ASSETS;
  });

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('kefur_watchlist');
    return saved ? JSON.parse(saved) : ['BTC', 'AAPL', 'SOL'];
  });

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'stock' | 'crypto'>('all');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  // TR/EN Language states
  const [lang, setLang] = useState<'en' | 'tr'>(() => {
    const saved = localStorage.getItem('kefur_lang');
    return saved === 'tr' ? 'tr' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('kefur_lang', lang);
  }, [lang]);

  const t = translations[lang];

  // Global price and asset formatting helper
  const formatPrice = (val: number, symbol: string) => {
    if (lang === 'en') {
      if (symbol === 'BIST100') {
        return `${val.toLocaleString()} TL`;
      }
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const finalVal = symbol === 'BIST100' ? val : val * 34;
      return `₺${finalVal.toLocaleString(undefined, { 
        minimumFractionDigits: symbol === 'BIST100' ? 0 : 2, 
        maximumFractionDigits: symbol === 'BIST100' ? 0 : 2 
      })}`;
    }
  };

  // Virtual Portfolio / Paper Trading state variables
  const [portfolioCash, setPortfolioCash] = useState<number>(() => {
    const saved = localStorage.getItem('kefur_portfolio_cash');
    return saved ? Number(saved) : 100000; // ₺100,000 USD base
  });

  const [portfolioHoldings, setPortfolioHoldings] = useState<Record<string, { quantity: number; avgBuyPrice: number }>>(() => {
    const saved = localStorage.getItem('kefur_portfolio_holdings');
    return saved ? JSON.parse(saved) : {};
  });

  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [tradeError, setTradeError] = useState<string>('');
  const [tradeSuccess, setTradeSuccess] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('kefur_portfolio_cash', portfolioCash.toString());
  }, [portfolioCash]);

  useEffect(() => {
    localStorage.setItem('kefur_portfolio_holdings', JSON.stringify(portfolioHoldings));
  }, [portfolioHoldings]);

  useEffect(() => {
    setTradeAmount('');
    setTradeError('');
    setTradeSuccess('');
  }, [selectedAsset]);

  // Mock Price Alerts states
  const [alerts, setAlerts] = useState<Record<string, { targetPrice: number; active: boolean }>>(() => {
    const saved = localStorage.getItem('kefur_alerts');
    return saved ? JSON.parse(saved) : {};
  });
  const [alertInputs, setAlertInputs] = useState<Record<string, string>>({});
  const [activeAlertAsset, setActiveAlertAsset] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('kefur_alerts', JSON.stringify(alerts));
  }, [alerts]);

  // Visual in-app notifications
  const [notifications, setNotifications] = useState<{ id: string; titleEn: string; textEn: string; titleTr: string; textTr: string; createdAt: number }[]>([]);

  useEffect(() => {
    if (notifications.length === 0) return;
    const oldest = notifications[notifications.length - 1];
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== oldest.id));
    }, 6000);
    return () => clearTimeout(timer);
  }, [notifications]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const saveAlert = (symbol: string, currentPrice: number) => {
    const targetPrice = parseFloat(alertInputs[symbol]);
    if (isNaN(targetPrice) || targetPrice <= 0) return;
    
    setAlerts(prev => ({
      ...prev,
      [symbol]: { targetPrice, active: true }
    }));
    setActiveAlertAsset(null);
  };

  const clearAlert = (symbol: string) => {
    setAlerts(prev => {
      const copy = { ...prev };
      delete copy[symbol];
      return copy;
    });
    setAlertInputs(prev => ({ ...prev, [symbol]: '' }));
    setActiveAlertAsset(null);
  };

  // Buy and Sell trading execution triggers
  const handleBuy = () => {
    if (!selectedAsset) return;
    const qty = parseFloat(tradeAmount);
    if (isNaN(qty) || qty <= 0) {
      setTradeError(t.invalidAmount);
      setTradeSuccess('');
      return;
    }
    const cost = qty * selectedAsset.price;
    if (cost > portfolioCash) {
      setTradeError(t.insufficientFunds);
      setTradeSuccess('');
      return;
    }
    setPortfolioCash(prev => prev - cost);
    setPortfolioHoldings(prev => {
      const current = prev[selectedAsset.symbol];
      const newQty = current ? current.quantity + qty : qty;
      const newAvg = current ? (current.avgBuyPrice * current.quantity + selectedAsset.price * qty) / newQty : selectedAsset.price;
      return {
        ...prev,
        [selectedAsset.symbol]: { quantity: newQty, avgBuyPrice: newAvg }
      };
    });
    setTradeError('');
    setTradeSuccess(lang === 'en' ? `Bought ${qty} ${selectedAsset.symbol}!` : `${qty} adet ${selectedAsset.symbol} satın alındı!`);
    setTradeAmount('');
  };

  const handleSell = () => {
    if (!selectedAsset) return;
    const qty = parseFloat(tradeAmount);
    if (isNaN(qty) || qty <= 0) {
      setTradeError(t.invalidAmount);
      setTradeSuccess('');
      return;
    }
    const current = portfolioHoldings[selectedAsset.symbol];
    if (!current || current.quantity < qty) {
      setTradeError(t.insufficientHoldings);
      setTradeSuccess('');
      return;
    }
    const revenue = qty * selectedAsset.price;
    setPortfolioCash(prev => prev + revenue);
    setPortfolioHoldings(prev => {
      const copy = { ...prev };
      const newQty = current.quantity - qty;
      if (newQty <= 0.000001) {
        delete copy[selectedAsset.symbol];
      } else {
        copy[selectedAsset.symbol] = {
          ...current,
          quantity: newQty
        };
      }
      return copy;
    });
    setTradeError('');
    setTradeSuccess(lang === 'en' ? `Sold ${qty} ${selectedAsset.symbol}!` : `${qty} adet ${selectedAsset.symbol} satıldı!`);
    setTradeAmount('');
  };

  // Track previous prices to detect crossings
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    assets.forEach(asset => {
      const prevPrice = prevPricesRef.current[asset.symbol];
      const currentPrice = asset.price;
      if (prevPrice && prevPrice !== currentPrice) {
        const alert = alerts[asset.symbol];
        if (alert && alert.active) {
          // Check crossing
          const crossedAbove = prevPrice <= alert.targetPrice && currentPrice >= alert.targetPrice;
          const crossedBelow = prevPrice >= alert.targetPrice && currentPrice <= alert.targetPrice;
          
          if (crossedAbove || crossedBelow) {
            setAlerts(prev => ({
              ...prev,
              [asset.symbol]: { ...prev[asset.symbol], active: false }
            }));
            
            const id = Math.random().toString();
            const titleEn = `🔔 Price Alert Triggered`;
            const textEn = `${asset.symbol} crossed your target of ${formatPrice(alert.targetPrice, asset.symbol)} (Current: ${formatPrice(currentPrice, asset.symbol)})`;
            const titleTr = `🔔 Fiyat Alarmı Tetiklendi`;
            const textTr = `${asset.symbol} alarm hedefiniz olan ${formatPrice(alert.targetPrice, asset.symbol)} değerini aştı (Güncel: ${formatPrice(currentPrice, asset.symbol)})`;
            
            setNotifications(prev => [
              { id, titleEn, textEn, titleTr, textTr, createdAt: Date.now() },
              ...prev
            ]);
          }
        }
      }
      prevPricesRef.current[asset.symbol] = currentPrice;
    });
  }, [assets, alerts, lang]);
  
  // Market summary stats
  const [marketSummary, setMarketSummary] = useState<MarketSummary>({
    fearGreedIndex: 72,
    fearGreedLabel: 'Greed',
    globalSentiment: 'Broad index accumulation remains the primary driver. Crypto-sentiments point toward high accumulation phases.',
    topGainerSymbol: 'SOL',
    topLoserSymbol: 'TSLA'
  });

  // Live backend insights (CEO + market + fear/greed)
  const [insightsData, setInsightsData] = useState<BackendInsights | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchInsights() {
      try {
        const res = await fetch('https://kefur-backend.onrender.com/api/insights');
        if (!res.ok) return;
        const data: BackendInsights = await res.json();
        if (cancelled) return;
        setInsightsData(data);
        setMarketSummary({
          fearGreedIndex: data.fear_greed.index,
          fearGreedLabel: data.fear_greed.label,
          globalSentiment: data.ceo?.guidance ?? 'Live AI market analysis streaming...',
          topGainerSymbol: 'SOL',
          topLoserSymbol: 'TSLA',
        });
        // Sync crypto asset prices with live backend data
        if (data.market?.prices) {
          setAssets(prev => prev.map(a => {
            const livePrice = data.market.prices[a.symbol];
            if (livePrice && livePrice > 0) {
              const oldPrice = a.price;
              const change24h = oldPrice > 0 ? ((livePrice - oldPrice) / oldPrice) * 100 + a.change24h : a.change24h;
              return { ...a, price: livePrice, change24h: Number(change24h.toFixed(2)) };
            }
            return a;
          }));
        }
      } catch {
        // Backend offline — keep defaults
      }
    }
    fetchInsights();
    const interval = setInterval(fetchInsights, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Agent trading diary data for AI Insights tab
  const [agentDiaryData, setAgentDiaryData] = useState<{
    agents: { id: string; name: string; trading_diary: TradingDiaryEntry[] }[];
  } | null>(null);

  const [diaryFilter, setDiaryFilter] = useState<'all' | 'profits' | 'losses' | 'criticism'>('all');

  const mergedDiaryEntries = agentDiaryData
    ? agentDiaryData.agents.flatMap(a =>
        (a.trading_diary || []).map(e => ({ ...e, agentName: a.name, agentId: a.id }))
      ).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    : [];

  const filteredDiaryEntries = mergedDiaryEntries.filter(e => {
    if (diaryFilter === 'profits') return e.success && e.trigger !== 'SELF_CRITICISM';
    if (diaryFilter === 'losses') return !e.success && e.trigger === 'STOP_LOSS';
    if (diaryFilter === 'criticism') return e.trigger === 'SELF_CRITICISM';
    return true;
  });

  useEffect(() => {
    if (activeTab !== 'ai-insights') return;
    let cancelled = false;
    async function fetchDiary() {
      try {
        const res = await fetch('https://kefur-backend.onrender.com/api/agents');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAgentDiaryData(data);
      } catch {
        // Backend offline
      }
    }
    fetchDiary();
    const interval = setInterval(fetchDiary, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeTab]);

  // AI Sentiment results state
  const [aiInsights, setAiInsights] = useState<Record<string, AISentiment>>({});
  const [loadingInsights, setLoadingInsights] = useState<string | null>(null);

  // Active Price Fluctuations Simulation Toggle
  const [liveSimulation, setLiveSimulation] = useState(true);
  const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({});

  // Persist asset state
  useEffect(() => {
    localStorage.setItem('kefur_assets', JSON.stringify(assets));
  }, [assets]);

  // Persist watchlist state
  useEffect(() => {
    localStorage.setItem('kefur_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Fetch market summary
  const fetchMarketSummary = async () => {
    try {
      const res = await fetch('/api/market-summary');
      if (res.ok) {
        const data = await res.json();
        setMarketSummary(data);
      }
    } catch (e) {
      console.warn('Failed to fetch market summary from server, using local fallback');
    }
  };

  useEffect(() => {
    fetchMarketSummary();
  }, []);

  // Simulating active market ticked feeds (fluctuating prices slightly)
  useEffect(() => {
    if (!liveSimulation) return;

    const interval = setInterval(() => {
      setAssets(prevAssets => {
        const flashes: Record<string, 'up' | 'down' | null> = {};
        
        const updated = prevAssets.map(asset => {
          // Select only a random subset of tickers to update each cycle to keep it realistic
          if (Math.random() > 0.45) return asset;

          const changePercent = (Math.random() - 0.5) * 0.008; // small change
          const isUp = changePercent > 0;
          const delta = asset.price * changePercent;
          const newPrice = Math.max(asset.price + delta, 0.01);
          const newChange = Number((asset.change24h + (changePercent * 100)).toFixed(2));
          
          flashes[asset.symbol] = isUp ? 'up' : 'down';

          // Keep a short queue of historical tracking points
          const history = [...asset.history];
          if (history.length > 25) {
            history.shift();
          }
          history.push(Number(newPrice.toFixed(2)));

          return {
            ...asset,
            price: Number(newPrice.toFixed(2)),
            change24h: newChange,
            history
          };
        });

        setPriceFlash(flashes);
        
        // Reset price blink effect shortly after
        setTimeout(() => {
          setPriceFlash({});
        }, 800);

        return updated;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [liveSimulation]);

  // Fetch Google Grounded AI insights for symbol
  const fetchAiInsights = async (symbol: string) => {
    if (loadingInsights === symbol) return;
    setLoadingInsights(symbol);
    try {
      const res = await fetch(`/api/ai-insights?symbol=${symbol}&lang=${lang}`);
      if (res.ok) {
        const data: AISentiment = await res.json();
        setAiInsights(prev => ({
          ...prev,
          [symbol]: data
        }));
      }
    } catch (e) {
      console.error('Failed to pull search grounding predictions', e);
    } finally {
      setLoadingInsights(null);
    }
  };

  // Trigger insight fetch when asset is clicked
  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    if (!aiInsights[asset.symbol]) {
      fetchAiInsights(asset.symbol);
    }
  };

  // Re-fetch insights when language changes if an asset is selected
  useEffect(() => {
    if (selectedAsset) {
      fetchAiInsights(selectedAsset.symbol);
    }
  }, [lang, selectedAsset?.symbol]);

  // Filter lists
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesWatchlist = !showWatchlistOnly || watchlist.includes(asset.symbol);
    return matchesSearch && matchesCategory && matchesWatchlist;
  });

  const toggleWatchlist = (symbol: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchlist(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  return (
    <MobileFrame>
      <div className="flex-1 flex flex-col bg-[#0A0A0A] text-[#F0F0F0] overflow-hidden justify-between relative" id="kefur-app-viewport">
        
        {/* Top Live Ticker Marquee Bar */}
        <div className="bg-black/90 border-b border-white/5 overflow-hidden h-7 flex items-center shrink-0 select-none relative z-40" id="kefur-top-marquee-container">
          <div className="animate-marquee flex whitespace-nowrap items-center py-1 gap-6 hover:[animation-play-state:paused]" id="kefur-marquee-inner">
            {[...assets, ...assets].map((asset, index) => {
              const tryPrice = asset.symbol === 'BIST100' ? asset.price : asset.price * 34;
              const isUp = asset.change24h >= 0;
              return (
                <button 
                  key={`${asset.symbol}-${index}`} 
                  onClick={() => handleSelectAsset(asset)}
                  className="inline-flex items-center gap-1 cursor-pointer text-left hover:text-white transition-all text-[9.5px] font-mono select-none"
                  id={`marquee-item-${asset.symbol}-${index}`}
                >
                  <span className="text-white/45 font-bold">{asset.symbol}/TRY</span>
                  <span className="text-white/85 font-semibold">
                    {asset.symbol === 'BIST100' ? tryPrice.toLocaleString() : tryPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                  <span className={`flex items-center text-[8.5px] font-bold ${isUp ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {isUp ? '▲' : '▼'}{isUp ? '+' : ''}{asset.change24h}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Floating notifications toaster */}
        {notifications.length > 0 && (
          <div className="absolute top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none animate-fade-in" id="kefur-toaster-wrapper">
            {notifications.map(notif => (
              <div 
                key={notif.id}
                className="pointer-events-auto bg-black/95 border border-amber-400/40 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 relative overflow-hidden"
                id={`toast-${notif.id}`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-400"></div>
                <div className="flex-1" id={`toast-content-${notif.id}`}>
                  <h4 className="text-xs font-mono font-bold text-amber-400">
                    {lang === 'tr' ? notif.titleTr : notif.titleEn}
                  </h4>
                  <p className="text-[10px] text-white/80 font-sans mt-1 leading-relaxed">
                    {lang === 'tr' ? notif.textTr : notif.textEn}
                  </p>
                </div>
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="text-white/30 hover:text-white transition p-1 cursor-pointer"
                  id={`toast-close-btn-${notif.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Content Pane */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4.5 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10" id="kefur-main-scroll-pane">
          
          {selectedAsset ? (
            /* ================= SCREEN 3: ASSET DETAILS & AI PREDICTION VIEW ================= */
            <div className="flex flex-col gap-5 animate-fade-in" id="kefur-detail-screen">
              
              {/* Detail Navigation Header */}
              <div className="flex items-center justify-between" id="detail-nav-header">
                <button 
                  onClick={() => setSelectedAsset(null)}
                  className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center cursor-pointer text-white"
                  id="detail-back-btn"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="text-center" id="detail-brand-title">
                  <span className="text-[9px] tracking-[0.25em] text-white/40 font-mono font-bold uppercase">
                    {lang === 'tr' ? 'Varlık Analitiği' : 'Asset Analytics'}
                  </span>
                  <h2 className="text-sm font-light font-serif italic text-white tracking-tight mt-0.5">{selectedAsset.name}</h2>
                </div>
                <div className="flex items-center gap-1.5" id="detail-header-actions">
                  <button
                    onClick={() => setLang(prev => prev === 'en' ? 'tr' : 'en')}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white text-white/70 transition cursor-pointer text-[10px] font-mono font-bold flex items-center justify-center"
                    id="detail-lang-toggle"
                    title={lang === 'en' ? 'Switch to Turkish' : 'English’e Geç'}
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleWatchlist(selectedAsset.symbol)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-amber-400 transition cursor-pointer flex items-center justify-center"
                    id="watchlist-star-btn"
                  >
                    {watchlist.includes(selectedAsset.symbol) ? (
                      <BookmarkCheck className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <Bookmark className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                </div>
              </div>

              {/* Dynamic Asset Hero Value display */}
              <div className="text-center py-2" id="detail-value-hero">
                <div className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] text-white/50 font-mono mb-2" id="detail-ticker-badge">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {selectedAsset.symbol} / {lang === 'tr' ? 'USD ENDEKSİ' : 'USD INDEX'}
                </div>
                <h1 className="text-4xl font-light font-serif tracking-tight text-white mb-1" id="detail-hero-price">
                  {formatPrice(selectedAsset.price, selectedAsset.symbol)}
                </h1>
                <div className="flex items-center justify-center gap-2" id="detail-gains-row">
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${selectedAsset.change24h >= 0 ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/5 text-rose-400 border-rose-500/20'}`}>
                    {selectedAsset.change24h >= 0 ? '+' : ''}{selectedAsset.change24h}%
                  </span>
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">{t.high24h}: {formatPrice(selectedAsset.high24h, selectedAsset.symbol)}</span>
                </div>
              </div>

              {/* 1. Custom SVG line trend chart with responsive interactions */}
              <TrendChart asset={selectedAsset} lang={lang} />

              {/* Asset Brief stats */}
              <div className="grid grid-cols-2 gap-3" id="asset-analytics-grid">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between" id="stat-mcap">
                  <span className="text-[9px] text-white/40 uppercase font-mono tracking-widest">{t.marketCap}</span>
                  <span className="text-sm font-semibold font-mono text-[#F0F0F0] mt-1">
                    ${(selectedAsset.marketCap / 1e9).toFixed(1)}B
                  </span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between" id="stat-vol">
                  <span className="text-[9px] text-white/40 uppercase font-mono tracking-widest">{t.volume24h}</span>
                  <span className="text-sm font-semibold font-mono text-[#F0F0F0] mt-1">
                    ${(selectedAsset.volume24h / 1e9).toFixed(1)}B
                  </span>
                </div>
              </div>

              {/* KeFur AI Probability Panel */}
              <div className="bg-[#120F12]/60 border border-purple-900/45 rounded-2xl p-4 relative overflow-hidden" id="kefur-ai-probability-panel">
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 blur-xl rounded-full pointer-events-none"></div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3" id="kefur-ai-prob-header">
                  <h3 className="text-xs font-bold tracking-wider font-mono text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-400" />
                    {lang === 'tr' ? 'KeFur AI Olasılık Paneli' : 'KeFur AI Probability Panel'}
                  </h3>
                  <span className="text-[8px] font-mono uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded" id="kefur-ai-prob-model-tag">
                    MODEL V4.2
                  </span>
                </div>

                {(() => {
                  const score = aiInsights[selectedAsset.symbol] 
                    ? aiInsights[selectedAsset.symbol].sentimentScore 
                    : Math.max(15, Math.min(85, Math.round(50 + selectedAsset.change24h * 4.5)));
                  
                  const upsideProb = score;
                  const downsideProb = 100 - score;
                  const isBearishDominant = downsideProb > upsideProb;

                  return (
                    <div className="flex flex-col gap-3.5 animate-fade-in" id="kefur-ai-prob-bars">
                      {/* Upside Probability bar */}
                      <div className="flex flex-col gap-1.5" id="kefur-ai-prob-upside-wrapper">
                        <div className="flex justify-between items-center text-xs font-mono" id="kefur-ai-prob-upside-label-row">
                          <span className="text-white/60 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            {lang === 'tr' ? 'Yükseliş Olasılığı %' : 'Upside Probability %'}
                          </span>
                          <span className={`${!isBearishDominant ? 'text-emerald-400 font-bold text-sm' : 'text-white/40'}`}>
                            {upsideProb}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden relative" id="kefur-ai-prob-upside-track">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              !isBearishDominant 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]' 
                                : 'bg-emerald-500/25'
                            }`}
                            style={{ width: `${upsideProb}%` }}
                            id="kefur-ai-prob-upside-fill"
                          ></div>
                        </div>
                      </div>

                      {/* Downside Probability bar */}
                      <div className="flex flex-col gap-1.5" id="kefur-ai-prob-downside-wrapper">
                        <div className="flex justify-between items-center text-xs font-mono" id="kefur-ai-prob-downside-label-row">
                          <span className="text-white/60 flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                            {lang === 'tr' ? 'Düşüş Olasılığı %' : 'Downside Probability %'}
                          </span>
                          <span className={`${isBearishDominant ? 'text-rose-500 font-bold text-sm' : 'text-white/40'}`}>
                            {downsideProb}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden relative" id="kefur-ai-prob-downside-track">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              isBearishDominant 
                                ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
                                : 'bg-rose-500/25'
                            }`}
                            style={{ width: `${downsideProb}%` }}
                            id="kefur-ai-prob-downside-fill"
                          ></div>
                        </div>
                      </div>

                      {/* Dominant Sentiment Alert text */}
                      <p className="text-[10px] text-white/40 font-serif italic text-justify leading-relaxed mt-1" id="kefur-ai-prob-text">
                        {lang === 'tr' 
                          ? `KeFur AI algoritması, blog konsensüsü ve ${selectedAsset.name} işlem sinyalleri taranarak ${isBearishDominant ? 'negatif yatay' : 'yakın vadeli pozitif'} beklenti olasılıklarını hesaplamıştır.`
                          : `KeFur AI algorithm has synthesized ${isBearishDominant ? 'bearish sideways' : 'near-term positive'} momentum options based on expert blog logs and 24h delta.`
                        }
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* 2. BLOG ANALYSIS & PRICE PREDICTIONS SEGMENT (Grounded AI Insights) */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 relative overflow-hidden" id="ai-predictions-section">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/2 blur-3xl rounded-full pointer-events-none"></div>
                
                <div className="flex items-center gap-2 mb-4" id="ai-section-title">
                  <div className="p-1 px-2.5 rounded bg-white text-black text-[10px] font-bold tracking-widest uppercase" id="spark-icon-bg">
                    {lang === 'tr' ? 'YZ ANALİZİ' : 'AI INSIGHT'}
                  </div>
                  <div>
                    <h3 className="text-sm font-serif font-light text-white tracking-tight italic">{t.blogConsensus}</h3>
                    <p className="text-[8px] text-white/30 font-mono uppercase tracking-[0.2em] leading-none mt-1">{t.groundedGoogle}</p>
                  </div>
                </div>

                {loadingInsights === selectedAsset.symbol ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3 text-center" id="ai-loading">
                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                    <div>
                      <p className="text-xs font-semibold text-white/80">{t.summoningGoogle}</p>
                      <p className="text-[9px] text-[#F0F0F0]/30 font-mono mt-1 uppercase tracking-widest">{t.activeAggregators} {selectedAsset.symbol}</p>
                    </div>
                  </div>
                ) : aiInsights[selectedAsset.symbol] ? (
                  <div className="flex flex-col gap-4 animate-fade-in" id="ai-loaded-data">
                    {/* Sentiment meter */}
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 items-center" id="sentiment-visual-container">
                      <SentimentGauge 
                        score={aiInsights[selectedAsset.symbol].sentimentScore}
                        label={aiInsights[selectedAsset.symbol].sentimentLabel}
                        lang={lang}
                      />
                      
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-center" id="pred-box">
                        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 font-mono mb-1 block">{t.predictionRange}</span>
                        <div className="text-sm font-bold text-[#F0F0F0] font-mono bg-white/5 border border-white/10 px-2.5 py-1.5 rounded inline-block text-center" id="pred-range-val">
                          {aiInsights[selectedAsset.symbol].predictionRange}
                        </div>
                        <p className="text-[9px] text-white/30 mt-2 font-serif italic leading-relaxed" id="pred-disclaimer">
                          {t.analystDisclaimer}
                        </p>
                      </div>
                    </div>

                    {/* Analyst Comment & Disclaimer Module */}
                    <div className="bg-red-950/20 border-2 border-red-900/60 rounded-2xl p-4.5 relative overflow-hidden" id="summary-card">
                      <div className="absolute top-0 right-0 p-1 px-2.5 bg-red-900/25 text-red-400 rounded-bl-sm font-mono text-[7.5px]" id="statutory-tag">
                        {lang === 'tr' ? 'YASAL UYARI REAL' : 'OFFICIAL DISCLAIMER'}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3 border-b border-red-900/40 pb-2" id="ac-header">
                        <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                        <div>
                          <h4 className="text-[10px] font-bold tracking-[0.2em] text-red-200 font-mono uppercase">
                            {lang === 'tr' ? 'UZMAN ANALİST YORUMLARI' : 'EXPERT ANALYST COMMENTS'}
                          </h4>
                          <span className="text-[8px] text-red-400 font-mono leading-none tracking-widest uppercase">
                            {lang === 'tr' ? 'DERLENMİŞ YZ STRATEJİSİ' : 'COMPILED AI STRATEGY'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-white/80 leading-relaxed font-sans text-justify pt-1 mb-4" id="analyst-comment-summary-text">
                        {aiInsights[selectedAsset.symbol].summary}
                      </p>

                      <div className="bg-red-950/45 border border-red-900/50 rounded-xl p-3 flex items-start gap-2.5" id="disclaimer-alert-box">
                        <div className="text-red-500 font-bold text-xs select-none">⚠️</div>
                        <div id="disclaimer-alert-texts">
                          <p className="text-[10px] font-medium text-red-400 font-sans leading-tight">
                            {lang === 'tr' ? 'Analizler yatırım tavsiyesi içermez.' : 'Analyses do not constitute investment advice.'}
                          </p>
                          <p className="text-[8px] text-white/40 font-mono mt-1 uppercase tracking-wider">
                            {lang === 'tr' ? 'Sermayeniz risk altındadır.' : 'Your capital is at risk.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Key factors */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5" id="drivers-card">
                      <h4 className="text-[9px] font-bold tracking-[0.2em] text-white/70 font-mono uppercase mb-2.5 border-b border-white/5 pb-1.5">{t.expertBlogDrivers}</h4>
                      <ul className="text-xs text-white/65 space-y-2" id="drivers-list">
                        {aiInsights[selectedAsset.symbol].keyFactors.map((fact, idx) => (
                           <li key={idx} className="flex gap-2 items-start" id={`driver-item-${idx}`}>
                             <span className="w-1.5 h-1.5 rounded-sm bg-white/30 mt-1.5 shrink-0"></span>
                             <span>{fact}</span>
                           </li>
                        ))}
                      </ul>
                    </div>

                    {/* Grounding real links citations! */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5" id="citations-card">
                      <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-1.5" id="citations-hdr">
                        <h4 className="text-[9px] font-bold tracking-[0.2em] text-white/60 font-mono uppercase">{t.citedSearchResources}</h4>
                        <span className="text-[8px] text-white/30 font-mono uppercase tracking-widest">{t.groundingLinks}</span>
                      </div>
                      <div className="flex flex-col gap-2" id="citations-list">
                        {aiInsights[selectedAsset.symbol].sources.map((src, idx) => (
                          <a 
                            href={src.uri} 
                            target="_blank" 
                            rel="referrer noopener"
                            key={idx}
                            className="bg-white/2 hover:bg-white/10 border border-white/5 hover:border-white/15 p-2 rounded-xl flex items-center justify-between transition-colors text-left"
                            id={`citation-link-${idx}`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden" id="citation-title-wrapper">
                              <BookOpen className="w-3.5 h-3.5 text-white/45 shrink-0" />
                              <span className="text-xs text-white/75 truncate font-sans font-medium hover:text-white transition">
                                {src.title}
                              </span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-white/30 shrink-0 ml-1 hover:text-white transition" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center" id="ai-init-insights">
                    <button 
                      onClick={() => fetchAiInsights(selectedAsset.symbol)}
                      className="px-5 py-3 rounded-full bg-white hover:bg-white/90 text-black text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 mx-auto cursor-pointer transition shadow"
                      id="load-ai-first-btn"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {lang === 'tr' ? 'Canlı YZ Analizi Oluştur' : 'Generate Live AI Analysis'}
                    </button>
                  </div>
                )}
              </div>

              {/* VIRTUAL TRADING & PAPER TRADING ROOM PANEL */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5" id="virtual-trading-room-panel">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3.5" id="vtr-header">
                  <h3 className="text-xs font-bold tracking-wider font-mono text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    {t.virtualTradingRoom}
                  </h3>
                  <button 
                    onClick={() => {
                      if (window.confirm(lang === 'en' ? 'Reset paper trading portfolio?' : 'Sanal portföyü sıfırlamak istiyor musunuz?')) {
                        setPortfolioCash(100000);
                        setPortfolioHoldings({});
                      }
                    }}
                    className="text-[9px] uppercase font-bold tracking-wider text-rose-400 font-mono bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded border border-rose-500/20 transition cursor-pointer"
                    id="reset-portfolio-btn"
                  >
                    {t.resetPortfolio}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3.5 mb-4" id="vtr-balance-row">
                  <div className="bg-white/2 border border-white/5 px-3 py-2.5 rounded-xl" id="vtr-cash-box">
                    <span className="text-[9px] text-white/40 block font-mono uppercase tracking-wider">{t.availableBalance}</span>
                    <span className="text-sm font-semibold font-mono text-white">
                      {formatPrice(portfolioCash, 'USD_GLOBAL')}
                    </span>
                  </div>
                  <div className="bg-white/2 border border-white/5 px-3 py-2.5 rounded-xl" id="vtr-position-box">
                    <span className="text-[9px] text-white/40 block font-mono uppercase tracking-wider">{t.positions}</span>
                    <span className="text-sm font-semibold font-mono text-white">
                      {portfolioHoldings[selectedAsset.symbol] 
                        ? `${portfolioHoldings[selectedAsset.symbol].quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t.shares}`
                        : `0 ${t.shares}`
                      }
                    </span>
                  </div>
                </div>

                {/* If user has a position, show detailed holdings & P&L */}
                {portfolioHoldings[selectedAsset.symbol] && (
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 mb-4 text-xs font-mono flex flex-col gap-1.5" id="current-position-stats">
                    <div className="flex justify-between" id="stat-avg">
                      <span className="text-white/40">{t.avgPrice}:</span>
                      <span className="text-white">
                        {formatPrice(portfolioHoldings[selectedAsset.symbol].avgBuyPrice, selectedAsset.symbol)}
                      </span>
                    </div>
                    <div className="flex justify-between" id="stat-val2">
                      <span className="text-white/40">{t.currentVal}:</span>
                      <span className="text-white">
                        {formatPrice(portfolioHoldings[selectedAsset.symbol].quantity * selectedAsset.price, selectedAsset.symbol)}
                      </span>
                    </div>
                    <div className="flex justify-between" id="stat-pnl">
                      <span className="text-white/40">{t.pnl}:</span>
                      {(() => {
                        const pnlVal = (selectedAsset.price - portfolioHoldings[selectedAsset.symbol].avgBuyPrice) * portfolioHoldings[selectedAsset.symbol].quantity;
                        const isProfit = pnlVal >= 0;
                        return (
                          <span className={`${isProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
                            {isProfit ? '+' : ''}{formatPrice(pnlVal, selectedAsset.symbol)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Trade Interaction */}
                <div className="flex flex-col gap-2.5 mt-2" id="vtr-actions-row">
                  <div className="flex gap-2" id="trade-controls-upper">
                    <div className="relative flex-1" id="trade-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder={lang === 'tr' ? 'Miktar Giriniz...' : 'Enter Quantity...'}
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 focus:border-white/20 text-xs px-3.5 py-3 rounded-xl text-white outline-none font-mono"
                        id="trade-amount-input"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2" id="trade-buttons-container">
                    <button
                      onClick={handleBuy}
                      className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-black text-xs font-extrabold uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer select-none text-center flex items-center justify-center font-sans shadow-[0_0_15px_rgba(16,185,129,0.15)] border border-emerald-400/20"
                      id="trade-buy-btn"
                    >
                      {lang === 'tr' ? 'VARLIK SATIN AL' : 'BUY ASSET'}
                    </button>
                    <button
                      onClick={handleSell}
                      className="py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer select-none text-center flex items-center justify-center font-sans border border-rose-500/20"
                      id="trade-sell-btn"
                    >
                      {lang === 'tr' ? 'SAT (SELL)' : 'SAT (SELL)'}
                    </button>
                  </div>
                </div>

                {tradeError && (
                  <p className="text-[10px] text-rose-400 font-mono mt-2" id="trade-error-msg">⚠️ {tradeError}</p>
                )}
                {tradeSuccess && (
                  <p className="text-[10px] text-emerald-400 font-mono mt-2" id="trade-success-msg">✓ {tradeSuccess}</p>
                )}
              </div>

              {/* PRICE ALERTS ACCORDION / BOX */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5" id="price-alerts-panel">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3" id="alerts-hdr-row">
                  <h3 className="text-xs font-bold tracking-wider font-mono text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    {t.priceAlert}
                  </h3>
                  {alerts[selectedAsset.symbol] && (
                    <span className="text-[8px] font-bold font-mono tracking-widest text-amber-400 uppercase bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded animate-pulse" id="alert-status-badge">
                      {lang === 'en' ? 'ACTIVE' : 'AKTİF'}
                    </span>
                  )}
                </div>

                {alerts[selectedAsset.symbol] ? (
                  <div className="flex items-center justify-between bg-white/2 border border-white/5 p-3 rounded-xl" id="alert-active-row">
                    <div id="alert-active-descr">
                      <p className="text-[9px] uppercase font-mono tracking-widest text-white/40">{t.alertSetFor}</p>
                      <p className="text-sm font-semibold font-mono text-white mt-0.5">
                        {formatPrice(alerts[selectedAsset.symbol].targetPrice, selectedAsset.symbol)}
                      </p>
                    </div>
                    <button
                      onClick={() => clearAlert(selectedAsset.symbol)}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-rose-400 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition text-white cursor-pointer select-none"
                      id="alert-clear-btn"
                    >
                      {t.clear}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2" id="alert-setup-row">
                    <input
                      type="number"
                      placeholder={translations[lang].enterAlertPrice}
                      value={alertInputs[selectedAsset.symbol] || ''}
                      onChange={(e) => setAlertInputs(prev => ({ ...prev, [selectedAsset.symbol]: e.target.value }))}
                      className="flex-1 bg-white/5 border border-white/15 focus:border-white/30 text-xs px-3 py-2.5 rounded-xl text-white outline-none font-mono"
                      id="alert-setup-input"
                    />
                    <button
                      onClick={() => saveAlert(selectedAsset.symbol, selectedAsset.price)}
                      className="px-4 py-2.5 bg-white hover:bg-white/90 text-black text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer select-none"
                      id="alert-set-btn"
                    >
                      {t.set}
                    </button>
                  </div>
                )}
              </div>

              {/* Back Tab */}
              <button 
                onClick={() => setSelectedAsset(null)}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold tracking-widest uppercase text-white/75 flex items-center justify-center gap-2 cursor-pointer mt-2 transition"
                id="back-to-dashboard-footer"
              >
                <ArrowLeft className="w-4 h-4" /> {t.backToTickers}
              </button>

            </div>
          ) : activeTab === 'dashboard' ? (
            /* ================= SCREEN 1: LIVE FINANCIAL DASHBOARD ================= */
            <div className="flex flex-col gap-4.5 animate-fade-in" id="kefur-dashboard-screen">

              {/* Profile Card / Brand Welcome */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4" id="kefur-user-profile-row">
                <div id="welcome-text">
                  <h1 className="text-3xl font-black font-serif italic tracking-tighter text-[#F0F0F0]" id="logo-branding-kefur">KeFur.</h1>
                  <p className="text-[9px] text-white/40 font-mono uppercase tracking-[0.25em]" id="dashboard-subtitle">{t.sleekIntelInterface}</p>
                </div>

                <div className="flex items-center gap-2" id="header-actions">
                  {/* Globe / Translation Language Toggle */}
                  <button
                    onClick={() => setLang(prev => prev === 'en' ? 'tr' : 'en')}
                    className="px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-[10px] uppercase font-bold font-mono tracking-widest transition flex items-center gap-1.5 cursor-pointer hover:border-white/20 select-none"
                    id="language-toggle-btn"
                    title={lang === 'en' ? 'Switch to Turkish' : 'English’e Geç'}
                  >
                    <Globe className="w-3.5 h-3.5 text-white/70" />
                    <span>{lang === 'en' ? 'TR' : 'EN'}</span>
                  </button>

                  {/* Simulation Switcher Badge */}
                  <button
                    onClick={() => setLiveSimulation(!liveSimulation)}
                    className={`px-3 py-1.5 rounded-full border text-[9px] font-bold font-mono uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                      liveSimulation 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-white/5 text-white/40 border-white/10 hover:text-white'
                    }`}
                    id="live-simulation-toggler"
                    title="Toggle Price Tick Simulation"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${liveSimulation ? 'bg-emerald-400 animate-ping' : 'bg-white/30'}`}></span>
                    {liveSimulation ? t.simLive : t.simPaused}
                  </button>
                </div>
              </div>

              {/* Search asset bar */}
              <div className="relative" id="search-bar-wrapper">
                <Search className="w-4.5 h-4.5 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2" id="search-lens" />
                <input
                  type="text"
                  placeholder={lang === 'tr' ? 'BTC, ETH, AAPL, TSLA ara...' : 'Query BTC, ETH, AAPL, TSLA...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-white/30 text-xs px-10 py-3 rounded-xl placeholder-white/30 text-[#F0F0F0] font-sans outline-none transition-all duration-200"
                  id="search-asset-input"
                />
              </div>

              {/* Categorical Filtering Navigation row */}
              <div className="flex items-center gap-2 py-0.5" id="dashboard-category-filters">
                <button
                  onClick={() => { setCategoryFilter('all'); setShowWatchlistOnly(false); }}
                  className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition ${
                    categoryFilter === 'all' && !showWatchlistOnly
                      ? 'bg-white text-black font-extrabold'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:text-[#F0F0F0] hover:bg-white/10'
                  }`}
                  id="cat-all"
                >
                  {t.allAssets}
                </button>
                <button
                  onClick={() => { setCategoryFilter('stock'); setShowWatchlistOnly(false); }}
                  className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition ${
                    categoryFilter === 'stock'
                      ? 'bg-white text-black font-extrabold'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:text-[#F0F0F0] hover:bg-white/10'
                  }`}
                  id="cat-stocks"
                >
                  {t.stocks}
                </button>
                <button
                  onClick={() => { setCategoryFilter('crypto'); setShowWatchlistOnly(false); }}
                  className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition ${
                    categoryFilter === 'crypto'
                      ? 'bg-white text-black font-extrabold'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:text-[#F0F0F0] hover:bg-white/10'
                  }`}
                  id="cat-crypto"
                >
                  {t.cryptos}
                </button>
                <button
                  onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                  className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition flex items-center gap-1 ${
                    showWatchlistOnly
                      ? 'bg-amber-400 text-black font-extrabold'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:text-[#F0F0F0] hover:bg-white/10'
                  }`}
                  id="cat-watchlist"
                >
                  <Bookmark className="w-3 h-3" />
                  {t.watchlistOnly}
                </button>
              </div>

              {/* Dynamic Market indices highlights (Fear Greed, Gainer, Loser) */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden" id="dashboard-feargreed-banner">
                <div className="flex items-center justify-between mb-2" id="fg-banner-header">
                  <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 font-mono">{t.marketHeatIndex}</span>
                  <span className="text-[9px] text-white/60 font-mono uppercase bg-white/5 px-2 py-0.5 rounded border border-white/10 font-bold">{t.activeSimulation}</span>
                </div>
                <div className="flex items-center gap-3" id="fg-score-row">
                  <div className="w-11 h-11 rounded bg-white/10 border border-white/20 flex items-center justify-center text-lg font-bold font-mono text-[#F0F0F0]" id="fg-score-box">
                    {marketSummary.fearGreedIndex}
                  </div>
                  <div id="fg-descr">
                    <p className="text-sm font-serif font-light text-white italic" id="fg-lbl">
                      {translations[lang].fearGreedLabel[marketSummary.fearGreedLabel] || marketSummary.fearGreedLabel} {t.consensus}
                    </p>
                    <p className="text-[9px] text-white/40 leading-snug font-mono uppercase tracking-wider mt-0.5 mr-2" id="fg-phrase">
                      {insightsData?.ceo ? `${insightsData.ceo.sentiment} / Risk: ${insightsData.ceo.risk_level} — ${marketSummary.globalSentiment}` : marketSummary.globalSentiment}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ticker Assets list header */}
              <div className="flex items-center justify-between text-white/30 text-[9px] uppercase tracking-[0.2em] font-mono font-bold mt-2.5 px-1 pb-1 border-b border-white/5" id="ticker-tbl-header">
                <span id="col-asset">Asset Ticker</span>
                <span id="col-trend">24H Trend</span>
                <span className="text-right" id="col-price">Market Value</span>
              </div>

              {/* Core assets container listing */}
              <div className="flex flex-col gap-2.5" id="assets-list-container">
                {filteredAssets.length > 0 ? (
                  filteredAssets.map((asset) => {
                    const isUp = asset.change24h >= 0;
                    const flash = priceFlash[asset.symbol];
                    const isBookmarked = watchlist.includes(asset.symbol);

                    // Dynamic stroke color for mini sparkline
                    const activeStroke = isUp ? '#10b981' : '#f43f5e';

                    return (
                      <div
                        onClick={() => handleSelectAsset(asset)}
                        key={asset.symbol}
                        className={`bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-xl flex items-center justify-between cursor-pointer transition-colors duration-200 transform active:scale-98 ${
                          flash === 'up' 
                            ? 'border-emerald-500/50 bg-emerald-500/5 relative after:absolute after:inset-0 after:rounded-xl after:border after:border-emerald-500/40 after:animate-pulse' 
                            : flash === 'down'
                            ? 'border-rose-500/50 bg-rose-500/5 relative after:absolute after:inset-0 after:rounded-xl after:border after:border-rose-500/40 after:animate-pulse'
                            : ''
                        }`}
                        id={`asset-row-${asset.symbol}`}
                      >
                        {/* LEFT: Logo & Name */}
                        <div className="flex items-center gap-3 min-w-[110px]" id="asset-row-left">
                          {/* Circle Avatar matching Stock vs Crypto color cues */}
                          <div className={`w-9 h-9 rounded flex items-center justify-center font-bold font-mono text-[10px] uppercase tracking-wider ${
                            asset.category === 'crypto' 
                              ? 'bg-white/10 border border-white/15 text-[#F0F0F0]' 
                              : 'bg-white text-black font-extrabold'
                          }`} id={`asset-avatar-${asset.symbol}`}>
                            {asset.symbol.slice(0, 3)}
                          </div>
                          <div className="overflow-hidden" id="asset-label-block">
                            <div className="flex items-center gap-1.5" id="symbol-row">
                              <span className="text-xs font-bold text-white font-mono tracking-widest">{asset.symbol}</span>
                              {isBookmarked && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" id="watchlist-marker-tag"></span>
                              )}
                            </div>
                            <p className="text-[9px] text-white/40 font-serif italic truncate leading-tight mt-0.5">{asset.name}</p>
                          </div>
                        </div>

                        {/* CENTER: Compact Custom sparkline (SVG curve of historic ticks) */}
                        <div className="w-14 h-6 shrink-0" id={`sparkline-wrapper-${asset.symbol}`}>
                          <svg className="w-full h-full" viewBox="0 0 56 24" id={`mini-sparkline-${asset.symbol}`}>
                            <polyline
                              fill="none"
                              stroke={activeStroke}
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={asset.history.slice(-6).map((val, idx) => {
                                const min = Math.min(...asset.history.slice(-6));
                                const max = Math.max(...asset.history.slice(-6));
                                const delta = max - min || 1;
                                const x = (idx / 5) * 52 + 2;
                                const y = 22 - ((val - min) / delta) * 18 - 2;
                                return `${x},${y}`;
                              }).join(' ')}
                            />
                          </svg>
                        </div>

                         {/* RIGHT: Numeric price values & quick actions */}
                        <div className="text-right min-w-[100px]" id="asset-row-right">
                          <p className={`text-xs font-bold font-mono tracking-tight transition-colors duration-300 ${
                            flash === 'up' ? 'text-emerald-400 font-black' : flash === 'down' ? 'text-rose-400 font-black' : 'text-[#F0F0F0]'
                          }`} id={`ticker-price-${asset.symbol}`}>
                            {asset.symbol === 'BIST100' ? `${asset.price.toLocaleString(undefined, { maximumFractionDigits: 0 })} TL` : `₺${asset.price.toLocaleString()}`}
                          </p>
                          
                          <div className="flex items-center justify-end gap-1.5 mt-1.5" id={`change-row-${asset.symbol}`}>
                            <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                              isUp ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-rose-500/5 text-rose-400 border-rose-500/10'
                            }`} id={`change-tag-${asset.symbol}`}>
                              {isUp ? '+' : ''}{asset.change24h}%
                            </span>
                            
                            <button
                              onClick={(e) => toggleWatchlist(asset.symbol, e)}
                              className="p-1 rounded text-white/30 hover:text-amber-400 transition cursor-pointer"
                              id={`watchlist-row-star-${asset.symbol}`}
                              title="Toggle Watchlist"
                            >
                              <Bookmark className={`w-3 h-3 ${isBookmarked ? 'text-amber-400 fill-amber-400' : ''}`} />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center" id="no-search-results">
                    <p className="text-xs text-white/40 font-serif italic">No assets match your current filters.</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setShowWatchlistOnly(false); }}
                      className="text-xs text-white/60 hover:text-white underline font-mono mt-2"
                      id="reset-filter-link"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>

              {/* Developer Tip Disclaimer */}
              <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex gap-2.5" id="disclaimer-note">
                <Briefcase className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed text-white/40 font-sans" id="disclaimer-text">
                  <span className="font-bold text-white/60">Developers Note</span>: The live-feed simulations operate on independent background cycles. Clicking on any listing fetches expert sentiment analysis sourced directly from Google Search index results.
                </p>
              </div>

            </div>
          ) : activeTab === 'ai-insights' ? (
            /* ================= SCREEN 2: AI DECISION DIARY & SELF-REFLECTION ================= */
            <div className="flex flex-col gap-4.5 animate-fade-in" id="kefur-aggregator-screen">

              <div className="border-b border-white/10 pb-3" id="aggregator-welcome">
                <h1 className="text-lg font-light font-serif italic text-white text-left tracking-tight">{t.aiDiary}</h1>
                <p className="text-[9px] text-white/40 font-mono uppercase tracking-[0.25em] leading-none mt-1">{t.sentimentIndices}</p>
              </div>

              {/* CEO Macro Analysis — Live from Backend */}
              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col gap-3" id="ceo-macro-banner">
                <div className="flex items-center gap-1.5 text-white/70" id="ceo-banner-lbl">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <span className="text-[9px] font-bold tracking-[0.15em] font-mono uppercase">CEO Macro Analysis</span>
                  {insightsData?.ceo && (
                    <span className="ml-auto flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-green inline-block"></span>
                      <span className="text-[8px] text-emerald-400/70 font-mono uppercase">Live</span>
                    </span>
                  )}
                </div>

                {insightsData?.ceo ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${
                        insightsData.ceo.sentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        insightsData.ceo.sentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      }`}>
                        {insightsData.ceo.sentiment}
                      </span>
                      <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${
                        insightsData.ceo.risk_level === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        insightsData.ceo.risk_level === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      }`}>
                        Risk: {insightsData.ceo.risk_level}
                      </span>
                      <span className="text-[8px] text-white/30 font-mono uppercase">
                        Active: {insightsData.ceo.active_agents.join(', ')}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 font-sans leading-relaxed">
                      {insightsData.ceo.guidance}
                    </p>

                    {/* Live News Sentiment — Breaking News Feed */}
                    {insightsData.sentiment && insightsData.sentiment.top_headline && (
                      <div className={`rounded-lg border p-3 flex flex-col gap-2 ${
                        insightsData.sentiment.overall_sentiment === 'BULLISH' ? 'border-emerald-500/20 bg-emerald-500/5' :
                        insightsData.sentiment.overall_sentiment === 'BEARISH' ? 'border-rose-500/20 bg-rose-500/5' :
                        'border-amber-500/20 bg-amber-500/5'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Newspaper className={`w-3.5 h-3.5 ${
                            insightsData.sentiment.overall_sentiment === 'BULLISH' ? 'text-emerald-400' :
                            insightsData.sentiment.overall_sentiment === 'BEARISH' ? 'text-rose-400' :
                            'text-amber-400'
                          }`} />
                          <span className="text-[8px] font-bold font-mono uppercase tracking-[0.15em] text-white/50">
                            {lang === 'tr' ? 'Son Dakika Haber Duyarlılığı' : 'Breaking News Sentiment'}
                          </span>
                          <span className={`ml-auto text-[8px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border ${
                            insightsData.sentiment.overall_sentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            insightsData.sentiment.overall_sentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            'bg-amber-400/10 text-amber-400 border-amber-400/20'
                          }`}>
                            {insightsData.sentiment.overall_sentiment} (Score: {insightsData.sentiment.overall_score > 0 ? '+' : ''}{insightsData.sentiment.overall_score})
                          </span>
                        </div>

                        {/* Top Headline */}
                        <div className="flex items-start gap-2">
                          <span className={`text-[7px] font-bold font-mono uppercase px-1 py-0.5 rounded ${
                            insightsData.sentiment.top_impact === 'BULLISH' ? 'bg-emerald-500/15 text-emerald-400' :
                            insightsData.sentiment.top_impact === 'BEARISH' ? 'bg-rose-500/15 text-rose-400' :
                            'bg-white/10 text-white/40'
                          }`}>
                            {insightsData.sentiment.top_impact}
                          </span>
                          <p className="text-[10px] text-white/70 font-sans leading-relaxed">
                            {insightsData.sentiment.top_headline}
                          </p>
                        </div>

                        {/* All headlines + scores */}
                        {insightsData.sentiment.headlines && insightsData.sentiment.headlines.length > 1 && (
                          <div className="flex flex-col gap-1 mt-1">
                            {insightsData.sentiment.headlines.slice(1).map((h, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <span className={`text-[7px] font-bold font-mono w-9 text-right shrink-0 ${
                                  h.score > 0 ? 'text-emerald-400' : h.score < 0 ? 'text-rose-400' : 'text-white/30'
                                }`}>
                                  {h.score > 0 ? '+' : ''}{h.score}
                                </span>
                                <p className="text-[9px] text-white/40 font-sans leading-relaxed">{h.headline}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Analysis summary */}
                        {insightsData.sentiment.analysis && (
                          <p className="text-[9px] text-white/50 font-sans leading-relaxed italic border-t border-white/5 pt-2">
                            {insightsData.sentiment.analysis}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                    <span className="text-[10px] text-white/30 font-mono uppercase">Waiting for CEO analysis...</span>
                  </div>
                )}
              </div>

              {/* === AI TRADING DIARY FEED === */}
              <div className="flex flex-col gap-3" id="diary-feed-container">
                <div className="flex items-center justify-between px-1" id="diary-section-header">
                  <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 font-mono flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-white/40" />
                    {t.aiDiaryFeed}
                  </span>
                  {agentDiaryData && (
                    <span className="text-[8px] text-emerald-400/70 font-mono uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-green inline-block"></span>
                      Live
                    </span>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 px-1 overflow-x-auto" id="diary-filter-tabs">
                  {([
                    { key: 'all' as const, label: t.allEntries },
                    { key: 'profits' as const, label: t.profitsOnly },
                    { key: 'losses' as const, label: t.lossesOnly },
                    { key: 'criticism' as const, label: t.criticismOnly },
                  ]).map(ft => (
                    <button
                      key={ft.key}
                      onClick={() => setDiaryFilter(ft.key)}
                      className={`text-[9px] font-bold font-mono uppercase px-2.5 py-1 rounded-full border transition ${
                        diaryFilter === ft.key
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'text-white/30 border-white/10 hover:text-white/50 hover:border-white/20'
                      }`}
                    >
                      {ft.label}
                    </button>
                  ))}
                  <span className="ml-auto text-[8px] text-white/20 font-mono">
                    {filteredDiaryEntries.length} {lang === 'tr' ? 'kayıt' : 'entries'}
                  </span>
                </div>

                {/* Diary Cards */}
                <div className="flex flex-col gap-3" id="diary-entries-list">
                  {!agentDiaryData ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                        <span className="text-[9px] text-white/30 font-mono uppercase">
                          {lang === 'tr' ? 'Ajan günlüğü yükleniyor...' : 'Loading agent diary...'}
                        </span>
                      </div>
                    </div>
                  ) : filteredDiaryEntries.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-2 text-center max-w-[260px]">
                        <BookOpen className="w-8 h-8 text-white/10" />
                        <span className="text-[10px] text-white/30 font-mono uppercase">{t.diaryEmpty}</span>
                      </div>
                    </div>
                  ) : (
                    filteredDiaryEntries.map((entry, idx) => {
                      const isCriticism = entry.trigger === 'SELF_CRITICISM';
                      const isStopLoss = entry.trigger === 'STOP_LOSS';
                      const isTakeProfit = entry.trigger === 'TAKE_PROFIT';
                      const isProfit = entry.success && !isCriticism;

                      const cardBorder = isCriticism
                        ? 'border-purple-500/20'
                        : isStopLoss
                        ? 'border-rose-500/20'
                        : isProfit
                        ? 'border-emerald-500/20'
                        : 'border-amber-500/20';

                      const cardBg = isCriticism
                        ? 'bg-purple-500/5'
                        : isStopLoss
                        ? 'bg-rose-500/5'
                        : isProfit
                        ? 'bg-emerald-500/5'
                        : 'bg-amber-500/5';

                      const badgeColor = isCriticism
                        ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                        : isStopLoss
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/25'
                        : isTakeProfit
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        : isProfit
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/25';

                      const badgeLabel = isCriticism
                        ? t.selfCriticism
                        : isStopLoss
                        ? t.stopLossTriggered
                        : isTakeProfit
                        ? t.takeProfitTriggered
                        : isProfit
                        ? t.profitNote
                        : t.lossNote;

                      const iconEl = isCriticism
                        ? <ShieldAlert className="w-4 h-4 text-purple-400" />
                        : isStopLoss
                        ? <TrendingDown className="w-4 h-4 text-rose-400" />
                        : isProfit
                        ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                        : <TrendingDown className="w-4 h-4 text-amber-400" />;

                      const safePnl = entry.pnl_usd ?? 0;
                      const pnlColor = safePnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
                      const pnlPrefix = safePnl >= 0 ? '+' : '';

                      return (
                        <div
                          key={`${entry.agentId}-${entry.trade_id}-${idx}`}
                          className={`rounded-xl border ${cardBorder} ${cardBg} p-4 flex flex-col gap-2.5`}
                        >
                          {/* Top row: Agent name + Badge + Time */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <Bot className="w-3.5 h-3.5 text-white/40" />
                              <span className="text-[10px] font-bold font-mono text-white/70">{entry.agentName}</span>
                            </div>
                            <span className={`text-[7px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                              {badgeLabel}
                            </span>
                            <span className="ml-auto text-[8px] text-white/25 font-mono">
                              {new Date(entry.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>

                          {/* Trade details (skip for criticism notes) */}
                          {!isCriticism && entry.pair && (
                            <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                              <span className="text-white/50">{entry.pair}</span>
                              <span className={`font-bold ${entry.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {entry.side}
                              </span>
                              <span className="text-white/30">{entry.quantity} @ ${entry.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className={`ml-auto font-bold ${pnlColor}`}>
                                {pnlPrefix}${Math.abs(safePnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({(entry.pnl_percent ?? 0) >= 0 ? '+' : ''}{entry.pnl_percent ?? 0}%)
                              </span>
                            </div>
                          )}

                          {/* Reason / Reflection text */}
                          <div className={`rounded-lg border ${cardBorder} px-3 py-2.5`}>
                            <div className="flex items-start gap-2">
                              {iconEl}
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-[8px] font-bold font-mono uppercase tracking-[0.1em] text-white/40">
                                  {isCriticism ? t.lessonsLearned : (lang === 'tr' ? 'İşlem Gerekçesi' : 'Trade Rationale')}
                                </span>
                                <p className="text-[10px] text-white/65 font-sans leading-relaxed whitespace-pre-wrap break-words">
                                  {entry.reason}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Date */}
                          <span className="text-[8px] text-white/20 font-mono">
                            {new Date(entry.time).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* ================= SCREEN 4: AI TRADING AGENTS DASHBOARD ================= */
            <AIAgentsDashboard lang={lang} t={t} />
          )}

        </div>

        {/* Global Bottom Navigation Shell */}
        <div className="h-16 bg-[#030303] border-t border-white/10 flex items-center justify-around z-40 relative px-2.5" id="kefur-bottom-navigation-dock">
          
          {/* Nav Item 1: Home Dashboard */}
          <button
            onClick={() => { setSelectedAsset(null); setActiveTab('dashboard'); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition relative cursor-pointer ${
              activeTab === 'dashboard' && !selectedAsset
                ? 'text-white'
                : 'text-white/40 hover:text-white'
            }`}
            id="nav-btn-dashboard"
          >
            {activeTab === 'dashboard' && !selectedAsset && (
              <span className="absolute top-0 w-8 h-0.5 rounded-b bg-white" id="nav-indicator-1"></span>
            )}
            <Layers className="w-5 h-5" id="nav-icon-dashboard" />
            <span className="text-[9px] font-bold uppercase tracking-widest font-mono" id="nav-text-dashboard">Feed Tickers</span>
          </button>

          {/* Nav Item 2: AI Insighter Hub */}
          <button
            onClick={() => { setSelectedAsset(null); setActiveTab('ai-insights'); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition relative cursor-pointer ${
              activeTab === 'ai-insights' && !selectedAsset
                ? 'text-white'
                : 'text-white/40 hover:text-white'
            }`}
            id="nav-btn-ai-hub"
          >
            {activeTab === 'ai-insights' && !selectedAsset && (
              <span className="absolute top-0 w-8 h-0.5 rounded-b bg-white" id="nav-indicator-2"></span>
            )}
            <Sparkles className="w-5 h-5" id="nav-icon-ai-hub" />
            <span className="text-[9px] font-bold uppercase tracking-widest font-mono" id="nav-text-ai-hub">AI Insights</span>
          </button>

          {/* Nav Item 3: AI Trading Agents */}
          <button
            onClick={() => { setSelectedAsset(null); setActiveTab('agents'); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition relative cursor-pointer ${
              activeTab === 'agents' && !selectedAsset
                ? 'text-white'
                : 'text-white/40 hover:text-white'
            }`}
            id="nav-btn-agents"
          >
            {activeTab === 'agents' && !selectedAsset && (
              <span className="absolute top-0 w-8 h-0.5 rounded-b bg-white" id="nav-indicator-3"></span>
            )}
            <Bot className="w-5 h-5" id="nav-icon-agents" />
            <span className="text-[9px] font-bold uppercase tracking-widest font-mono" id="nav-text-agents">Agents</span>
          </button>

        </div>

      </div>
    </MobileFrame>
  );
}
