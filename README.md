# Market Dashboard

Personal financial markets dashboard — credit spreads, CDX proxies, global equities, and interest rates.

## Quick Start

```bash
./start.sh
```

Then open **http://localhost:5173**

---

## Setup

### 1. FRED API Key (required for spreads and rates)

Free registration at https://fred.stlouisfed.org/docs/api/api_key.html — takes 2 minutes.

```bash
echo "FRED_API_KEY=your_key_here" > backend/.env
```

### 2. Manual setup

**Backend**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then add your FRED_API_KEY
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## Data Sources

| Section | Instrument | Source | Series |
|---|---|---|---|
| Credit Spreads | US High Yield | FRED / ICE BofA | `BAMLH0A0HYM2` |
| Credit Spreads | US Investment Grade | FRED / ICE BofA | `BAMLC0A0CM` |
| Credit Spreads | US BBB | FRED / ICE BofA | `BAMLC0A4CBBBEY` |
| Credit Spreads | Euro High Yield | FRED / ICE BofA | `BAMLHE00EHY0EY` |
| Credit Spreads | Euro Investment Grade | FRED / ICE BofA | `BAMLHE00EIG0EY` |
| Credit Spreads | EM Corporate | FRED / ICE BofA | `BAMLEMCBPIOAS` |
| Credit Spreads | EM Sovereign | FRED / ICE BofA | `BAMLEMPBPUBSICRPIOAS` |
| Credit Spreads | Agency MBS | FRED (Freddie Mac / Fed) | `MORTGAGE30US` − `DGS10` |
| CDX / iTraxx | All four instruments | FRED proxy (ICE BofA) | See above |
| Interest Rates | UST curve, Fed Funds, ECB, Bund, Gilt, JGB | FRED | Various |
| Global Equities | 14 indices + 2 ETFs + VIX/VSTOXX | Yahoo Finance | Various |

### CDX / iTraxx Note

Real CDX and iTraxx levels require a **Markit / Bloomberg Data License**. The CDX section
uses ICE BofA cash index OAS as proxies — directionally accurate and appropriate for
relative value analysis, but not identical to the synthetic index levels.

### Morningstar Direct (planned)

Add `MORNINGSTAR_API_KEY` to `backend/.env` when available. Intended for enhanced
fund analytics and fixed income data.

---

## Features

- **5 time periods**: YTD, 1Y, 3Y, 5Y, 10Y (toggle in header)
- **Percentile rank**: Each spread card shows where current levels sit vs. the selected period
- **Click-to-expand**: Any spread card or equity row opens a full modal chart with detailed stats
- **Auto-refresh**: Every 10 minutes; manual refresh button in header
- **5-minute cache**: Backend caches all FRED/Yahoo responses to avoid rate limits
