"""
Market Dashboard – FastAPI Backend
Data sources:
  - FRED (St. Louis Fed): ICE BofA OAS credit spreads, treasury rates
  - Yahoo Finance (yfinance): Global equity indices, ETF proxies
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx
import yfinance as yf
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="Market Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRED_API_KEY: str = os.getenv("FRED_API_KEY", "")
FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations"

# ─── In-memory cache (5-minute TTL) ──────────────────────────────────────────

_cache: dict[str, tuple[object, float]] = {}
CACHE_TTL = 300  # seconds


def cache_get(key: str):
    if key in _cache:
        data, ts = _cache[key]
        if time.monotonic() - ts < CACHE_TTL:
            return data
    return None


def cache_set(key: str, data):
    _cache[key] = (data, time.monotonic())


# ─── Catalogue ───────────────────────────────────────────────────────────────

SPREAD_SERIES = [
    {
        "key": "us_hy",
        "fred_id": "BAMLH0A0HYM2",
        "name": "US High Yield",
        "short": "US HY",
        "description": "ICE BofA US High Yield Master II OAS",
        "source": "FRED · ICE BofA",
        "color": "#ef4444",
        "category": "credit",
        "region": "US",
        "cdx_label": "CDX.NA.HY 5Y",
        "note": None,
    },
    {
        "key": "us_ig",
        "fred_id": "BAMLC0A0CM",
        "name": "US Investment Grade",
        "short": "US IG",
        "description": "ICE BofA US Corporate Master OAS",
        "source": "FRED · ICE BofA",
        "color": "#3b82f6",
        "category": "credit",
        "region": "US",
        "cdx_label": "CDX.NA.IG 5Y",
        "note": None,
    },
    {
        "key": "us_bbb",
        "fred_id": "BAMLC0A4CBBBEY",
        "name": "US BBB",
        "short": "US BBB",
        "description": "ICE BofA BBB US Corporate Index OAS",
        "source": "FRED · ICE BofA",
        "color": "#60a5fa",
        "category": "credit",
        "region": "US",
        "cdx_label": None,
        "note": None,
    },
    {
        "key": "euro_hy",
        "fred_id": "BAMLHE00EHY0EY",
        "name": "Euro High Yield",
        "short": "EUR HY",
        "description": "ICE BofA Euro High Yield Index OAS",
        "source": "FRED · ICE BofA",
        "color": "#f97316",
        "category": "credit",
        "region": "Europe",
        "cdx_label": "iTraxx Xover 5Y",
        "note": None,
    },
    {
        "key": "euro_ig",
        "fred_id": "BAMLHE00EIG0EY",
        "name": "Euro Investment Grade",
        "short": "EUR IG",
        "description": "ICE BofA Euro Corporate Index OAS",
        "source": "FRED · ICE BofA",
        "color": "#a78bfa",
        "category": "credit",
        "region": "Europe",
        "cdx_label": "iTraxx Europe 5Y",
        "note": None,
    },
    {
        "key": "em_corp",
        "fred_id": "BAMLEMCBPIOAS",
        "name": "EM Corporate",
        "short": "EM Corp",
        "description": "ICE BofA Emerging Markets Corporate Plus OAS",
        "source": "FRED · ICE BofA",
        "color": "#10b981",
        "category": "em",
        "region": "EM",
        "cdx_label": None,
        "note": None,
    },
    {
        "key": "em_sovereign",
        "fred_id": "BAMLEMPBPUBSICRPIOAS",
        "name": "EM Sovereign",
        "short": "EM Sov",
        "description": "ICE BofA EM Public Sector Crossover OAS",
        "source": "FRED · ICE BofA",
        "color": "#06b6d4",
        "category": "em",
        "region": "EM",
        "cdx_label": None,
        "note": None,
    },
]

# ETF proxies for CDX – used in /api/cdx
CDX_ETF_PROXIES = [
    {
        "key": "cdx_hy",
        "name": "CDX.NA.HY 5Y",
        "short": "CDX HY",
        "description": "HYG ETF yield spread over 5Y Treasury",
        "etf_ticker": "HYG",
        "etf_name": "iShares iBoxx $ High Yield Corporate Bond ETF",
        "fred_oas_key": "us_hy",
        "source": "Yahoo Finance · FRED",
        "color": "#dc2626",
        "note": "Proxy: HYG ETF 30d SEC yield minus 5Y UST. Real CDX requires Markit/Bloomberg license.",
    },
    {
        "key": "cdx_ig",
        "name": "CDX.NA.IG 5Y",
        "short": "CDX IG",
        "description": "LQD ETF yield spread over 5Y Treasury",
        "etf_ticker": "LQD",
        "etf_name": "iShares iBoxx $ Investment Grade Corporate Bond ETF",
        "fred_oas_key": "us_ig",
        "source": "Yahoo Finance · FRED",
        "color": "#2563eb",
        "note": "Proxy: LQD ETF 30d SEC yield minus 5Y UST. Real CDX requires Markit/Bloomberg license.",
    },
    {
        "key": "itraxx_europe",
        "name": "iTraxx Europe 5Y",
        "short": "iTrx Eur",
        "description": "Euro IG ICE BofA OAS proxy",
        "etf_ticker": "LQDE.L",
        "etf_name": "iShares € Corp Bond UCITS ETF",
        "fred_oas_key": "euro_ig",
        "source": "FRED · ICE BofA",
        "color": "#7c3aed",
        "note": "Proxy: ICE BofA Euro IG OAS (BAMLHE00EIG0EY). Real iTraxx requires Markit/Bloomberg license.",
    },
    {
        "key": "itraxx_xover",
        "name": "iTraxx Xover 5Y",
        "short": "iTrx Xovr",
        "description": "Euro HY ICE BofA OAS proxy",
        "etf_ticker": "IHYG.L",
        "etf_name": "iShares € High Yield Corp Bond UCITS ETF",
        "fred_oas_key": "euro_hy",
        "source": "FRED · ICE BofA",
        "color": "#b45309",
        "note": "Proxy: ICE BofA Euro HY OAS (BAMLHE00EHY0EY). Real iTraxx requires Markit/Bloomberg license.",
    },
]

EQUITY_TICKERS = [
    # US
    {"key": "sp500",   "ticker": "^GSPC",    "name": "S&P 500",          "region": "US",         "is_etf": False},
    {"key": "nasdaq",  "ticker": "^IXIC",    "name": "NASDAQ Composite", "region": "US",         "is_etf": False},
    {"key": "russell", "ticker": "^RUT",     "name": "Russell 2000",     "region": "US",         "is_etf": False},
    {"key": "dow",     "ticker": "^DJI",     "name": "Dow Jones",        "region": "US",         "is_etf": False},
    # Europe
    {"key": "stoxx50", "ticker": "^STOXX50E","name": "Euro Stoxx 50",    "region": "Europe",     "is_etf": False},
    {"key": "dax",     "ticker": "^GDAXI",   "name": "DAX",              "region": "Europe",     "is_etf": False},
    {"key": "ftse",    "ticker": "^FTSE",    "name": "FTSE 100",         "region": "UK",         "is_etf": False},
    {"key": "cac",     "ticker": "^FCHI",    "name": "CAC 40",           "region": "Europe",     "is_etf": False},
    # Asia-Pacific
    {"key": "nikkei",  "ticker": "^N225",    "name": "Nikkei 225",       "region": "Asia",       "is_etf": False},
    {"key": "hangseng","ticker": "^HSI",     "name": "Hang Seng",        "region": "Asia",       "is_etf": False},
    {"key": "kospi",   "ticker": "^KS11",    "name": "KOSPI",            "region": "Asia",       "is_etf": False},
    {"key": "asx200",  "ticker": "^AXJO",    "name": "ASX 200",          "region": "Asia",       "is_etf": False},
    # EM / Global
    {"key": "msci_em", "ticker": "EEM",      "name": "MSCI EM",          "region": "EM",         "is_etf": True},
    {"key": "msci_w",  "ticker": "URTH",     "name": "MSCI World",       "region": "Global",     "is_etf": True},
    # Volatility
    {"key": "vix",     "ticker": "^VIX",     "name": "VIX",              "region": "Volatility", "is_etf": False},
    {"key": "vstoxx",  "ticker": "^V2TX",    "name": "VSTOXX",           "region": "Volatility", "is_etf": False},
]

RATE_SERIES = [
    # Policy rates
    {"key": "fed_funds", "fred_id": "DFF",              "name": "Fed Funds",      "region": "US"},
    {"key": "sofr",      "fred_id": "SOFR",             "name": "SOFR",           "region": "US"},
    # UST nominal curve
    {"key": "us_2y",     "fred_id": "DGS2",             "name": "UST 2Y",         "region": "US"},
    {"key": "us_5y",     "fred_id": "DGS5",             "name": "UST 5Y",         "region": "US"},
    {"key": "us_10y",    "fred_id": "DGS10",            "name": "UST 10Y",        "region": "US"},
    {"key": "us_30y",    "fred_id": "DGS30",            "name": "UST 30Y",        "region": "US"},
    # TIPS real yields
    {"key": "tips_5y",   "fred_id": "DFII5",            "name": "TIPS 5Y",        "region": "Real"},
    {"key": "tips_10y",  "fred_id": "DFII10",           "name": "TIPS 10Y",       "region": "Real"},
    {"key": "tips_30y",  "fred_id": "DFII30",           "name": "TIPS 30Y",       "region": "Real"},
    # Breakeven inflation
    {"key": "bei_5y",    "fred_id": "T5YIE",            "name": "5Y BEI",         "region": "Inflation"},
    {"key": "bei_10y",   "fred_id": "T10YIE",           "name": "10Y BEI",        "region": "Inflation"},
    {"key": "bei_5y5y",  "fred_id": "T5YIFR",           "name": "5Y5Y Fwd",       "region": "Inflation"},
    # International
    {"key": "ecb_rate",  "fred_id": "ECBDFR",           "name": "ECB Depo",       "region": "Europe"},
    {"key": "de_10y",    "fred_id": "IRLTLT01DEM156N",  "name": "Bund 10Y",       "region": "Europe"},
    {"key": "uk_10y",    "fred_id": "IRLTLT01GBM156N",  "name": "Gilt 10Y",       "region": "UK"},
    {"key": "jp_10y",    "fred_id": "IRLTLT01JPM156N",  "name": "JGB 10Y",        "region": "Asia"},
]

# ─── Macro economic indicators ────────────────────────────────────────────────

MACRO_SERIES = [
    # Growth
    {"key": "gdp",          "fred_id": "A191RL1Q225SBEA", "name": "Real GDP",          "unit": "% ann.",  "transform": "level",   "freq": "Q", "color": "#3b82f6",  "target": None},
    # Inflation (level series → YoY computed)
    {"key": "core_pce",     "fred_id": "PCEPILFE",        "name": "Core PCE",          "unit": "% YoY",   "transform": "yoy",     "freq": "M", "color": "#ef4444",  "target": 2.0},
    {"key": "core_cpi",     "fred_id": "CPILFESL",        "name": "Core CPI",          "unit": "% YoY",   "transform": "yoy",     "freq": "M", "color": "#f97316",  "target": None},
    {"key": "cpi",          "fred_id": "CPIAUCSL",        "name": "CPI",               "unit": "% YoY",   "transform": "yoy",     "freq": "M", "color": "#fb923c",  "target": None},
    {"key": "pce",          "fred_id": "PCEPI",           "name": "PCE",               "unit": "% YoY",   "transform": "yoy",     "freq": "M", "color": "#fbbf24",  "target": 2.0},
    # Labor
    {"key": "unemployment", "fred_id": "UNRATE",          "name": "Unemployment",      "unit": "%",       "transform": "level",   "freq": "M", "color": "#10b981",  "target": None},
    {"key": "nfp",          "fred_id": "PAYEMS",          "name": "Payrolls",          "unit": "K MoM",   "transform": "mom",     "freq": "M", "color": "#06b6d4",  "target": None},
    # Activity
    {"key": "indpro",       "fred_id": "INDPRO",          "name": "Industrial Prod.",  "unit": "% YoY",   "transform": "yoy",     "freq": "M", "color": "#8b5cf6",  "target": None},
    {"key": "retail_sales", "fred_id": "RSXFS",           "name": "Retail Sales",      "unit": "% YoY",   "transform": "yoy",     "freq": "M", "color": "#a78bfa",  "target": None},
    {"key": "housing",      "fred_id": "HOUST",           "name": "Housing Starts",    "unit": "K SAAR",  "transform": "level",   "freq": "M", "color": "#84cc16",  "target": None},
    {"key": "lei",          "fred_id": "USSLIND",         "name": "Leading Index",     "unit": "% MoM",   "transform": "mom_pct", "freq": "M", "color": "#34d399",  "target": None},
    {"key": "umich",        "fred_id": "UMCSENT",         "name": "UMich Sentiment",   "unit": "index",   "transform": "level",   "freq": "M", "color": "#22d3ee",  "target": None},
]

# ─── Commodities ──────────────────────────────────────────────────────────────

COMMODITY_TICKERS = [
    {"key": "wti",      "ticker": "CL=F",   "name": "WTI Crude",    "unit": "USD/bbl",    "category": "Energy"},
    {"key": "brent",    "ticker": "BZ=F",   "name": "Brent Crude",  "unit": "USD/bbl",    "category": "Energy"},
    {"key": "natgas",   "ticker": "NG=F",   "name": "Natural Gas",  "unit": "USD/MMBtu",  "category": "Energy"},
    {"key": "gold",     "ticker": "GC=F",   "name": "Gold",         "unit": "USD/oz",     "category": "Metals"},
    {"key": "silver",   "ticker": "SI=F",   "name": "Silver",       "unit": "USD/oz",     "category": "Metals"},
    {"key": "copper",   "ticker": "HG=F",   "name": "Copper",       "unit": "USD/lb",     "category": "Metals"},
    {"key": "platinum", "ticker": "PL=F",   "name": "Platinum",     "unit": "USD/oz",     "category": "Metals"},
    {"key": "wheat",    "ticker": "ZW=F",   "name": "Wheat",        "unit": "USD/bu",     "category": "Agri"},
    {"key": "corn",     "ticker": "ZC=F",   "name": "Corn",         "unit": "USD/bu",     "category": "Agri"},
    {"key": "soybeans", "ticker": "ZS=F",   "name": "Soybeans",     "unit": "USD/bu",     "category": "Agri"},
]

# ─── FX ──────────────────────────────────────────────────────────────────────

FX_TICKERS = [
    {"key": "dxy",    "ticker": "DX-Y.NYB", "name": "DXY",      "quote": "index",       "usd_dir": "direct"},
    {"key": "eurusd", "ticker": "EURUSD=X", "name": "EUR/USD",  "quote": "USD/EUR",     "usd_dir": "inverse"},
    {"key": "gbpusd", "ticker": "GBPUSD=X", "name": "GBP/USD",  "quote": "USD/GBP",     "usd_dir": "inverse"},
    {"key": "usdjpy", "ticker": "USDJPY=X", "name": "USD/JPY",  "quote": "JPY/USD",     "usd_dir": "direct"},
    {"key": "usdchf", "ticker": "USDCHF=X", "name": "USD/CHF",  "quote": "CHF/USD",     "usd_dir": "direct"},
    {"key": "audusd", "ticker": "AUDUSD=X", "name": "AUD/USD",  "quote": "USD/AUD",     "usd_dir": "inverse"},
    {"key": "usdcad", "ticker": "USDCAD=X", "name": "USD/CAD",  "quote": "CAD/USD",     "usd_dir": "direct"},
    {"key": "usdcny", "ticker": "USDCNY=X", "name": "USD/CNY",  "quote": "CNY/USD",     "usd_dir": "direct"},
    {"key": "usdbrl", "ticker": "USDBRL=X", "name": "USD/BRL",  "quote": "BRL/USD",     "usd_dir": "direct"},
    {"key": "usdmxn", "ticker": "USDMXN=X", "name": "USD/MXN",  "quote": "MXN/USD",     "usd_dir": "direct"},
    {"key": "usdinr", "ticker": "USDINR=X", "name": "USD/INR",  "quote": "INR/USD",     "usd_dir": "direct"},
    {"key": "usdkrw", "ticker": "USDKRW=X", "name": "USD/KRW",  "quote": "KRW/USD",     "usd_dir": "direct"},
    {"key": "usdzar", "ticker": "USDZAR=X", "name": "USD/ZAR",  "quote": "ZAR/USD",     "usd_dir": "direct"},
]

# ─── Fed balance sheet ────────────────────────────────────────────────────────

FED_SERIES = [
    {"key": "fed_total",    "fred_id": "WALCL",   "name": "Total Assets",     "unit": "$B"},
    {"key": "fed_tsy",      "fred_id": "TREAST",  "name": "Treasuries",       "unit": "$B"},
    {"key": "fed_mbs",      "fred_id": "MBST",    "name": "MBS Holdings",     "unit": "$B"},
    {"key": "fed_revrepo",  "fred_id": "WLRRAL",  "name": "Reverse Repo",     "unit": "$B"},
    {"key": "fed_reserves", "fred_id": "WRESBAL", "name": "Reserve Balances", "unit": "$B"},
    {"key": "m2",           "fred_id": "M2SL",    "name": "M2 Money Supply",  "unit": "$B"},
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_start_date(period: str) -> str:
    if period == "ytd":
        return datetime.now().replace(month=1, day=1).strftime("%Y-%m-%d")
    days_map = {"1y": 365, "3y": 1095, "5y": 1825, "10y": 3650}
    days = days_map.get(period, 365)
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")


async def fred_fetch_raw(client: httpx.AsyncClient, series_id: str, start_date: str) -> list[dict]:
    """Fetch FRED observations. Values returned as-is (percent)."""
    resp = await client.get(
        FRED_OBS_URL,
        params={
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "observation_start": start_date,
            "sort_order": "asc",
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    return [
        {"date": o["date"], "value": float(o["value"])}
        for o in resp.json().get("observations", [])
        if o["value"] not in (".", "")
    ]


async def fred_fetch_bps(client: httpx.AsyncClient, series_id: str, start_date: str) -> list[dict]:
    """Fetch FRED OAS series and convert percent → basis points."""
    raw = await fred_fetch_raw(client, series_id, start_date)
    return [{"date": d["date"], "value": round(d["value"] * 100, 2)} for d in raw]


def compute_yoy(data: list[dict]) -> list[dict]:
    """Year-over-year % change from a monthly level series."""
    by_ym: dict[str, float] = {}
    for d in data:
        ym = d["date"][:7]  # "YYYY-MM"
        by_ym[ym] = d["value"]
    result = []
    for d in data:
        dt = datetime.strptime(d["date"], "%Y-%m-%d")
        prev_dt = dt.replace(year=dt.year - 1)
        prev_ym = prev_dt.strftime("%Y-%m")
        prev_val = by_ym.get(prev_ym)
        if prev_val is not None and prev_val != 0:
            result.append({"date": d["date"], "value": round((d["value"] / prev_val - 1) * 100, 3)})
    return result


def compute_mom(data: list[dict], pct: bool = False) -> list[dict]:
    """Month-over-month absolute or percent change."""
    result = []
    for i in range(1, len(data)):
        prev, curr = data[i - 1]["value"], data[i]["value"]
        val = round((curr / prev - 1) * 100, 3) if (pct and prev) else round(curr - prev, 3)
        result.append({"date": data[i]["date"], "value": val})
    return result


def compute_stats(data: list[dict], is_rate: bool = False) -> dict:
    if not data or len(data) < 2:
        return {}
    values = [d["value"] for d in data]
    current = values[-1]
    ytd_start = datetime.now().replace(month=1, day=1).strftime("%Y-%m-%d")
    ytd_vals = [d for d in data if d["date"] >= ytd_start]
    n = len(values)
    pct_rank = round(sum(1 for v in values if v <= current) / n * 100, 1)

    stats: dict = {
        "current": round(current, 3 if is_rate else 1),
        "change_1d": round(current - values[-2], 3 if is_rate else 1),
        "change_ytd": round(current - ytd_vals[0]["value"], 3 if is_rate else 1) if ytd_vals else None,
        "min": round(min(values), 1),
        "max": round(max(values), 1),
        "mean": round(sum(values) / n, 1),
        "percentile": pct_rank,
        "n_obs": n,
    }
    return stats


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/spreads")
async def get_spreads(period: str = Query("3y")):
    cache_key = f"spreads_{period}"
    if cached := cache_get(cache_key):
        return cached

    if not FRED_API_KEY:
        raise HTTPException(500, detail="FRED_API_KEY not set – add it to backend/.env")

    start_date = get_start_date(period)
    results: dict = {}

    async with httpx.AsyncClient() as client:
        # Fetch all OAS series concurrently
        tasks = {s["key"]: fred_fetch_bps(client, s["fred_id"], start_date) for s in SPREAD_SERIES}
        settled = await asyncio.gather(*tasks.values(), return_exceptions=True)

        for meta, result in zip(SPREAD_SERIES, settled):
            if isinstance(result, Exception):
                results[meta["key"]] = {**meta, "data": [], "stats": {}, "error": str(result)}
            else:
                results[meta["key"]] = {**meta, "data": result, "stats": compute_stats(result)}

        # MBS spread: Freddie Mac 30Y mortgage rate − 10Y UST (both in bps for subtraction)
        try:
            mtg_raw, tsy_raw = await asyncio.gather(
                fred_fetch_raw(client, "MORTGAGE30US", start_date),
                fred_fetch_raw(client, "DGS10", start_date),
            )
            tsy_dict = {d["date"]: d["value"] for d in tsy_raw}
            mbs_data: list[dict] = []
            for d in mtg_raw:
                tsy_val = tsy_dict.get(d["date"])
                if tsy_val is None:
                    dt = datetime.strptime(d["date"], "%Y-%m-%d")
                    for offset in range(1, 8):
                        alt = (dt - timedelta(days=offset)).strftime("%Y-%m-%d")
                        if alt in tsy_dict:
                            tsy_val = tsy_dict[alt]
                            break
                if tsy_val is not None:
                    # Both are in %; spread in bps = (mtg - tsy) * 100
                    mbs_data.append({"date": d["date"], "value": round((d["value"] - tsy_val) * 100, 1)})

            mbs_meta = {
                "key": "mbs",
                "name": "Agency MBS",
                "short": "MBS",
                "description": "Primary MBS spread: Freddie Mac 30Y Mortgage − 10Y UST",
                "source": "FRED · Freddie Mac / Federal Reserve",
                "color": "#d97706",
                "category": "securitized",
                "region": "US",
                "cdx_label": None,
                "note": "Proxy: 30Y Primary Mortgage Rate (weekly) minus 10Y Constant Maturity Treasury. Reflects primary market, not agency MBS OAS.",
            }
            results["mbs"] = {**mbs_meta, "data": mbs_data, "stats": compute_stats(mbs_data)}
        except Exception as e:
            results["mbs"] = {
                "key": "mbs", "name": "Agency MBS", "short": "MBS",
                "color": "#d97706", "data": [], "stats": {}, "error": str(e),
            }

    cache_set(cache_key, results)
    return results


@app.get("/api/equities")
async def get_equities(period: str = Query("1y")):
    cache_key = f"equities_{period}"
    if cached := cache_get(cache_key):
        return cached

    # yfinance period strings
    yf_period = {"ytd": "ytd", "1y": "1y", "3y": "3y", "5y": "5y", "10y": "10y"}.get(period, "1y")

    def fetch_one(meta: dict) -> tuple[str, dict]:
        try:
            hist = yf.Ticker(meta["ticker"]).history(period=yf_period, auto_adjust=True)
            if hist.empty:
                return meta["key"], {**meta, "data": [], "stats": {}, "error": "No data"}
            data = [
                {"date": idx.strftime("%Y-%m-%d"), "value": round(float(row["Close"]), 4)}
                for idx, row in hist.iterrows()
            ]
            if not data:
                return meta["key"], {**meta, "data": [], "stats": {}}
            current = data[-1]["value"]
            prev = data[-2]["value"] if len(data) >= 2 else current
            ytd_start = datetime.now().replace(month=1, day=1).strftime("%Y-%m-%d")
            ytd_vals = [d for d in data if d["date"] >= ytd_start]
            one_yr_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
            yr_vals = [d for d in data if d["date"] >= one_yr_ago]
            stats = {
                "current": current,
                "change_1d": round(current - prev, 4),
                "change_1d_pct": round((current / prev - 1) * 100, 2) if prev else None,
                "change_ytd_pct": round((current / ytd_vals[0]["value"] - 1) * 100, 2) if ytd_vals else None,
                "change_1y_pct": round((current / yr_vals[0]["value"] - 1) * 100, 2) if yr_vals else None,
            }
            return meta["key"], {**meta, "data": data, "stats": stats}
        except Exception as exc:
            return meta["key"], {**meta, "data": [], "stats": {}, "error": str(exc)}

    results: dict = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for key, result in ex.map(lambda m: fetch_one(m), EQUITY_TICKERS):
            results[key] = result

    cache_set(cache_key, results)
    return results


@app.get("/api/rates")
async def get_rates(period: str = Query("3y")):
    cache_key = f"rates_{period}"
    if cached := cache_get(cache_key):
        return cached

    if not FRED_API_KEY:
        raise HTTPException(500, detail="FRED_API_KEY not set")

    start_date = get_start_date(period)
    results: dict = {}

    async with httpx.AsyncClient() as client:
        for series in RATE_SERIES:
            try:
                data = await fred_fetch_raw(client, series["fred_id"], start_date)
                results[series["key"]] = {
                    **series,
                    "data": data,
                    "stats": compute_stats(data, is_rate=True),
                }
            except Exception as e:
                results[series["key"]] = {**series, "data": [], "stats": {}, "error": str(e)}

        # Derived slopes (bps)
        def slope_series(key_short: str, key_long: str, label: str, region: str = "US"):
            ds = {d["date"]: d["value"] for d in results.get(key_short, {}).get("data", [])}
            dl = {d["date"]: d["value"] for d in results.get(key_long,  {}).get("data", [])}
            common = sorted(set(ds) & set(dl))
            data = [{"date": dt, "value": round((dl[dt] - ds[dt]) * 100, 1)} for dt in common]
            results[f"{key_short[3:]}s{key_long[3:]}s"] = {
                "key": f"{key_short[3:]}s{key_long[3:]}s",
                "name": label, "region": region,
                "data": data, "stats": compute_stats(data), "unit": "bps",
            }

        slope_series("us_2y",  "us_10y", "2s10s Slope")
        slope_series("us_5y",  "us_30y", "5s30s Slope")

        # Derived: 10Y real rate (nominal - 10Y BEI)
        dn = {d["date"]: d["value"] for d in results.get("us_10y",  {}).get("data", [])}
        db = {d["date"]: d["value"] for d in results.get("bei_10y", {}).get("data", [])}
        common_r = sorted(set(dn) & set(db))
        real_data = [{"date": dt, "value": round(dn[dt] - db[dt], 3)} for dt in common_r]
        results["real_10y"] = {
            "key": "real_10y", "name": "10Y Real Rate", "region": "Real",
            "data": real_data, "stats": compute_stats(real_data, is_rate=True),
        }

    cache_set(cache_key, results)
    return results


@app.get("/api/macro")
async def get_macro(period: str = Query("3y")):
    cache_key = f"macro_{period}"
    if cached := cache_get(cache_key):
        return cached

    if not FRED_API_KEY:
        raise HTTPException(500, detail="FRED_API_KEY not set")

    start_date = get_start_date(period)
    # Fetch 14 extra months so YoY transforms have enough prior data
    dt_start = datetime.strptime(start_date, "%Y-%m-%d")
    extended = (dt_start - timedelta(days=425)).strftime("%Y-%m-%d")

    results: dict = {}
    async with httpx.AsyncClient() as client:
        for series in MACRO_SERIES:
            try:
                raw = await fred_fetch_raw(client, series["fred_id"], extended)
                transform = series.get("transform", "level")
                if transform == "yoy":
                    data = [d for d in compute_yoy(raw) if d["date"] >= start_date]
                elif transform == "mom":
                    data = [d for d in compute_mom(raw, pct=False) if d["date"] >= start_date]
                elif transform == "mom_pct":
                    data = [d for d in compute_mom(raw, pct=True) if d["date"] >= start_date]
                else:
                    data = [d for d in raw if d["date"] >= start_date]
                results[series["key"]] = {
                    **series,
                    "data": data,
                    "stats": compute_stats(data, is_rate=True),
                }
            except Exception as e:
                results[series["key"]] = {**series, "data": [], "stats": {}, "error": str(e)}

    cache_set(cache_key, results)
    return results


@app.get("/api/commodities")
async def get_commodities(period: str = Query("1y")):
    cache_key = f"commodities_{period}"
    if cached := cache_get(cache_key):
        return cached

    yf_period = {"ytd": "ytd", "1y": "1y", "3y": "3y", "5y": "5y", "10y": "10y"}.get(period, "1y")

    def fetch_one(meta: dict) -> tuple[str, dict]:
        try:
            hist = yf.Ticker(meta["ticker"]).history(period=yf_period, auto_adjust=True)
            if hist.empty:
                return meta["key"], {**meta, "data": [], "stats": {}, "error": "No data"}
            data = [
                {"date": idx.strftime("%Y-%m-%d"), "value": round(float(row["Close"]), 4)}
                for idx, row in hist.iterrows()
            ]
            current = data[-1]["value"]
            prev    = data[-2]["value"] if len(data) >= 2 else current
            ytd_start = datetime.now().replace(month=1, day=1).strftime("%Y-%m-%d")
            ytd_vals  = [d for d in data if d["date"] >= ytd_start]
            yr_vals   = [d for d in data if d["date"] >= (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")]
            stats = {
                "current": current,
                "change_1d_pct":  round((current / prev - 1) * 100, 2) if prev else None,
                "change_ytd_pct": round((current / ytd_vals[0]["value"] - 1) * 100, 2) if ytd_vals else None,
                "change_1y_pct":  round((current / yr_vals[0]["value"]  - 1) * 100, 2) if yr_vals else None,
            }
            return meta["key"], {**meta, "data": data, "stats": stats}
        except Exception as exc:
            return meta["key"], {**meta, "data": [], "stats": {}, "error": str(exc)}

    results: dict = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for key, result in ex.map(fetch_one, COMMODITY_TICKERS):
            results[key] = result

    # Derived: Copper/Gold ratio (global growth proxy)
    if "copper" in results and "gold" in results:
        cd = {d["date"]: d["value"] for d in results["copper"].get("data", [])}
        gd = {d["date"]: d["value"] for d in results["gold"].get("data", [])}
        common = sorted(set(cd) & set(gd))
        cg_data = [{"date": dt, "value": round(cd[dt] / gd[dt] * 1000, 4)} for dt in common if gd[dt]]
        results["copper_gold"] = {
            "key": "copper_gold", "ticker": None,
            "name": "Copper/Gold Ratio", "unit": "×1000",
            "category": "Derived",
            "data": cg_data, "stats": compute_stats(cg_data, is_rate=True),
            "note": "Copper/Gold ×1000. Rising = risk-on / global growth positive.",
        }

    cache_set(cache_key, results)
    return results


@app.get("/api/fx")
async def get_fx(period: str = Query("1y")):
    cache_key = f"fx_{period}"
    if cached := cache_get(cache_key):
        return cached

    yf_period = {"ytd": "ytd", "1y": "1y", "3y": "3y", "5y": "5y", "10y": "10y"}.get(period, "1y")

    def fetch_one(meta: dict) -> tuple[str, dict]:
        try:
            hist = yf.Ticker(meta["ticker"]).history(period=yf_period, auto_adjust=True)
            if hist.empty:
                return meta["key"], {**meta, "data": [], "stats": {}, "error": "No data"}
            data = [
                {"date": idx.strftime("%Y-%m-%d"), "value": round(float(row["Close"]), 5)}
                for idx, row in hist.iterrows()
            ]
            current = data[-1]["value"]
            prev    = data[-2]["value"] if len(data) >= 2 else current
            ytd_start = datetime.now().replace(month=1, day=1).strftime("%Y-%m-%d")
            ytd_vals  = [d for d in data if d["date"] >= ytd_start]
            yr_vals   = [d for d in data if d["date"] >= (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")]
            stats = {
                "current": current,
                "change_1d_pct":  round((current / prev - 1) * 100, 3) if prev else None,
                "change_ytd_pct": round((current / ytd_vals[0]["value"] - 1) * 100, 2) if ytd_vals else None,
                "change_1y_pct":  round((current / yr_vals[0]["value"]  - 1) * 100, 2) if yr_vals else None,
            }
            return meta["key"], {**meta, "data": data, "stats": stats}
        except Exception as exc:
            return meta["key"], {**meta, "data": [], "stats": {}, "error": str(exc)}

    results: dict = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=14) as ex:
        for key, result in ex.map(fetch_one, FX_TICKERS):
            results[key] = result

    cache_set(cache_key, results)
    return results


@app.get("/api/fed")
async def get_fed(period: str = Query("3y")):
    cache_key = f"fed_{period}"
    if cached := cache_get(cache_key):
        return cached

    if not FRED_API_KEY:
        raise HTTPException(500, detail="FRED_API_KEY not set")

    start_date = get_start_date(period)
    results: dict = {}

    async with httpx.AsyncClient() as client:
        for series in FED_SERIES:
            try:
                raw = await fred_fetch_raw(client, series["fred_id"], start_date)
                # FRED reports in millions; convert to billions
                data = [{"date": d["date"], "value": round(d["value"] / 1000, 1)} for d in raw]
                results[series["key"]] = {
                    **series, "data": data,
                    "stats": compute_stats(data, is_rate=True),
                }
            except Exception as e:
                results[series["key"]] = {**series, "data": [], "stats": {}, "error": str(e)}

    # Stacked composition for chart: Treasuries + MBS + Other
    keys = ["fed_total", "fed_tsy", "fed_mbs"]
    if all(k in results and results[k].get("data") for k in keys):
        td = {d["date"]: d["value"] for d in results["fed_total"]["data"]}
        ty = {d["date"]: d["value"] for d in results["fed_tsy"]["data"]}
        mb = {d["date"]: d["value"] for d in results["fed_mbs"]["data"]}
        common = sorted(set(td) & set(ty) & set(mb))
        results["_stacked"] = [
            {"date": dt, "treasuries": ty[dt], "mbs": mb[dt],
             "other": round(td[dt] - ty[dt] - mb[dt], 1), "total": td[dt]}
            for dt in common
        ]

    cache_set(cache_key, results)
    return results


@app.get("/api/cdx")
async def get_cdx(period: str = Query("3y")):
    """
    CDX / iTraxx market data.
    Returns ICE BofA OAS proxies from FRED plus current ETF yield data from Yahoo Finance.
    Real CDX levels require a Markit/Bloomberg Data License.
    """
    cache_key = f"cdx_{period}"
    if cached := cache_get(cache_key):
        return cached

    if not FRED_API_KEY:
        raise HTTPException(500, detail="FRED_API_KEY not set")

    start_date = get_start_date(period)

    # Get the underlying OAS data for each CDX proxy
    fred_keys_needed = {p["fred_oas_key"] for p in CDX_ETF_PROXIES}
    spread_meta_map = {s["key"]: s for s in SPREAD_SERIES}

    results: dict = {}

    async with httpx.AsyncClient() as client:
        fred_tasks = {
            key: fred_fetch_bps(client, spread_meta_map[key]["fred_id"], start_date)
            for key in fred_keys_needed
            if key in spread_meta_map
        }
        fred_data: dict = {}
        for key, coro in fred_tasks.items():
            try:
                fred_data[key] = await coro
            except Exception as e:
                fred_data[key] = []

    # Get current ETF yield data (sync, run in thread)
    def get_etf_info(ticker: str) -> dict:
        try:
            info = yf.Ticker(ticker).info
            return {
                "sec_yield": info.get("yield"),
                "trailing_yield": info.get("trailingAnnualDividendYield"),
                "long_name": info.get("longName", ticker),
                "nav": info.get("navPrice"),
                "aum": info.get("totalAssets"),
            }
        except Exception:
            return {}

    with concurrent.futures.ThreadPoolExecutor() as ex:
        etf_infos = {
            p["etf_ticker"]: ex.submit(get_etf_info, p["etf_ticker"])
            for p in CDX_ETF_PROXIES
        }
        etf_infos = {ticker: fut.result() for ticker, fut in etf_infos.items()}

    for proxy in CDX_ETF_PROXIES:
        oas_data = fred_data.get(proxy["fred_oas_key"], [])
        stats = compute_stats(oas_data)
        etf_info = etf_infos.get(proxy["etf_ticker"], {})
        results[proxy["key"]] = {
            **proxy,
            "data": oas_data,
            "stats": stats,
            "etf_info": etf_info,
        }

    cache_set(cache_key, results)
    return results


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "fred_key_set": bool(FRED_API_KEY),
        "timestamp": datetime.now().isoformat(),
        "cache_entries": len(_cache),
    }


# ─── Serve React frontend (production) ───────────────────────────────────────
# The React app is built into backend/static/ via `npm run build`.
# FastAPI serves it here so the whole dashboard is one URL with no separate
# frontend server needed.

_static_dir = Path(__file__).parent / "static"

if _static_dir.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")

    # Catch-all: serve index.html for any non-API route (supports client-side routing)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        index = _static_dir / "index.html"
        return FileResponse(str(index))
