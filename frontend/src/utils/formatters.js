import { format, parseISO } from 'date-fns'

export const fmtBps = (v, decimals = 0) =>
  v != null ? `${v.toFixed(decimals)} bps` : '—'

export const fmtPct = (v, decimals = 2) =>
  v != null ? `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%` : '—'

export const fmtRate = (v) =>
  v != null ? `${v.toFixed(2)}%` : '—'

export const fmtNumber = (v, decimals = 2) =>
  v != null
    ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '—'

export const fmtDate = (dateStr, fmt = 'MMM d, yyyy') => {
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return dateStr ?? '—'
  }
}

export const fmtDateShort = (dateStr) => fmtDate(dateStr, 'MMM yy')

export const fmtDateAxis = (dateStr) => {
  try {
    return format(parseISO(dateStr), 'MMM yy')
  } catch {
    return dateStr
  }
}

export const changeColor = (v, invert = false) => {
  if (v == null) return 'text-slate-500'
  const positive = invert ? v < 0 : v > 0
  const negative = invert ? v > 0 : v < 0
  if (positive) return 'text-emerald-400'
  if (negative) return 'text-red-400'
  return 'text-slate-400'
}

// For credit spreads: widening (positive delta) = bad = red
export const spreadChangeColor = (v) => {
  if (v == null) return 'text-slate-500'
  if (v > 0) return 'text-red-400'
  if (v < 0) return 'text-emerald-400'
  return 'text-slate-400'
}

export const percentileColor = (p) => {
  if (p == null) return '#64748b'
  if (p < 20) return '#10b981'   // very tight – green
  if (p < 40) return '#84cc16'   // below average – lime
  if (p < 60) return '#eab308'   // average – yellow
  if (p < 80) return '#f97316'   // above average – orange
  return '#ef4444'               // very wide – red
}

export const percentileLabel = (p) => {
  if (p == null) return '—'
  if (p < 20) return 'Very Tight'
  if (p < 40) return 'Tight'
  if (p < 60) return 'Average'
  if (p < 80) return 'Wide'
  return 'Very Wide'
}
