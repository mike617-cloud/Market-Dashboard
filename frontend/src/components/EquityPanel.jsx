import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
import { changeColor, fmtPct, fmtNumber } from '../utils/formatters'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const REGION_STYLES = {
  US:         { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20'   },
  Europe:     { bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/20'},
  UK:         { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20'  },
  Asia:       { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  EM:         { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/20'   },
  Global:     { bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-slate-500/20'  },
  Volatility: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
}

const EQUITY_ORDER = [
  'sp500', 'nasdaq', 'russell', 'dow',
  'stoxx50', 'dax', 'ftse', 'cac',
  'nikkei', 'hangseng', 'kospi', 'asx200',
  'msci_em', 'msci_w',
  'vix', 'vstoxx',
]

function PctCell({ value }) {
  if (value == null) return <td className="py-2.5 px-3 text-right text-slate-600 text-xs font-mono">—</td>
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-400'
  const Icon = value > 0.05 ? TrendingUp : value < -0.05 ? TrendingDown : Minus
  return (
    <td className={`py-2.5 px-3 text-right font-mono text-xs font-medium ${color}`}>
      <span className="inline-flex items-center justify-end gap-1">
        <Icon size={10} />
        {value > 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </td>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50 animate-pulse">
      <td className="py-2.5 px-3"><div className="h-3 bg-slate-800 rounded w-32" /></td>
      <td className="py-2.5 px-3 text-right"><div className="h-3 bg-slate-800 rounded w-20 ml-auto" /></td>
      <td className="py-2.5 px-3 text-right"><div className="h-3 bg-slate-800 rounded w-14 ml-auto" /></td>
      <td className="py-2.5 px-3 text-right"><div className="h-3 bg-slate-800 rounded w-14 ml-auto" /></td>
      <td className="py-2.5 px-3 text-right"><div className="h-3 bg-slate-800 rounded w-14 ml-auto" /></td>
      <td className="py-2.5 px-3"><div className="h-8 bg-slate-800/50 rounded w-24 ml-auto" /></td>
    </tr>
  )
}

function EquityRow({ item, onSelect }) {
  const { name, region, is_etf, data, stats } = item
  const miniData = data?.slice(-60) ?? []
  const style = REGION_STYLES[region] ?? REGION_STYLES.Global
  const sparkColor = region === 'Volatility' ? '#f97316' : '#3b82f6'

  const formatCurrent = (v) => {
    if (v == null) return '—'
    if (region === 'Volatility') return v.toFixed(2)
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }

  return (
    <tr
      className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors group"
      onClick={() => onSelect({ ...item, type: 'equity', color: sparkColor })}
    >
      {/* Name + region */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
            {region}
          </span>
          <span className="text-sm font-medium text-slate-200 group-hover:text-slate-100 transition-colors">
            {name}
          </span>
          {is_etf && (
            <span className="text-[10px] text-slate-600 font-mono">ETF</span>
          )}
        </div>
      </td>

      {/* Current */}
      <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-200">
        {formatCurrent(stats?.current)}
      </td>

      {/* 1D% */}
      <PctCell value={stats?.change_1d_pct} />
      {/* YTD% */}
      <PctCell value={stats?.change_ytd_pct} />
      {/* 1Y% */}
      <PctCell value={stats?.change_1y_pct} />

      {/* Sparkline */}
      <td className="py-2.5 px-3">
        <div className="w-24 h-8 ml-auto">
          {miniData.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={miniData} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
                <YAxis domain={['auto', 'auto']} hide />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function EquityPanel({ data, loading, onSelect }) {
  const items = EQUITY_ORDER.map((key) => ({ key, ...(data?.[key] ?? {}) }))

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/80">
            <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Index
            </th>
            <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Level
            </th>
            <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              1D
            </th>
            <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              YTD
            </th>
            <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              1Y
            </th>
            <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {loading || !data
            ? Array.from({ length: 12 }, (_, i) => <SkeletonRow key={i} />)
            : items.length > 0 && items.some(i => i.stats && Object.keys(i.stats).length)
              ? items.map((item) =>
                  item.stats ? (
                    <EquityRow key={item.key} item={item} onSelect={onSelect} />
                  ) : null
                )
              : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                    Equity data unavailable — Yahoo Finance may be temporarily down. Try refreshing.
                  </td>
                </tr>
              )
          }
        </tbody>
      </table>
    </div>
  )
}
