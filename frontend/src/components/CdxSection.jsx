import SpreadCard from './SpreadCard'
import { ShieldAlert } from 'lucide-react'

const CDX_ORDER = ['cdx_hy', 'cdx_ig', 'itraxx_europe', 'itraxx_xover']

export default function CdxSection({ data, loading, onSelect }) {
  return (
    <div>
      {/* Proxy banner */}
      <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5 mb-4 text-xs text-amber-400/80">
        <ShieldAlert size={13} className="shrink-0 mt-0.5 text-amber-500" />
        <span>
          Real CDX/iTraxx levels require a{' '}
          <strong className="text-amber-400">Markit / Bloomberg Data License</strong>.
          Values below are ICE BofA cash index OAS (highly correlated proxies). The spread direction and
          percentile ranking remain valid for relative value analysis.
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CDX_ORDER.map((key) => {
          const item = data?.[key]
          return (
            <SpreadCard
              key={key}
              item={item ?? { key, name: key, data: [], stats: {} }}
              loading={loading || !data}
              onClick={() => item && onSelect({ ...item, type: 'spread' })}
            />
          )
        })}
      </div>
    </div>
  )
}
