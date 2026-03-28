import { useEffect } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { X, Info } from 'lucide-react'
import { fmtDateAxis, fmtDate, percentileColor, percentileLabel } from '../utils/formatters'

function StatBox({ label, value, color }) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 text-center">
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div className="font-mono font-semibold text-sm text-slate-100" style={color ? { color } : {}}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label, isRate, isEquity }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  const formatted = val == null ? '—'
    : isEquity ? val.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : isRate ? `${val.toFixed(2)}%`
    : `${Math.round(val)} bps`
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
      <p className="font-mono font-semibold text-slate-100 text-sm">{formatted}</p>
    </div>
  )
}

export default function ChartModal({ item, onClose }) {
  const { name, description, source, data = [], stats = {}, color = '#3b82f6', note, type } = item
  const isRate = type === 'rate'
  const isEquity = type === 'equity'
  const isSpread = type === 'spread'

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const formatVal = (v) => {
    if (v == null) return '—'
    if (isEquity) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
    if (isRate) return `${v.toFixed(2)}%`
    return `${Math.round(v)} bps`
  }

  const pColor = percentileColor(stats.percentile)
  const gradId = 'modal-grad'

  const statsItems = [
    { label: 'Current',    value: formatVal(stats.current) },
    { label: '1D Chg',     value: stats.change_1d != null ? `${stats.change_1d > 0 ? '+' : ''}${isRate || isEquity ? stats.change_1d?.toFixed(2) : Math.round(stats.change_1d)}${isSpread ? ' bps' : isRate ? '%' : ''}` : '—' },
    { label: 'YTD Chg',    value: stats.change_ytd != null ? `${stats.change_ytd > 0 ? '+' : ''}${isRate || isEquity ? stats.change_ytd?.toFixed(2) : Math.round(stats.change_ytd)}${isSpread ? ' bps' : isRate ? '%' : ''}` : '—' },
    { label: 'Period Low',  value: formatVal(stats.min) },
    { label: 'Period High', value: formatVal(stats.max) },
    { label: 'Average',     value: formatVal(stats.mean) },
    {
      label: 'Percentile',
      value: stats.percentile != null ? `${Math.round(stats.percentile)}th · ${percentileLabel(stats.percentile)}` : '—',
      color: pColor,
    },
  ]

  const Chart = isEquity ? LineChart : AreaChart

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60">

        {/* Header */}
        <div
          className="flex items-start justify-between p-5 border-b border-slate-800"
          style={{ borderTopColor: color, borderTopWidth: 3, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-bold text-slate-100 leading-tight">{name}</h2>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
            {source && <p className="text-[10px] text-slate-600 mt-0.5 font-mono">Source: {source}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-500 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg p-1.5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats row */}
        <div className="p-5 border-b border-slate-800">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {statsItems.map(({ label, value, color: c }) => (
              <StatBox key={label} label={label} value={value} color={c} />
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="p-5">
          {data.length > 1 ? (
            <div className="h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <Chart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDateAxis}
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={{ stroke: '#1e293b' }}
                    tickLine={false}
                    minTickGap={50}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      isEquity ? v.toLocaleString('en-US', { notation: 'compact' })
                      : isRate ? `${v.toFixed(1)}%`
                      : `${v}`
                    }
                    width={46}
                  />
                  <Tooltip
                    content={<CustomTooltip isRate={isRate} isEquity={isEquity} />}
                  />
                  {stats.mean != null && !isEquity && (
                    <ReferenceLine
                      y={stats.mean}
                      stroke="#475569"
                      strokeDasharray="5 4"
                      label={{ value: `Avg ${formatVal(stats.mean)}`, fill: '#64748b', fontSize: 10, position: 'right' }}
                    />
                  )}
                  {isEquity ? (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#${gradId})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </Chart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-slate-500">
              No chart data available
            </div>
          )}
        </div>

        {/* Note */}
        {note && (
          <div className="px-5 pb-5">
            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2.5">
              <Info size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-400/80 leading-snug">{note}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
