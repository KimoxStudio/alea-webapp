/**
 * Animated hex-grid SVG background from the design source (ModernHexGrid).
 * Uses a seeded pseudo-random function (not Math.random) so server and
 * client render identical markup — avoids hydration mismatches.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function HexGridBackground() {
  const cols = 14
  const rows = 10
  const size = 60
  const hexPath = 'M 30 0 L 60 17.3 L 60 51.9 L 30 69.3 L 0 51.9 L 0 17.3 Z'

  const hexes: { x: number; y: number; delay: number; dur: number; key: string }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * size * 1.5
      const y = r * size * 1.732 + (c % 2 ? size * 0.866 : 0)
      const seed = r * cols + c
      hexes.push({
        x,
        y,
        delay: seededRandom(seed) * 8,
        dur: 6 + seededRandom(seed + 0.5) * 6,
        key: `${r}-${c}`,
      })
    }
  }

  return (
    <svg
      className="mod-hex-bg"
      viewBox={`0 0 ${cols * size * 1.5} ${rows * size * 1.732}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mod-hex-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4f8b" stopOpacity="0.0" />
          <stop offset="50%" stopColor="#c8a25b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7a1f1f" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {hexes.map((h) => (
        <g key={h.key} transform={`translate(${h.x}, ${h.y})`}>
          <path d={hexPath} fill="none" stroke="rgba(200,162,91,0.15)" strokeWidth="1" />
          <path d={hexPath} fill="url(#mod-hex-g)" opacity="0">
            <animate
              attributeName="opacity"
              values="0;0.35;0"
              dur={`${h.dur}s`}
              begin={`${h.delay}s`}
              repeatCount="indefinite"
            />
          </path>
        </g>
      ))}
    </svg>
  )
}
