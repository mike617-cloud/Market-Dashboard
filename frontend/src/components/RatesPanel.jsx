import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { fmtRate, fmtPct, spreadChangeColor } from '../utils/formatters'

const RATE_ORDER = [
  { key: 'fed_funds', label: 'Fed Funds' },
  { key: 'sofr',      label: 'SOFR'      },
  { key: 'us_2y',    label: 'UST 2Y'    },
  { key: 'us_5y',    label: 'UST 5Y'    },
  { key: 'us_10y',   label: 'UST 10Y'   },
  { key: 'us_30y',   label: 'UST 30Y'   },
  { key: '2s10s',    label: '2s10s'     },
  { key: 'ecb_rate', label: 'ECB Depo'  },
  { key: 'de_10y',   label: 'Bund 10Y'  },
  { key: 'uk_10y',   label: 'Gilt 10Y'  },
  { key: 'jp_10y',   label: 'JGB 10Y'   },
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2.5">
      {RATE_ORDER.map(({ key, label }) => (
        <RateTile
          key={key}
          meta={data?.[key] ? { ...data[key], label } : null}
          loading={loading || !data}
        />
      ))}
    </div>
  )
}
