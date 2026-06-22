export interface TranslationSet {
  dashboard: string;
  aiInsights: string;
  insightsHub: string;
  sentimentIndices: string;
  simLive: string;
  simPaused: string;
  allAssets: string;
  stocks: string;
  cryptos: string;
  watchlistOnly: string;
  marketHeatIndex: string;
  consensus: string;
  activeSimulation: string;
  assetTicker: string;
  trend24h: string;
  marketValue: string;
  high24h: string;
  low24h: string;
  marketCap: string;
  volume24h: string;
  blogConsensus: string;
  groundedGoogle: string;
  summoningGoogle: string;
  activeAggregators: string;
  consensusPredictionsIndex: string;
  topRankedWatchlist: string;
  aiOffline: string;
  bloggerFocusChannels: string;
  recentUpdates: string;
  noSearchInsights: string;
  compileAi: string;
  backToTickers: string;
  developersNote: string;
  noMatchingAssets: string;
  resetAllFilters: string;
  sleekIntelInterface: string;
  fearGreedLabel: Record<string, string>;
  sentimentMeter: string;
  bullish: string;
  bearish: string;
  neutral: string;
  stronglyBullish: string;
  stronglyBearish: string;
  latestBlogConsensus: string;
  expertBlogDrivers: string;
  citedSearchResources: string;
  groundingLinks: string;
  predictionRange: string;
  analystDisclaimer: string;
  virtualTradingRoom: string;
  availableBalance: string;
  positions: string;
  buy: string;
  sell: string;
  shares: string;
  avgPrice: string;
  currentVal: string;
  pnl: string;
  amount: string;
  invalidAmount: string;
  insufficientFunds: string;
  insufficientHoldings: string;
  resetPortfolio: string;
  portfolioSummary: string;
  portfolioValue: string;
  cashBalance: string;
  totalProfitLoss: string;
  clear: string;
  set: string;
  priceAlert: string;
  alertSetFor: string;
  enterAlertPrice: string;
  agents: string;
  aiTradingAgents: string;
  autonomousAgents: string;
  analyzing: string;
  trading: string;
  idle: string;
  cooldown: string;
  managedBalance: string;
  winRate: string;
  totalTrades: string;
  activeMarkets: string;
  uptime: string;
  recentActivity: string;
  noAgentsDeployed: string;
  agentPerformance: string;
  aiDiary: string;
  aiDiaryFeed: string;
  selfCriticism: string;
  profitNote: string;
  lossNote: string;
  stopLossTriggered: string;
  takeProfitTriggered: string;
  manualClose: string;
  diaryEmpty: string;
  lessonsLearned: string;
  allEntries: string;
  profitsOnly: string;
  lossesOnly: string;
  criticismOnly: string;
}

export const translations: Record<'en' | 'tr', TranslationSet> = {
  en: {
    dashboard: "Live Tickers",
    aiInsights: "AI Insights",
    insightsHub: "AI Insights Hub",
    sentimentIndices: "Grounding sentiment indices",
    simLive: "SIM LIVE",
    simPaused: "SIM PAUSED",
    allAssets: "All Assets",
    stocks: "Stocks",
    cryptos: "Cryptos",
    watchlistOnly: "Watchlist",
    marketHeatIndex: "Market Heat INDEX",
    consensus: "Consensus",
    activeSimulation: "Active Simulation",
    assetTicker: "Asset Ticker",
    trend24h: "24H Trend",
    marketValue: "Market Value",
    high24h: "24H High",
    low24h: "24H Low",
    marketCap: "Market Cap",
    volume24h: "Volume (24h)",
    blogConsensus: "Blog Consensus Analysis",
    groundedGoogle: "Google Grounded",
    summoningGoogle: "Summoning Google Search Index...",
    activeAggregators: "Aggregators active for",
    consensusPredictionsIndex: "Consensus Predictions index",
    topRankedWatchlist: "Top Ranked Watchlist Asset Trends",
    aiOffline: "AI Off-line",
    bloggerFocusChannels: "Blogger Focus Channels",
    recentUpdates: "Recent Updates",
    noSearchInsights: "No search intelligence fetched yet.",
    compileAi: "Compile AI",
    backToTickers: "Back to Live Tickers",
    developersNote: "Developers Note",
    noMatchingAssets: "No assets match your current filters.",
    resetAllFilters: "Reset All Filters",
    sleekIntelInterface: "Sleek Intelligence Interface",
    fearGreedLabel: {
      'Greed': "Greed",
      'Extreme Greed': "Extreme Greed",
      'Fear': "Fear",
      'Extreme Fear': "Extreme Fear",
      'Neutral': "Neutral"
    },
    sentimentMeter: "AI Sentiment Meter",
    bullish: "Bullish",
    bearish: "Bearish",
    neutral: "Neutral",
    stronglyBullish: "Strongly Bullish",
    stronglyBearish: "Strongly Bearish",
    latestBlogConsensus: "Latest Blog Consensus",
    expertBlogDrivers: "Expert Blog Drivers",
    citedSearchResources: "Cited Search Resources",
    groundingLinks: "Grounding Links",
    predictionRange: "PREDICTION RANGE",
    analystDisclaimer: "Compiled from consensus analyst forecasts over the past 48 hours.",
    virtualTradingRoom: "Virtual Trading Room",
    availableBalance: "Available Cash",
    positions: "Active Holdings",
    buy: "Buy",
    sell: "Sell",
    shares: "Shares",
    avgPrice: "Avg Price",
    currentVal: "Value",
    pnl: "P&L",
    amount: "Amount",
    invalidAmount: "Please enter a valid positive quantity.",
    insufficientFunds: "Insufficient paper trading cash balance.",
    insufficientHoldings: "You do not own enough units of this asset.",
    resetPortfolio: "Reset Portfolio",
    portfolioSummary: "Virtual Portfolio",
    portfolioValue: "Total Assets",
    cashBalance: "Cash Balance",
    totalProfitLoss: "Total Profit/Loss",
    clear: "Clear",
    set: "Set",
    priceAlert: "Price Alert",
    alertSetFor: "Alert set for",
    enterAlertPrice: "Set alert price...",
    agents: "AI Agents",
    aiTradingAgents: "AI Trading Agents",
    autonomousAgents: "Autonomous AI buy/sell agents",
    analyzing: "Analyzing",
    trading: "Trading",
    idle: "Idle",
    cooldown: "Cooldown",
    managedBalance: "Managed Balance",
    winRate: "Win Rate",
    totalTrades: "Total Trades",
    activeMarkets: "Active Markets",
    uptime: "Uptime",
    recentActivity: "Recent Activity",
    noAgentsDeployed: "No agents deployed yet.",
    agentPerformance: "Agent Performance",
    aiDiary: "AI Trading Diary",
    aiDiaryFeed: "AI Decision Log",
    selfCriticism: "Self-Criticism Report",
    profitNote: "Profit Note",
    lossNote: "Loss Analysis",
    stopLossTriggered: "Stop-Loss Triggered",
    takeProfitTriggered: "Take-Profit Triggered",
    manualClose: "Manual Close",
    diaryEmpty: "No trading diary entries yet. Agents will record their decisions here as they trade.",
    lessonsLearned: "Lessons Learned",
    allEntries: "All",
    profitsOnly: "Profits",
    lossesOnly: "Losses",
    criticismOnly: "Criticism"
  },
  tr: {
    dashboard: "Canlı Fiyatlar",
    aiInsights: "Yapay Zeka Analizi",
    insightsHub: "Analiz Merkezi",
    sentimentIndices: "Duygu durum endeksleri taranıyor",
    simLive: "SIM AKTİF",
    simPaused: "SIM DURDU",
    allAssets: "Tüm Varlıklar",
    stocks: "Hisseler",
    cryptos: "Kriptolar",
    watchlistOnly: "Takip Listesi",
    marketHeatIndex: "Isı Endeksi Consensüsü",
    consensus: "Fikir Birliği",
    activeSimulation: "Aktif Simülasyon",
    assetTicker: "Varlık Kodu",
    trend24h: "24S Trend",
    marketValue: "Piyasa Fiyatı",
    high24h: "En Yüksek (24S)",
    low24h: "En Düşük (24S)",
    marketCap: "Piyasa Değeri",
    volume24h: "Hacim (24S)",
    blogConsensus: "Blog Konsensüs Analizi",
    groundedGoogle: "Google Destekli",
    summoningGoogle: "Google Arama Dizini Taranıyor...",
    activeAggregators: "Veriler derleniyor:",
    consensusPredictionsIndex: "Konsensüs Tahmin Endeksi",
    topRankedWatchlist: "İzleme Listesi Varlık Trendleri",
    aiOffline: "YZ Çevrimdışı",
    bloggerFocusChannels: "Odak Finans Blogları",
    recentUpdates: "Güncel Gelişmeler",
    noSearchInsights: "Arama zekası henüz çekilmedi.",
    compileAi: "Derle",
    backToTickers: "Fiyat Listesine Geri Dön",
    developersNote: "Geliştirici Notu",
    noMatchingAssets: "Filtrelerinize uygun varlık bulunamadı.",
    resetAllFilters: "Tüm Filtreleri Sıfırla",
    sleekIntelInterface: "Şık Finansal Analitik Platformu",
    fearGreedLabel: {
      'Greed': "Açgözlülük",
      'Extreme Greed': "Aşırı Açgözlülük",
      'Fear': "Korku",
      'Extreme Fear': "Aşırı Korku",
      'Neutral': "Nötr"
    },
    sentimentMeter: "YZ Duygu Durum Barometresi",
    bullish: "Yükseliş (Boğa)",
    bearish: "Düşüş (Ayı)",
    neutral: "Nötr",
    stronglyBullish: "Güçlü Alım",
    stronglyBearish: "Güçlü Satım",
    latestBlogConsensus: "Güncel Blog Fikir Birliği",
    expertBlogDrivers: "Uzman Blog Faktörleri",
    citedSearchResources: "Kaynak Gösterilen Yayınlar",
    groundingLinks: "Doğrulama Linkleri",
    predictionRange: "BEKLENEN FİYAT ARALIĞI",
    analystDisclaimer: "Son 48 saatteki analist ve finans blogu tahminlerinden derlenmiştir.",
    virtualTradingRoom: "Sanal İşlem Odası",
    availableBalance: "Kullanılabilir Bakiye",
    positions: "Aktif Pozisyonlar",
    buy: "Satın Al",
    sell: "Sat",
    shares: "Adet",
    avgPrice: "Ort. Alış",
    currentVal: "Net Değer",
    pnl: "Kâr/Zarar",
    amount: "Miktar",
    invalidAmount: "Lütfen geçerli ve pozitif bir miktar giriniz.",
    insufficientFunds: "Yetersiz bakiye. İşlem gerçekleştirilemedi.",
    insufficientHoldings: "Elinizde yeterli miktarda varlık bulunmamaktadır.",
    resetPortfolio: "Portföyü Sıfırla",
    portfolioSummary: "Sanal Portfev", // "Sanal Portföy"
    portfolioValue: "Toplam Varlık",
    cashBalance: "Nakit Bakiyesi",
    totalProfitLoss: "Toplam Kâr/Zarar",
    clear: "Temizle",
    set: "Kur",
    priceAlert: "Destek Alarmı",
    alertSetFor: "Alarm şunun için kuruldu",
    enterAlertPrice: "Alarm kurmak için fiyat...",
    agents: "YZ Ajanları",
    aiTradingAgents: "YZ Al-Sat Ajanları",
    autonomousAgents: "Otonom yapay zeka al-sat ajanları",
    analyzing: "Analiz Ediyor",
    trading: "İşlemde",
    idle: "Beklemede",
    cooldown: "Dinlenmede",
    managedBalance: "Yönetilen Bakiye",
    winRate: "Kazanma Oranı",
    totalTrades: "Toplam İşlem",
    activeMarkets: "Aktif Piyasalar",
    uptime: "Çalışma Süresi",
    recentActivity: "Son İşlemler",
    noAgentsDeployed: "Henüz ajan konuşlandırılmadı.",
    agentPerformance: "Ajan Performansı",
    aiDiary: "YZ İşlem Günlüğü",
    aiDiaryFeed: "YZ Karar Günlüğü",
    selfCriticism: "Öz-Eleştiri Raporu",
    profitNote: "Kâr Notu",
    lossNote: "Zarar Analizi",
    stopLossTriggered: "Stop-Loss Tetiklendi",
    takeProfitTriggered: "Kâr-Al Tetiklendi",
    manualClose: "Manuel Kapanış",
    diaryEmpty: "Henüz işlem günlüğü kaydı yok. Ajanlar işlem yaptıkça kararları burada görünecek.",
    lessonsLearned: "Çıkarılan Dersler",
    allEntries: "Tümü",
    profitsOnly: "Kârlar",
    lossesOnly: "Zararlar",
    criticismOnly: "Eleştiriler"
  }
};
