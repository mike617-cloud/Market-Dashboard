import SpreadCard from './SpreadCard'

const SPREAD_ORDER = ['us_hy', 'us_ig', 'us_bbb', 'euro_hy', 'euro_ig', 'em_corp', 'em_sovereign', 'mbs']

export default function SpreadGrid({ data, loading, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
      {SPREAD_ORDER.map((key) => {
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
  )
}
