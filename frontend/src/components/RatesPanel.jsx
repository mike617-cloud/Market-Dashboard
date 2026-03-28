import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { fmtRate, fmtPct, spreadChangeColor } from '../utils/formatters'

// Groups render as labelled sub-rows
const RATE_GROUPS = [
  {
    label: 'Policy & Short Rates',
    color: '#3b82f6',
    items: [
      { key: 'fed_funds', label: 'Fed Funds' },
      { key: 'sofr',      label: 'SOFR'      },
      { key: 'ecb_rate',  label: 'ECB Depo'  },
    ],
  },
  {
    label: 'Nominal Curve',
    color: '#6366f1',
    items: [
      { key: 'us_2y',   label: 'UST 2Y'  },
      { key: 'us_5y',   label: 'UST 5Y'  },
      { key: 'us_10y',  label: 'UST 10Y' },
      { key: 'us_30y',  label: 'UST 30Y' },
      { key: '10y_2ys', label: '2s10s'   },
      { key: '5y_30ys', label: '5s30s'   },
      { key: 'de_10y',  label: 'Bund 10Y'},
      { key: 'uk_10y',  label: 'Gilt 10Y'},
      { key: 'jp_10y',  label: 'JGB 10Y' },
    ],
  },
  {
    label: 'Real Rates (TIPS)',
    color: '#10b981',
    items: [
      { key: 'tips_5y',  label: 'TIPS 5Y'  },
      { key: 'tips_10y', label: 'TIPS 10Y' },
      { key: 'tips_30y', label: 'TIPS 30Y' },
      { key: 'real_10y', label: '10Y Real' },
    ],
  },
  {
    label: 'Breakeven Inflation',
    color: '#ef4444',
    items: [
      { key: 'bei_5y',   label: '5Y BEI'   },
      { key: 'bei_10y',  label: '10Y BEI'  },
      { key: 'bei_5y5y', label: '5Y5Y Fwd' },
    ],
  },
]

function RateTile({ meta, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 animate-pulse">
        <div className="h-2.5 bg-slate-800 rounded w-12 mb-2" />
        <div className="h-6 bg-slate-800 rounded w-16 mb-1" />
        <div className="h-2 bg-slate-800/50 rounded w-10" />
        <div className="h-10 bg-slate-800/30 rounded mt-2" />
      </div>
    )
  }

  if (!meta) return null

  const { key, name, label, data = [], stats = {} } = meta
  const is2s10s = key === '2s10s'
  const miniData = data.slice(-120)
  const sparkColor = is2s10s
    ? (stats.current >= 0 ? '#10b981' : '#f97316')
    : '#3b82f6'

  const formatVal = (v) => {
    if (v == null) return '—'
    return is2s10s ? `${v > 0 ? '+' : ''}${v.toFixed(0)} bps` : `${v.toFixed(2)}%`
  }

  const changeVal = stats.change_1d
  const changeColor = is2s10s
    ? (changeVal > 0 ? 'text-emerald-400' : changeVal < 0 ? 'text-red-400' : 'text-slate-500')
    : (changeVal > 0 ? 'text-red-400' : changeVal < 0 ? 'text-emerald-400' : 'text-slate-500')

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
      <div className="text-[10px] text-slate-500 font-mono">{label ?? name}</div>
      <div className="font-mono text-xl font-bold text-slate-100 mt-1 leading-none">
        {formatVal(stats.current)}
      </div>
      <div className={`text-[10px] font-mono mt-0.5 ${changeColor}`}>
        {changeVal != null
          ? `${changeVal > 0 ? '+' : ''}${is2s10s ? changeVal.toFixed(0) + ' bps' : changeVal.toFixed(2) + '%'} 1D`
          : '—'
        }
      </div>

      {miniData.length > 1 && (
        <div className="h-10 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={miniData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}
                formatter={(v) => [formatVal(v), name]}
                labelFormatter={(l) => l}
              />
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
        </div>
      )}
    </div>
  )
}

export default function RatesPanel({ data, loading }) {
  return (
    <div className="space-y-4">
      {RATE_GROUPS.map(({ label, color, items }) => (
        <div key={label}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {items.map(({ key, label: itemLabel }) => (
              <RateTile
                key={key}
                meta={data?.[key] ? { ...data[key], label: itemLabel } : null}
                loading={loading || !data}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
