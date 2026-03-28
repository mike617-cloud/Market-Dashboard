import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts'
import { spreadChangeColor, percentileColor, percentileLabel } from '../utils/formatters'
import { AlertCircle } from 'lucide-react'

function Skeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-slate-800 rounded w-1/2 mb-3" />
      <div className="h-8 bg-slate-800 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-800 rounded w-1/3 mb-4" />
      <div className="h-16 bg-slate-800/50 rounded" />
      <div className="h-1.5 bg-slate-800 rounded-full mt-3" />
    </div>
  )
}

export default function SpreadCard({ item, loading, onClick }) {
  if (loading) return <Skeleton />

  const { name, short, description, source, color, data, stats, note, error } = item

  // Mini chart uses last 120 obs
  const miniData = data?.slice(-120) ?? []
  const hasData = miniData.length > 1
  const gradId = `sg-${short?.replace(/\s/g, '')}`

  const pColor = percentileColor(stats?.percentile)

  return (
    <div
      onClick={hasData ? onClick : undefined}
      className={`relative bg-slate-900 border border-slate-800/80 rounded-xl p-4 transition-all duration-200
        ${hasData ? 'cursor-pointer hover:border-slate-600 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-black/30 group' : 'opacity-60'}
      `}
      style={{ borderTopColor: color, borderTopWidth: '2px' }}
    >
      {/* Top row: labels */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] text-slate-500 font-mono truncate">{source}</div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5 leading-tight">{name}</div>
          <div className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{description}</div>
        </div>
        <span
          className="shrink-0 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color, borderColor: color + '40', background: color + '15' }}
        >
          {short}
        </span>
      </div>

      {/* Current value */}
      {error && !hasData ? (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-red-400">
          <AlertCircle size={12} />
          <span>Failed to load</span>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-mono text-[2rem] font-bold leading-none text-slate-50 fade-up">
              {stats?.current != null ? Math.round(stats.current) : '—'}
            </span>
            <span className="text-xs text-slate-500 font-mono">bps</span>
          </div>

          {/* Change row */}
          <div className="flex items-center gap-4 mt-1.5">
            <div className={`text-xs font-mono font-medium ${spreadChangeColor(stats?.change_1d)}`}>
              {stats?.change_1d != null
                ? `${stats.change_1d > 0 ? '+' : ''}${Math.round(stats.change_1d)} 1D`
                : '— 1D'}
            </div>
            <div className={`text-xs font-mono font-medium ${spreadChangeColor(stats?.change_ytd)}`}>
              {stats?.change_ytd != null
                ? `${stats.change_ytd > 0 ? '+' : ''}${Math.round(stats.change_ytd)} YTD`
                : '— YTD'}
            </div>
          </div>

          {/* Percentile bar */}
          {stats?.percentile != null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500">
                  {stats.n_obs ? `${stats.n_obs}-obs percentile` : 'Percentile'}
                </span>
                <span
                  className="text-[10px] font-mono font-semibold"
                  style={{ color: pColor }}
                >
                  {Math.round(stats.percentile)}th · {percentileLabel(stats.percentile)}
                </span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentile}%`, backgroundColor: pColor }}
                />
              </div>
            </div>
          )}

          {/* Sparkline */}
          {hasData && (
            <div className="mt-3 h-14 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={miniData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={color} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['auto', 'auto']} hide />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#${gradId})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Proxy note */}
      {note && (
        <p className="mt-2.5 text-[10px] text-amber-500/60 leading-snug border-t border-slate-800 pt-2">{note}</p>
      )}
    </div>
  )
}
