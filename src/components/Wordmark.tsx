/** "J&V" com o efeito de listras da logo. */
export function Wordmark({ size = 34, c1 = '#FFFFFF', c2 = '#F26B21', sub = true, subColor = '#C3CCE0' }: {
  size?: number; c1?: string; c2?: string; sub?: boolean; subColor?: string
}) {
  const L = (c: string, t: string) => (
    <span className="wm-stripe" style={{ ['--c' as string]: c }}>{t}</span>
  )
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: Math.round(size * 0.22) }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.03em', display: 'flex' }}>
        {L(c1, 'J')}{L(c2, '&')}{L(c1, 'V')}
      </div>
      {sub && (
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: Math.max(10, Math.round(size * 0.2)), letterSpacing: '.42em', color: subColor }}>
          PERSONALIZADOS
        </div>
      )}
    </div>
  )
}
