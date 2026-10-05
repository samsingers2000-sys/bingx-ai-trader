# BingX AI Trader

A full-stack MVP trading dashboard for an exchange account with: live-style market data, paper trading mode, risk engine, signal scoring, order management, and a dashboard UI.

## Features
- React + Vite frontend
- Node + Express + TypeScript backend
- Market dashboard with mock/real-style pricing
- Risk engine and trading limits
- Paper trading mode by default
- BingX-ready config for live integration
- WebSocket-ready architecture

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment settings:
   ```bash
   cp .env.example .env
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open the frontend:
   - http://localhost:5173

5. API is available at:
   - http://localhost:4000/api/health

## Default behavior
- Trading mode is `paper` by default.
- No real orders are sent unless you switch to live and provide valid BingX keys.

## Important
This project is an MVP and safe-by-default. It is not financial advice and should be tested in paper mode before any live usage.
