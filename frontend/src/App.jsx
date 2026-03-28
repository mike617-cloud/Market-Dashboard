import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import SpreadGrid from './components/SpreadGrid'
import CdxSection from './components/CdxSection'
import RatesPanel from './components/RatesPanel'
import EquityPanel from './components/EquityPanel'
import ChartModal from './components/ChartModal'
import { AlertTriangle } from 'lucide-react'

function SectionHeader({ title, subtitle, badge }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200 tracking-tight">{title}</h2>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium
            bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Divider() {
  return <hr className="border-slate-800/60" />
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
      <AlertTriangle size={14} className="shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export default function App() {
  const [period, setPeriod] = useState('3y')
  const [spreads, setSpreads] = useState(null)
  const [cdx, setCdx] = useState(null)
  const [equities, setEquities] = useState(null)
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState({ spreads: true, cdx: true, equities: true, rates: true })
  const [errors, setErrors] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [modal, setModal] = useState(null)

  const setLoad = (key, val) => setLoading((prev) => ({ ...prev, [key]: val }))
  const setErr  = (key, val) => setErrors((prev) => ({ ...prev, [key]: val }))

  const fetchSpreads = useCallback(async () => {
    setLoad('spreads', true)
    try {
      const res = await fetch(`/api/spreads?period=${period}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSpreads(await res.json())
      setErr('spreads', null)
    } catch (e) { setErr('spreads', e.message) }
    finally { setLoad('spreads', false) }
  }, [period])

  const fetchCdx = useCallback(async () => {
    setLoad('cdx', true)
    try {
      const res = await fetch(`/api/cdx?period=${period}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCdx(await res.json())
      setErr('cdx', null)
    } catch (e) { setErr('cdx', e.message) }
    finally { setLoad('cdx', false) }
  }, [period])

  const fetchEquities = useCallback(async () => {
    setLoad('equities', true)
    try {
      const res = await fetch(`/api/equities?period=${period}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEquities(await res.json())
      setErr('equities', null)
    } catch (e) { setErr('equities', e.message) }
    finally { setLoad('equities', false) }
  }, [period])

  const fetchRates = useCallback(async () => {
    setLoad('rates', true)
    try {
      const res = await fetch(`/api/rates?period=${period}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRates(await res.json())
      setErr('rates', null)
    } catch (e) { setErr('rates', e.message) }
    finally { setLoad('rates', false) }
  }, [period])

  const refreshAll = useCallback(() => {
    fetchSpreads()
    fetchCdx()
    fetchEquities()
    fetchRates()
  }, [fetchSpreads, fetchCdx, fetchEquities, fetchRates])

  // Fetch on period change
  useEffect(() => { refreshAll() }, [refreshAll])

  // Set last updated when all complete
  useEffect(() => {
    if (!loading.spreads && !loading.cdx && !loading.equities && !loading.rates) {
      setLastUpdated(new Date())
    }
  }, [loading])

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const t = setInterval(refreshAll, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [refreshAll])

  const anyLoading = Object.values(loading).some(Boolean)

  return (
    <div className="min-h-screen bg-[#080b10] text-slate-100">
      <Header
        period={period}
        onPeriodChange={setPeriod}
        lastUpdated={lastUpdated}
        loading={anyLoading}
        onRefresh={refreshAll}
      />

      {/* Hero gradient strip */}
      <div
        className="h-px w-full"
        style={{ background: 'linear-gradient(90deg, transparent, #3b82f680, #8b5cf680, #10b98180, transparent)' }}
      />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ── Credit Spreads ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Credit Spreads"
            subtitle="ICE BofA Option-Adjusted Spreads (OAS) via FRED · St. Louis Federal Reserve"
          />
          {errors.spreads
            ? <ErrorBanner message={`Spreads: ${errors.spreads}`} />
            : <SpreadGrid data={spreads} loading={loading.spreads} onSelect={setModal} />
          }
        </section>

        <Divider />

        {/* ── CDX / iTraxx ────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="CDX · iTraxx Markets"
            subtitle="ICE BofA cash index OAS proxies · Real CDX requires Markit/Bloomberg"
            badge="PROXY"
          />
          {errors.cdx
            ? <ErrorBanner message={`CDX: ${errors.cdx}`} />
            : <CdxSection data={cdx} loading={loading.cdx} onSelect={setModal} />
          }
        </section>

        <Divider />

        {/* ── Rates ───────────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Interest Rates"
            subtitle="Central bank rates and government bond yields via FRED"
          />
          {errors.rates
            ? <ErrorBanner message={`Rates: ${errors.rates}`} />
            : <RatesPanel data={rates} loading={loading.rates} />
          }
        </section>

        <Divider />

        {/* ── Global Equities ─────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Global Equity Markets"
            subtitle="Major indices and ETF benchmarks via Yahoo Finance"
          />
          {errors.equities
            ? <ErrorBanner message={`Equities: ${errors.equities}`} />
            : <EquityPanel data={equities} loading={loading.equities} onSelect={setModal} />
          }
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/50 pt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-mono">
          <span>Market Dashboard · Personal Use Only</span>
          <span>
            Data: FRED (ICE BofA / Federal Reserve) · Yahoo Finance · Morningstar (planned)
          </span>
        </footer>

      </main>

      {/* Chart detail modal */}
      {modal && <ChartModal item={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
