const ITEMS_ES = [
  '★ Cada viernes · BOLT-DAYS',
  '◆ Sábados · Pathfinder 2e',
  '● Jornadas Gastro-Lúdicas · viernes 20:30',
  '▲ Local abierto 24/7 para socios',
  '★ Torneos mensuales · NAF, W40K, Blood Bowl',
  '◆ Mesa abierta · llega y juega',
]

const ITEMS_EN = [
  '★ Every Friday · BOLT-DAYS',
  '◆ Saturdays · Pathfinder 2e',
  '● Gastro-Gaming Nights · Fri 20:30',
  '▲ Venue open 24/7 for members',
  '★ Monthly tournaments · NAF, W40K, Blood Bowl',
  '◆ Open table · drop in any time',
]

export function Ticker({ locale }: { locale: string }) {
  const items = locale === 'en' ? ITEMS_EN : ITEMS_ES
  const doubled = [...items, ...items]

  return (
    <div className="mod-ticker">
      <div className="mod-ticker-track">
        {doubled.map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  )
}
