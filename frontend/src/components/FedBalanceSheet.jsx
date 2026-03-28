import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { fmtDateAxis } from '../utils/formatters'

function StatTile({ name, unit, stats, loading }) {
  if (loading) return (
    <div className="bg-slate-800/60 rounded-lg p-3 animate-pulse">
      <div className="h-2 bg-slate-700 rounded w-20 mb-2" />
      <div className="h-5 bg-slate-700 rounded w-16" />
    </div>
  )
  const fmtB = (v) => v == null ? '—' : `$${(v / 1000).toFixed(1)}T`
  const chg = stats?.change_ytd
  const chgColor = chg == null ? 'text-slate-500'
    : name === 'Total Assets' ? (chg < 0 ? 'text-emerald-400' : 'text-red-400')
    : 'text-slate-400'
  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <div className="text-[10px] text-slate-500 mb-1 leading-tight">{name}</div>
      <div className="font-mono text-base font-bold text-slate-100">{fmtB(stats?.current)}</div>
      {chg != null && (
        <div className={`text-[10px] font-mono mt-0.5 ${chgColor}`}>
          {chg > 0 ? '+' : ''}${(chg / 1000).toFixed(1)}T YTD
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-slate-200">${(p.value / 1000).toFixed(2)}T</span>
        </div>
      ))}
    </div>
  )
}

export default function FedBalanceSheet({ data, loading }) {
  const tiles = [
    { key: 'fed_total',    name: 'Total Assets'     },
    { key: 'fed_tsy',      name: 'Treasuries Held'  },
    { key: 'fed_mbs',      name: 'MBS Holdings'     },
    { key: 'fed_revrepo',  name: 'Reverse Repo'     },
    { key: 'fed_reserves', name: 'Reserve Balances' },
    { key: 'm2',           name: 'M2 Money Supply'  },
  ]

  const stacked = data?._stacked ?? []

  return (
    <div className="space-y-4">
      {/* Stat tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map(({ key, name }) => (
          <StatTile
            key={key}
            name={name}
            stats={data?.[key]?.stats}
            loading={loading || !data}
          />
        ))}
      </div>

      {/* Stacked area chart */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-semibold text-slate-300">Balance Sheet Composition</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Federal Reserve · FRED · $B</p>
          </div>
        </div>
        {loading || stacked.length < 2 ? (
          <div className="h-48 flex items-center justify-center">
            <div className="text-xs text-slate-600">
              {loading ? 'Loading…' : 'No data available'}
            </div>
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stacked} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} stackOffset="none">
                <defs>
                  <linearGradient id="gradTsy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="gradMbs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#64748b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date" tickFormatter={fmtDateAxis} minTickGap={60}
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={{ stroke: '#1e293b' }} tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}T`}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Area type="monotone" dataKey="treasuries" name="Treasuries"
                  stackId="1" stroke="#3b82f6" fill="url(#gradTsy)" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="mbs" name="MBS"
                  stackId="1" stroke="#10b981" fill="url(#gradMbs)" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="other" name="Other"
                  stackId="1" stroke="#64748b" fill="url(#gradOther)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
