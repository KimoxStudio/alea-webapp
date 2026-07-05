interface D20Props {
  face?: number
  size?: number
  palette?: [string, string]
  critical?: boolean
}

/** Pseudo-3D D20 die face, ported from the design source's <D20>. */
export function D20({ face = 1, size = 150, palette = ['#c8a25b', '#1a1410'], critical = false }: D20Props) {
  const [bg, fg] = palette
  const isCrit = critical || face === 20
  const gradId = `d20-grad-${size}`

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      style={{
        filter: isCrit
          ? 'drop-shadow(0 0 28px rgba(230,194,129,0.85)) drop-shadow(0 8px 18px rgba(0,0,0,0.45))'
          : 'drop-shadow(0 8px 18px rgba(0,0,0,0.45))',
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isCrit ? '#ffd980' : bg} />
          <stop offset="100%" stopColor={isCrit ? '#a93232' : bg} />
        </linearGradient>
      </defs>
      <polygon
        points="60,6 110,33 110,87 60,114 10,87 10,33"
        fill={`url(#${gradId})`}
        stroke={isCrit ? '#ffd980' : fg}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polygon points="60,6 110,33 60,60" fill="rgba(255,255,255,0.16)" />
      <polygon points="110,33 110,87 60,60" fill="rgba(0,0,0,0.10)" />
      <polygon points="110,87 60,114 60,60" fill="rgba(0,0,0,0.22)" />
      <polygon points="60,114 10,87 60,60" fill="rgba(0,0,0,0.16)" />
      <polygon points="10,87 10,33 60,60" fill="rgba(255,255,255,0.06)" />
      <polygon points="10,33 60,6 60,60" fill="rgba(255,255,255,0.20)" />
      <polygon
        points="60,28 86,46 76,76 44,76 34,46"
        fill={isCrit ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.15)'}
        stroke={isCrit ? '#ffd980' : fg}
        strokeWidth="1.2"
      />
      <text
        x="60"
        y="68"
        textAnchor="middle"
        fontFamily="Space Grotesk, sans-serif"
        fontWeight="700"
        fontSize={face >= 10 ? '28' : '32'}
        fill={isCrit ? '#1a1410' : fg}
      >
        {face}
      </text>
    </svg>
  )
}
