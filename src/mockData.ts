import { Asset } from './types';

export const INITIAL_ASSETS: Asset[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'crypto',
    price: 0,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    high24h: 0,
    low24h: 0,
    history: [],
    description: 'Bitcoin is the first decentralized digital currency. Live price synced from Binance via KeFur backend.'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    category: 'crypto',
    price: 0,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    high24h: 0,
    low24h: 0,
    history: [],
    description: 'Ethereum is a decentralized, open-source blockchain with smart contract functionality. Live price synced from Binance via KeFur backend.'
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    category: 'crypto',
    price: 0,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    high24h: 0,
    low24h: 0,
    history: [],
    description: 'Solana is a high-performance blockchain. Live price synced from Binance via KeFur backend.'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    category: 'stock',
    price: 189.84,
    change24h: 0.85,
    volume24h: 8900000000,
    marketCap: 2950000000000,
    high24h: 191.20,
    low24h: 188.50,
    history: [188.60, 188.80, 189.10, 188.90, 189.30, 189.50, 189.20, 189.60, 189.90, 189.70, 190.10, 189.84],
    description: 'Apple Inc. is an American multinational technology company headquartered in Cupertino, California, that designs, develops, and sells consumer electronics.'
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    category: 'stock',
    price: 177.46,
    change24h: -2.31,
    volume24h: 14200000000,
    marketCap: 560000000000,
    high24h: 182.40,
    low24h: 175.80,
    history: [181.50, 182.20, 181.10, 179.50, 178.60, 179.10, 178.20, 177.90, 178.40, 176.90, 177.30, 177.46],
    description: 'Tesla, Inc. is an American multinational automotive and clean energy company headquartered in Austin, Texas. It designs and manufactures electric vehicles.'
  },
  {
    symbol: 'XRP',
    name: 'Ripple',
    category: 'crypto',
    price: 1.15,
    change24h: 1.45,
    volume24h: 2150000000,
    marketCap: 64000000000,
    high24h: 1.20,
    low24h: 1.10,
    history: [1.08, 1.09, 1.11, 1.10, 1.12, 1.11, 1.13, 1.12, 1.15],
    description: 'XRP is a digital asset built for decentralized global real-time payments, offering rapid speed and lower transaction fees.'
  },
  {
    symbol: 'BIST100',
    name: 'Borsa Istanbul 100',
    category: 'stock',
    price: 10450.80,
    change24h: 1.15,
    volume24h: 3120000000,
    marketCap: 280000000000,
    high24h: 10520.00,
    low24h: 10310.50,
    history: [10320, 10340, 10310.5, 10380, 10400, 10390, 10420, 10450, 10440, 10480, 10460, 10450.80],
    description: 'The BIST 100 Index is a capitalization-weighted index composed of the 100 most liquid and highly capitalized stocks traded on the Borsa Istanbul.'
  }
];
