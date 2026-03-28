import { LineChart, Line, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts'

const MACRO_ORDER = [
  { key: 'gdp',          group: 'Growth'    },
  { key: 'core_pce',     group: 'Inflation' },
  { key: 'core_cpi',     group: 'Inflation' },
  { key: 'cpi',          group: 'Inflation' },
  { key: 'pce',          group: 'Inflation' },
  { key: 'unemployment', group: 'Labor'     },
  { key: 'nfp',          group: 'Labor'     },
  { key: 'indpro',       group: 'Activity'  },
  { key: 'retail_sales', group: 'Activity'  },
  { key: 'housing',      group: 'Activity'  },
  { key: 'lei',          group: 'Activity'  },
  { key: 'umich',        group: 'Activity'  },
]

const GROUP_COLORS = {
  Growth:    '#3b82f6',
  Inflation: '#ef4444',
  Labor:     '#10b981',
  Activity:  '#8b5cf6',
}

function fmtVal(v, unit) {
  if (v == null) return '—'
  if (unit === 'K MoM' || unit === 'K SAAR') return `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString()}`
  if (unit === 'index') return v.toFixed(1)
  if (unit?.includes('%')) return `${v.toFixed(2)}%`
  if (unit === '% ann.') return `${v.toFixed(1)}%`
  return v.toFixed(2)
}

function changeColor(v, unit) {
  if (v == null) return 'text-slate-500'
  // Inflation going up = bad (red), going down = good (green)
  const isInflation = unit?.includes('YoY') || unit?.includes('ann')
  const isUnemployment = unit === '%'
  if (isInflation || isUnemployment) {
    return v > 0 ? 'text-red-400' : v < 0 ? 'text-emerald-400' : 'text-slate-400'
  }
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-400'
}

function MacroTile({ item, loading }) {
  if (loading || !item) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 animate-pulse">
        <div className="h-2 bg-slate-800 rounded w-16 mb-2" />
        <div className="h-5 bg-slate-800 rounded w-12 mb-1" />
        <div className="h-2 bg-slate-800/50 rounded w-10" />
        <div className="h-10 bg-slate-800/30 rounded mt-2" />
      </div>
    )
  }

  const { name, unit, color, target, data = [], stats = {}, freq, error } = item
  const miniData = data.slice(-36)  // last 36 obs
  const lastDate = data.length ? data[data.length - 1].date?.slice(0, 7) : null

  const chg = stats.change_1d  // for monthly/quarterly data this is the most recent obs change
  const cColor = changeColor(chg, unit)

  const groupKey = MACRO_ORDER.find(o => o.key === item.key)?.group
  const accentColor = color ?? GROUP_COLORS[groupKey] ?? '#64748b'

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3"
      style={{ borderTopColor: accentColor, borderTopWidth: '2px' }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-slate-500 font-mono leading-none">{unit}</span>
        {freq === 'Q' && <span className="text-[9px] text-slate-600 font-mono">QTRLY</span>}
        {lastDate && <span className="text-[9px] text-slate-600 font-mono">{lastDate}</span>}
      </div>
      <div className="text-[10px] text-slate-400 mb-1 leading-tight">{name}</div>

      {error && !data.length ? (
        <div className="text-xs text-red-400/70 mt-1">Unavailable</div>
      ) : (
        <>
          <div className="font-mono text-lg font-bold text-slate-100 leading-none">
            {fmtVal(stats.current, unit)}
          </div>
          <div className={`text-[10px] font-mono mt-0.5 ${cColor}`}>
            {chg != null ? `${chg > 0 ? '+' : ''}${fmtVal(chg, unit)} prev` : '—'}
          </div>

          {/* Target reference (e.g. Fed 2% for PCE/CPI) */}
          {target != null && (
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">
              Target: {target}%
              {stats.current != null && (
                <span className={stats.current > target ? ' text-red-400/70' : ' text-emerald-400/70'}>
                  {' '}({stats.current > target ? '+' : ''}{(stats.current - target).toFixed(2)}pp)
                </span>
              )}
            </div>
          )}

          {miniData.length > 2 && (
            <div className="h-10 mt-2 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={miniData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <YAxis domain={['auto', 'auto']} hide />
                  {target != null && (
                    <ReferenceLine y={target} stroke="#6b7280" strokeDasharray="3 3" />
                  )}
                  <Line
                    type="monotone" dataKey="value"
                    stroke={accentColor} strokeWidth={1.5}
                    dot={false} isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function MacroPanel({ data, loading }) {
  // Group tiles visually
  const groups = ['Growth', 'Inflation', 'Labor', 'Activity']
  return (
    <div className="space-y-3">
      {groups.map(group => {
        const groupItems = MACRO_ORDER.filter(o => o.group === group)
        return (
          <div key={group}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[group] }} />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{group}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2">
              {groupItems.map(({ key }) => (
                <MacroTile
                  key={key}
                  item={data?.[key] ? { ...data[key], key } : null}
                  loading={loading || !data}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
