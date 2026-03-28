import { RefreshCw, Activity, TrendingUp } from 'lucide-react'
import { fmtDate } from '../utils/formatters'

const PERIODS = [
  { value: 'ytd', label: 'YTD' },
  { value: '1y',  label: '1Y'  },
  { value: '3y',  label: '3Y'  },
  { value: '5y',  label: '5Y'  },
  { value: '10y', label: '10Y' },
]

export default function Header({ period, onPeriodChange, lastUpdated, loading, onRefresh }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-[#080b10]/90 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-100">
            Market Dashboard
          </span>
          <span className="hidden sm:block text-xs text-slate-600 font-mono border border-slate-800 px-1.5 py-0.5 rounded">
            PERSONAL
          </span>
        </div>

        {/* Period selector */}
        <nav className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onPeriodChange(value)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all duration-150 ${
                period === value
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && (
            <span className="hidden md:block text-xs text-slate-600 font-mono">
              Updated {fmtDate(lastUpdated.toISOString(), 'HH:mm')}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:block">{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <Activity size={12} className={loading ? 'text-amber-400 animate-pulse-slow' : 'text-emerald-400'} />
            <span className="hidden lg:block text-xs font-mono text-slate-500">LIVE</span>
          </div>
        </div>

      </div>
    </header>
  )
}
