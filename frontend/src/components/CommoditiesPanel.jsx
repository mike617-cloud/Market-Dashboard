import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ── Shared helpers ────────────────────────────────────────────────────────────

function PctCell({ value, invert = false }) {
  if (value == null) return <td className="py-2 px-3 text-right text-slate-600 text-xs font-mono">—</td>
  // invert: for USD/XXX pairs, price going UP means USD stronger (still show raw change)
  const color = value > 0.05 ? 'text-emerald-400' : value < -0.05 ? 'text-red-400' : 'text-slate-400'
  const Icon  = value > 0.05 ? TrendingUp : value < -0.05 ? TrendingDown : Minus
  return (
    <td className={`py-2 px-3 text-right font-mono text-xs font-medium ${color}`}>
      <span className="inline-flex items-center justify-end gap-0.5">
        <Icon size={9} />
        {value > 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </td>
  )
}

function Sparkline({ data, color = '#3b82f6' }) {
  const mini = data?.slice(-60) ?? []
  if (mini.length < 2) return <div className="w-20 h-7" />
  return (
    <div className="w-20 h-7 ml-auto">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={mini} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <YAxis domain={['auto', 'auto']} hide />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SkeletonRow({ cols = 6 }) {
  return (
    <tr className="border-b border-slate-800/50 animate-pulse">
      <td className="py-2 px-3"><div className="h-3 bg-slate-800 rounded w-28" /></td>
      {Array.from({ length: cols - 1 }, (_, i) => (
        <td key={i} className="py-2 px-3 text-right"><div className="h-3 bg-slate-800 rounded w-14 ml-auto" /></td>
      ))}
    </tr>
  )
}

// ── Commodities ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Energy:  '#64748b',
  Metals:  '#d97706',
  Agri:    '#84cc16',
  Derived: '#06b6d4',
}

const COMMODITY_ORDER = [
  'wti', 'brent', 'natgas',
  'gold', 'silver', 'copper', 'platinum',
  'wheat', 'corn', 'soybeans',
  'copper_gold',
]

function CommodityRow({ item }) {
  const { name, unit, category, data, stats } = item
  const color = CATEGORY_COLORS[category] ?? '#64748b'
  const catStyle = {
    Energy:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
    Metals:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Agri:    'bg-lime-500/10 text-lime-400 border-lime-500/20',
    Derived: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  }[category] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  const fmtLevel = (v) => {
    if (v == null) return '—'
    if (unit === '×1000') return v.toFixed(4)
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${catStyle}`}>{category}</span>
          <span className="text-sm font-medium text-slate-200">{name}</span>
          <span className="text-[10px] text-slate-600 font-mono">{unit}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-right font-mono text-sm text-slate-200">{fmtLevel(stats?.current)}</td>
      <PctCell value={stats?.change_1d_pct} />
      <PctCell value={stats?.change_ytd_pct} />
      <PctCell value={stats?.change_1y_pct} />
      <td className="py-2 px-3"><Sparkline data={data} color={color} /></td>
    </tr>
  )
}

export function CommoditiesTable({ data, loading }) {
  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-300">Commodities</span>
        <span className="text-[10px] text-slate-600 font-mono">Front-month futures · Yahoo Finance</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            {['Instrument', 'Level', '1D', 'YTD', '1Y', 'Trend'].map((h, i) => (
              <th key={h} className={`py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading || !data
            ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
            : COMMODITY_ORDER.map(key => data[key]?.stats
                ? <CommodityRow key={key} item={data[key]} />
                : null
              )
          }
        </tbody>
      </table>
    </div>
  )
}

// ── FX ────────────────────────────────────────────────────────────────────────

const FX_ORDER = [
  'dxy',
  'eurusd', 'gbpusd', 'usdjpy', 'usdchf', 'audusd', 'usdcad',
  'usdcny', 'usdbrl', 'usdmxn', 'usdinr', 'usdkrw', 'usdzar',
]

const FX_GROUPS = {
  dxy:    'Index',
  eurusd: 'G10', gbpusd: 'G10', usdjpy: 'G10',
  usdchf: 'G10', audusd: 'G10', usdcad: 'G10',
  usdcny: 'EM',  usdbrl: 'EM',  usdmxn: 'EM',
  usdinr: 'EM',  usdkrw: 'EM',  usdzar: 'EM',
}

const FX_GROUP_STYLE = {
  Index: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  G10:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  EM:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

function FxRow({ item }) {
  const { key, name, quote, usd_dir, data, stats } = item
  const group = FX_GROUPS[key] ?? 'G10'
  const groupStyle = FX_GROUP_STYLE[group]
  // For USD/XXX pairs (usd_dir=direct), rising = USD stronger = use normal green coloring on pct
  // For XXX/USD pairs (eurusd, gbpusd), rising = USD weaker = invert color convention
  const invertColors = usd_dir === 'inverse'

  const fmtLevel = (v) => {
    if (v == null) return '—'
    if (key === 'dxy') return v.toFixed(2)
    if (['usdjpy', 'usdkrw', 'usdinr'].includes(key)) return v.toFixed(2)
    return v.toFixed(4)
  }

  // Color based on USD direction: green = USD stronger
  function UsdPctCell({ value }) {
    if (value == null) return <td className="py-2 px-3 text-right text-slate-600 text-xs font-mono">—</td>
    const usdStrengthening = invertColors ? value < 0 : value > 0
    const color = Math.abs(value) < 0.05 ? 'text-slate-400'
      : usdStrengthening ? 'text-emerald-400' : 'text-red-400'
    return (
      <td className={`py-2 px-3 text-right font-mono text-xs font-medium ${color}`}>
        {value > 0 ? '+' : ''}{value.toFixed(2)}%
      </td>
    )
  }

  const sparkColor = group === 'EM' ? '#06b6d4' : '#8b5cf6'

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${groupStyle}`}>{group}</span>
          <span className="text-sm font-medium text-slate-200">{name}</span>
          <span className="text-[10px] text-slate-600 font-mono">{quote}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-right font-mono text-sm text-slate-200">{fmtLevel(stats?.current)}</td>
      <UsdPctCell value={stats?.change_1d_pct} />
      <UsdPctCell value={stats?.change_ytd_pct} />
      <UsdPctCell value={stats?.change_1y_pct} />
      <td className="py-2 px-3"><Sparkline data={data} color={sparkColor} /></td>
    </tr>
  )
}

export function FxTable({ data, loading }) {
  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-300">FX</span>
        <span className="text-[10px] text-slate-600 font-mono">Indicative mid-market rates · Yahoo Finance · Green = USD stronger</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            {['Pair', 'Rate', '1D', 'YTD', '1Y', 'Trend'].map((h, i) => (
              <th key={h} className={`py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading || !data
            ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
            : FX_ORDER.map(key => data[key]?.stats
                ? <FxRow key={key} item={data[key]} />
                : null
              )
          }
        </tbody>
      </table>
    </div>
  )
}
