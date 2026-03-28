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

import httpx
import yfinance as yf
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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
    {"key": "fed_funds", "fred_id": "DFF",              "name": "Fed Funds",      "region": "US"},
    {"key": "sofr",      "fred_id": "SOFR",             "name": "SOFR",           "region": "US"},
    {"key": "us_2y",     "fred_id": "DGS2",             "name": "US 2Y",          "region": "US"},
    {"key": "us_5y",     "fred_id": "DGS5",             "name": "US 5Y",          "region": "US"},
    {"key": "us_10y",    "fred_id": "DGS10",            "name": "US 10Y",         "region": "US"},
    {"key": "us_30y",    "fred_id": "DGS30",            "name": "US 30Y",         "region": "US"},
    {"key": "ecb_rate",  "fred_id": "ECBDFR",           "name": "ECB Depo Rate",  "region": "Europe"},
    {"key": "de_10y",    "fred_id": "IRLTLT01DEM156N",  "name": "Bund 10Y",       "region": "Europe"},
    {"key": "uk_10y",    "fred_id": "IRLTLT01GBM156N",  "name": "Gilt 10Y",       "region": "UK"},
    {"key": "jp_10y",    "fred_id": "IRLTLT01JPM156N",  "name": "JGB 10Y",        "region": "Asia"},
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

        # Derived: 2s10s slope
        if "us_2y" in results and "us_10y" in results:
            d2 = {d["date"]: d["value"] for d in results["us_2y"].get("data", [])}
            d10 = {d["date"]: d["value"] for d in results["us_10y"].get("data", [])}
            common = sorted(set(d2) & set(d10))
            slope = [{"date": dt, "value": round((d10[dt] - d2[dt]) * 100, 1)} for dt in common]
            results["2s10s"] = {
                "key": "2s10s",
                "name": "2s10s Slope",
                "region": "US",
                "data": slope,
                "stats": compute_stats(slope, is_rate=False),
                "unit": "bps",
            }

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
