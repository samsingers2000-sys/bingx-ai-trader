import { useEffect, useMemo, useState } from 'react';

type Account = {
  balance: number;
  equity: number;
  dailyPnL: number;
  mode: string;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
  tradingEnabled: boolean;
  emergencyStop: boolean;
};

type Market = {
  symbol: string;
  lastPrice: number;
  markPrice: number;
  indexPrice: number;
  bid: number;
  ask: number;
  volume: number;
  fundingRate: number;
  timestamp: string;
};

type Signal = {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  reason: string[];
  timeframe: string;
  confidence: string;
};

type Position = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  return response.json() as Promise<T>;
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const refreshData = async () => {
    try {
      const [accountData, marketData, signalData, positionsData] = await Promise.all([
        fetchJson<Account>('/api/account'),
        fetchJson<Market>('/api/market?symbol=XAUUSD'),
        fetchJson<Signal>('/api/signals'),
        fetchJson<{ positions: Position[] }>('/api/positions')
      ]);

      setAccount(accountData);
      setMarket(marketData);
      setSignal(signalData);
      setPositions(positionsData.positions);
    } catch (error) {
      console.error(error);
      setMessage('Unable to connect to the API. Start the backend server first.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const id = window.setInterval(refreshData, 4000);
    return () => window.clearInterval(id);
  }, []);

  const openTrade = async (side: 'LONG' | 'SHORT') => {
    if (!account) return;

    try {
      const result = await fetchJson<{ message: string; position: Position }>(`/api/trading/open`, {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', side, quantity: 0.1 })
      });
      setMessage(`${side} order submitted in ${account.mode.toUpperCase()} mode. ${result.message}`);
      await refreshData();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed';
      setMessage(text);
    }
  };

  const closeTrade = async (positionId: string) => {
    try {
      const result = await fetchJson<{ message: string }>(`/api/trading/close`, {
        method: 'POST',
        body: JSON.stringify({ positionId })
      });
      setMessage(result.message);
      await refreshData();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed';
      setMessage(text);
    }
  };

  const emergencyStop = async () => {
    try {
      const result = await fetchJson<{ message: string }>(`/api/emergency-stop`, {
        method: 'POST'
      });
      setMessage(result.message);
      await refreshData();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed';
      setMessage(text);
    }
  };

  const openPositions = useMemo(() => positions.filter((p) => p.status === 'OPEN'), [positions]);

  if (loading) {
    return <div className="app-shell"><div className="panel loading">Loading dashboard...</div></div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BINGX AI TRADER</p>
          <h1>Trading dashboard</h1>
        </div>
        <div className="status-group">
          <span className={`pill ${account?.tradingEnabled ? 'success' : 'danger'}`}>
            {account?.tradingEnabled ? 'LIVE READY' : 'PAUSED'}
          </span>
          <span className="pill neutral">{account?.mode.toUpperCase()}</span>
        </div>
      </header>

      <section className="stats-grid">
        <div className="panel stat-card">
          <span>Balance</span>
          <strong>${account?.balance.toFixed(2)}</strong>
        </div>
        <div className="panel stat-card">
          <span>Equity</span>
          <strong>${account?.equity.toFixed(2)}</strong>
        </div>
        <div className="panel stat-card">
          <span>Daily PnL</span>
          <strong>{account?.dailyPnL.toFixed(2)}%</strong>
        </div>
      </section>

      <main className="grid-layout">
        <div className="panel market-panel">
          <div className="panel-header">
            <h2>XAU / GOLD</h2>
            <span className={`signal-badge ${signal?.direction === 'LONG' ? 'long' : 'short'}`}>{signal?.direction}</span>
          </div>

          <div className="price-box">
            <span className="label">Last</span>
            <strong>${market?.lastPrice.toFixed(2)}</strong>
          </div>

          <div className="chart-bars">
            <span style={{ height: '28%' }} />
            <span style={{ height: '42%' }} />
            <span style={{ height: '61%' }} />
            <span style={{ height: '58%' }} />
            <span style={{ height: '72%' }} />
            <span style={{ height: '80%' }} />
            <span style={{ height: '66%' }} />
            <span style={{ height: '84%' }} />
            <span style={{ height: '90%' }} />
            <span style={{ height: '100%' }} />
          </div>

          <div className="trade-actions">
            <button className="primary" onClick={() => openTrade('LONG')}>OPEN LONG</button>
            <button className="secondary" onClick={() => openTrade('SHORT')}>OPEN SHORT</button>
            <button className="danger" onClick={emergencyStop}>EMERGENCY STOP</button>
          </div>
        </div>

        <div className="panel signal-panel">
          <h2>Signal</h2>
          <div className="signal-card">
            <div className="signal-topline">
              <span>{signal?.symbol}</span>
              <span className="score">{signal?.score}/100</span>
            </div>
            <div className="key-values">
              <div><span>Entry</span><strong>{signal?.entry.toFixed(2)}</strong></div>
              <div><span>SL</span><strong>{signal?.stopLoss.toFixed(2)}</strong></div>
              <div><span>TP</span><strong>{signal?.takeProfit.toFixed(2)}</strong></div>
            </div>
            <ul>
              {signal?.reason.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </main>

      <section className="panel open-positions">
        <div className="panel-header">
          <h2>Open positions</h2>
          <span>{openPositions.length} active</span>
        </div>

        {openPositions.length === 0 ? (
          <div className="empty-box">No open positions.</div>
        ) : (
          <div className="positions-list">
            {openPositions.map((position) => (
              <div key={position.id} className="position-row">
                <div>
                  <strong>{position.symbol}</strong>
                  <span>{position.side}</span>
                </div>
                <div>Qty: {position.quantity}</div>
                <div>Entry: {position.entryPrice.toFixed(2)}</div>
                <div>Current: {position.currentPrice.toFixed(2)}</div>
                <div>PNL: ${position.pnl.toFixed(2)}</div>
                <button onClick={() => closeTrade(position.id)}>CLOSE</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="panel system-panel">
        <h3>System</h3>
        <div className="system-status">
          <span>🟢 API connected</span>
          <span>🟢 Market data</span>
          <span>🟢 Risk engine active</span>
        </div>
        {message && <p className="message">{message}</p>}
      </footer>
    </div>
  );
}
