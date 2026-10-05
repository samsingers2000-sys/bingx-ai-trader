import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

type Side = 'LONG' | 'SHORT';

type Position = {
  id: string;
  symbol: string;
  side: Side;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
};

type TradeSignal = {
  symbol: string;
  direction: Side;
  score: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  reason: string[];
  timeframe: string;
};

const app = express();
const PORT = Number(process.env.PORT || 4000);
const mode = (process.env.TRADING_MODE || 'paper').toLowerCase();

const state = {
  balance: 1000,
  equity: 1024,
  dailyPnL: 2.4,
  riskPerTrade: Number(process.env.RISK_PER_TRADE || 0.01),
  maxDailyLoss: Number(process.env.MAX_DAILY_LOSS || 0.03),
  maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS || 1),
  positions: [] as Position[],
  tradingEnabled: true,
  emergencyStop: false,
  lastSignal: {
    symbol: 'XAUUSD',
    direction: 'LONG',
    score: 87,
    entry: 2328.64,
    stopLoss: 2314.22,
    takeProfit: 2357.2,
    reason: ['Bullish structure', 'EMA trend confirmation', 'Support rejection', 'MACD bullish crossover'],
    timeframe: '1H'
  } as TradeSignal
};

app.use(cors());
app.use(express.json());

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculatePnl(entry: number, current: number, side: Side, quantity: number) {
  const delta = current - entry;
  return side === 'LONG' ? delta * quantity : -delta * quantity;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode,
    timestamp: new Date().toISOString(),
    tradingEnabled: state.tradingEnabled && !state.emergencyStop
  });
});

app.get('/api/account', (_req, res) => {
  res.json({
    balance: state.balance,
    equity: state.equity,
    dailyPnL: state.dailyPnL,
    mode,
    riskPerTrade: state.riskPerTrade,
    maxDailyLoss: state.maxDailyLoss,
    maxOpenPositions: state.maxOpenPositions,
    tradingEnabled: state.tradingEnabled && !state.emergencyStop,
    emergencyStop: state.emergencyStop
  });
});

app.get('/api/market', (req, res) => {
  const symbol = String(req.query.symbol || 'XAUUSD');
  const basePrice = 2328.64;
  const volatility = 1.2;
  const spread = 0.38;
  const now = new Date();

  const price = Number((basePrice + Math.sin(now.getTime() / 8000) * volatility).toFixed(2));

  res.json({
    symbol,
    lastPrice: price,
    markPrice: Number((price - spread / 2).toFixed(2)),
    indexPrice: Number((price + 0.2).toFixed(2)),
    bid: Number((price - spread).toFixed(2)),
    ask: Number((price + spread).toFixed(2)),
    volume: 1823000,
    fundingRate: 0.0002,
    timeframe: '1H',
    timestamp: now.toISOString()
  });
});

app.get('/api/signals', (_req, res) => {
  res.json({
    symbol: state.lastSignal.symbol,
    direction: state.lastSignal.direction,
    score: state.lastSignal.score,
    entry: state.lastSignal.entry,
    stopLoss: state.lastSignal.stopLoss,
    takeProfit: state.lastSignal.takeProfit,
    reason: state.lastSignal.reason,
    timeframe: state.lastSignal.timeframe,
    confidence: `${state.lastSignal.score}%`
  });
});

app.get('/api/positions', (_req, res) => {
  res.json({
    positions: state.positions,
    count: state.positions.filter((p) => p.status === 'OPEN').length
  });
});

app.post('/api/trading/open', (req, res) => {
  if (state.emergencyStop) {
    return res.status(403).json({ error: 'Emergency stop is active. Trading is paused.' });
  }

  const { symbol, side, quantity } = req.body as { symbol?: string; side?: Side; quantity?: number };

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ error: 'symbol, side, and quantity are required.' });
  }

  const activeOpenPositions = state.positions.filter((p) => p.status === 'OPEN').length;
  if (activeOpenPositions >= state.maxOpenPositions) {
    return res.status(400).json({ error: 'Max open positions reached.' });
  }

  const entryPrice = Number((Math.random() * 25 + 2300).toFixed(2));
  const stopLoss = side === 'LONG' ? Number((entryPrice * 0.992).toFixed(2)) : Number((entryPrice * 1.008).toFixed(2));
  const takeProfit = side === 'LONG' ? Number((entryPrice * 1.025).toFixed(2)) : Number((entryPrice * 0.975).toFixed(2));

  const position: Position = {
    id: crypto.randomUUID(),
    symbol,
    side,
    quantity: Number(quantity),
    entryPrice,
    currentPrice: entryPrice,
    stopLoss,
    takeProfit,
    pnl: 0,
    status: 'OPEN',
    openedAt: new Date().toISOString()
  };

  state.positions.push(position);

  return res.status(201).json({
    success: true,
    message: 'Order accepted in paper mode.',
    position,
    mode,
    exchangeOrderId: `paper_${Date.now()}`
  });
});

app.post('/api/trading/close', (req, res) => {
  const { positionId } = req.body as { positionId?: string };
  if (!positionId) {
    return res.status(400).json({ error: 'positionId is required.' });
  }

  const position = state.positions.find((p) => p.id === positionId && p.status === 'OPEN');
  if (!position) {
    return res.status(404).json({ error: 'Open position not found.' });
  }

  const exitPrice = Number((position.currentPrice * (position.side === 'LONG' ? 1.003 : 0.997)).toFixed(2));
  const pnl = calculatePnl(position.entryPrice, exitPrice, position.side, position.quantity);
  position.currentPrice = exitPrice;
  position.pnl = pnl;
  position.status = 'CLOSED';
  position.closedAt = new Date().toISOString();

  state.equity = Number((state.equity + pnl).toFixed(2));
  state.dailyPnL = Number((state.dailyPnL + pnl / 1000).toFixed(2));

  return res.json({
    success: true,
    message: 'Position closed successfully.',
    position,
    pnl
  });
});

app.post('/api/settings', (req, res) => {
  const { riskPerTrade, maxDailyLoss, maxOpenPositions, tradingEnabled } = req.body as {
    riskPerTrade?: number;
    maxDailyLoss?: number;
    maxOpenPositions?: number;
    tradingEnabled?: boolean;
  };

  if (riskPerTrade !== undefined) {
    state.riskPerTrade = clamp(Number(riskPerTrade), 0.001, 0.1);
  }

  if (maxDailyLoss !== undefined) {
    state.maxDailyLoss = clamp(Number(maxDailyLoss), 0.01, 0.2);
  }

  if (maxOpenPositions !== undefined) {
    state.maxOpenPositions = clamp(Number(maxOpenPositions), 1, 10);
  }

  if (tradingEnabled !== undefined) {
    state.tradingEnabled = tradingEnabled;
  }

  res.json({
    success: true,
    settings: {
      riskPerTrade: state.riskPerTrade,
      maxDailyLoss: state.maxDailyLoss,
      maxOpenPositions: state.maxOpenPositions,
      tradingEnabled: state.tradingEnabled
    }
  });
});

app.post('/api/emergency-stop', (_req, res) => {
  state.emergencyStop = true;
  state.tradingEnabled = false;
  res.json({ success: true, message: 'Emergency stop activated.' });
});

app.post('/api/emergency-stop/reset', (_req, res) => {
  state.emergencyStop = false;
  state.tradingEnabled = true;
  res.json({ success: true, message: 'Emergency stop reset.' });
});

app.listen(PORT, () => {
  console.log(`BingX AI Trader API running on http://localhost:${PORT}`);
});
